import { transcribeAudio } from './aiClient';

export type VoiceStatus = 'idle' | 'requesting-permission' | 'listening' | 'transcribing' | 'error';

export interface VoiceCallbacks {
  onInterimText: (text: string) => void;
  onFinalText: (text: string) => void;
  onStatusChange: (status: VoiceStatus) => void;
  onVolumeChange?: (volume: number) => void;
  onError: (errorMessage: string) => void;
}

export class RobustVoiceHandler {
  private recognition: any = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;

  private isListening = false;
  private receivedFinalText = false;
  private currentFinalTranscript = '';

  private callbacks: VoiceCallbacks | null = null;

  public isSpeechRecognitionSupported(): boolean {
    return !!(
      (typeof window !== 'undefined' && (window as any).SpeechRecognition) ||
      (typeof window !== 'undefined' && (window as any).webkitSpeechRecognition)
    );
  }

  public async start(callbacks: VoiceCallbacks): Promise<void> {
    if (this.isListening) {
      await this.stop();
      return;
    }

    this.callbacks = callbacks;
    this.receivedFinalText = false;
    this.currentFinalTranscript = '';
    this.audioChunks = [];

    callbacks.onStatusChange('requesting-permission');

    // 1. Request microphone permission
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser.');
      }
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (err: any) {
      console.warn('Microphone permission error:', err);
      let msg = 'Unable to access microphone. Please check your browser permissions.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Microphone permission was denied. Please allow microphone access in your browser.';
      }
      callbacks.onStatusChange('error');
      callbacks.onError(msg);
      return;
    }

    this.isListening = true;
    callbacks.onStatusChange('listening');

    // 2. Set up AudioContext volume meter for live visual feedback
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const updateVolume = () => {
          if (!this.isListening || !this.analyser) return;
          this.analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          callbacks.onVolumeChange?.(Math.min(100, Math.round((avg / 128) * 100)));
          this.animFrameId = requestAnimationFrame(updateVolume);
        };
        updateVolume();
      }
    } catch (e) {
      console.warn('AudioContext visualization setup failed:', e);
    }

    // 3. Start MediaRecorder as fallback audio capture
    try {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      this.mediaRecorder = new MediaRecorder(this.mediaStream, mimeType ? { mimeType } : undefined);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      this.mediaRecorder.start(250);
    } catch (err) {
      console.warn('MediaRecorder init error:', err);
    }

    // 4. Try browser SpeechRecognition for live real-time words
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      try {
        this.recognition = new SpeechRecognitionClass();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              this.receivedFinalText = true;
              this.currentFinalTranscript += ' ' + transcript.trim();
              callbacks.onFinalText(transcript.trim());
            } else {
              interim += transcript;
            }
          }
          if (interim) {
            callbacks.onInterimText(interim);
          }
        };

        this.recognition.onerror = (event: any) => {
          console.warn('Web Speech error:', event.error);
          // Don't kill whole flow if it's no-speech; MediaRecorder fallback will assist
          if (event.error === 'not-allowed') {
            callbacks.onError('Unable to access microphone. Please check your browser permissions.');
          }
        };

        this.recognition.onend = () => {
          // If still marked as listening and speech recognition ends prematurely, restart if active
          if (this.isListening && this.recognition) {
            try {
              this.recognition.start();
            } catch {
              // ignore restart errors
            }
          }
        };

        this.recognition.start();
      } catch (err) {
        console.warn('SpeechRecognition start error:', err);
      }
    }
  }

  public async stop(): Promise<void> {
    if (!this.isListening) return;
    this.isListening = false;

    // Stop visualizer
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    // Stop SpeechRecognition
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }

    // Stop MediaRecorder and grab audio blob
    let recordedBlob: Blob | null = null;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        if (!this.mediaRecorder) return resolve();
        this.mediaRecorder.onstop = () => {
          if (this.audioChunks.length > 0) {
            recordedBlob = new Blob(this.audioChunks, {
              type: this.audioChunks[0].type || 'audio/webm',
            });
          }
          resolve();
        };
        try {
          this.mediaRecorder.stop();
        } catch {
          resolve();
        }
      });
    }

    // Stop all media tracks to turn off microphone light
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // Check if we need Gemini AI transcription fallback
    // If Web Speech API didn't produce any final text, but we have audio recorded (>1.5kb)
    if (!this.receivedFinalText && recordedBlob && (recordedBlob as Blob).size > 2000) {
      this.callbacks?.onStatusChange('transcribing');
      try {
        const aiTranscript = await transcribeAudio(recordedBlob as Blob);
        if (aiTranscript && aiTranscript.trim()) {
          this.callbacks?.onFinalText(aiTranscript.trim());
        }
      } catch (err: any) {
        console.warn('AI Audio Transcription error:', err);
        // non-fatal if user just stayed silent
      }
    }

    this.callbacks?.onStatusChange('idle');
    this.callbacks?.onVolumeChange?.(0);
    this.callbacks?.onInterimText('');
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}

export const robustVoiceHandler = new RobustVoiceHandler();
