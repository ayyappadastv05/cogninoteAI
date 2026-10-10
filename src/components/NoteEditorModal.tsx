import React, { useState, useEffect, useRef } from 'react';
import type { Note, AiActionState } from '../types/note';
import {
  summarizeNote,
  suggestTags,
  generateTitle,
  improveNote,
} from '../services/aiClient';
import { ImproveDiffModal } from './ImproveDiffModal';
import { useToast } from './Toast';
import {
  X,
  Mic,
  MicOff,
  Sparkles,
  Tag,
  Wand2,
  FileText,
  Star,
  Loader2,
  Check,
  Plus,
  Cloud,
} from 'lucide-react';

interface NoteEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    noteData: {
      title: string;
      content: string;
      tags: string[];
      summary?: string;
      isFavorite?: boolean;
      isDraft?: boolean;
    },
    noteId?: string | null
  ) => Promise<string | void>;
  initialNote?: Note | null;
}

export type AutoSaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialNote = null,
}) => {
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [summary, setSummary] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);

  // Active note ID being edited or newly created as draft
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);

  // Auto-save states
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const isAutoSavingRef = useRef(false);

  // Last saved content snapshot for dirty checking
  const lastSavedRef = useRef<{
    title: string;
    content: string;
    tags: string[];
    summary: string;
    isFavorite: boolean;
  }>({
    title: '',
    content: '',
    tags: [],
    summary: '',
    isFavorite: false,
  });

  // AI states
  const [aiState, setAiState] = useState<AiActionState>({
    summarizing: false,
    suggestingTags: false,
    generatingTitle: false,
    improving: false,
    asking: false,
  });

  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [showImproveDiff, setShowImproveDiff] = useState(false);
  const [improvedCandidate, setImprovedCandidate] = useState('');

  // Web Speech API states & refs
  const [isListening, setIsListening] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialNote) {
      setTitle(initialNote.title || '');
      setContent(initialNote.content || '');
      setTags(initialNote.tags || []);
      setSummary(initialNote.summary || '');
      setIsFavorite(!!initialNote.isFavorite);
      setCurrentNoteId(initialNote.id);
      lastSavedRef.current = {
        title: initialNote.title || '',
        content: initialNote.content || '',
        tags: [...(initialNote.tags || [])],
        summary: initialNote.summary || '',
        isFavorite: !!initialNote.isFavorite,
      };
      setAutoSaveStatus(initialNote.isDraft ? 'saved' : 'idle');
    } else {
      setTitle('');
      setContent('');
      setTags([]);
      setSummary('');
      setIsFavorite(false);
      setCurrentNoteId(null);
      lastSavedRef.current = {
        title: '',
        content: '',
        tags: [],
        summary: '',
        isFavorite: false,
      };
      setAutoSaveStatus('idle');
    }
    setSuggestedTags([]);
    setInterimText('');
    setLastSavedTime(null);
  }, [initialNote, isOpen]);

  // Stop speech recognition and release media tracks
  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch (err) {
        console.warn('Error stopping recognition:', err);
      }
      recognitionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    setIsListening(false);
    setIsRequestingPermission(false);
    setInterimText('');
  };

  // Start Web Speech API with explicit permission handling
  const startListening = async () => {
    // 1. Check browser support for SpeechRecognition
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      showToast(
        'Speech Recognition is not supported in this browser. Please use Chrome, Edge, or Safari.',
        'error'
      );
      return;
    }

    setIsRequestingPermission(true);

    // 2. Request microphone permission
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
      }
    } catch (err: any) {
      setIsRequestingPermission(false);
      console.warn('Microphone permission error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        showToast(
          'Microphone permission denied. Please allow microphone access in your browser settings.',
          'error'
        );
      } else if (err.name === 'NotFoundError') {
        showToast('No microphone found on this device.', 'error');
      } else {
        showToast('Unable to access microphone. Please check your browser audio permissions.', 'error');
      }
      return;
    }

    // 3. Instantiate SpeechRecognition
    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      recognition.onstart = () => {
        setIsRequestingPermission(false);
        setIsListening(true);
        setInterimText('');
      };

      // 4. Handle transcribed speech and update note content state
      recognition.onresult = (event: any) => {
        let liveInterim = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          if (result.isFinal) {
            finalChunk += transcript + ' ';
          } else {
            liveInterim += transcript;
          }
        }

        if (finalChunk.trim()) {
          setContent((prev) => {
            const trimmedPrev = prev.trim();
            const trimmedChunk = finalChunk.trim();
            return trimmedPrev ? `${trimmedPrev} ${trimmedChunk}` : trimmedChunk;
          });
          setInterimText('');
        } else if (liveInterim) {
          setInterimText(liveInterim);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error event:', event.error);
        if (event.error === 'not-allowed') {
          showToast(
            'Microphone permission denied. Please enable microphone permissions in your browser.',
            'error'
          );
          stopListening();
        } else if (event.error === 'network') {
          showToast('Network error encountered during speech recognition.', 'error');
          stopListening();
        } else if (event.error === 'no-speech') {
          // Normal silence, keep listening
        } else if (event.error !== 'aborted') {
          showToast(`Speech recognition notice: ${event.error}`, 'info');
        }
      };

      recognition.onend = () => {
        // If still listening and user hasn't explicitly stopped, restart recognition
        if (recognitionRef.current) {
          try {
            recognition.start();
          } catch {
            stopListening();
          }
        } else {
          stopListening();
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setIsRequestingPermission(false);
      setIsListening(false);
      showToast('Could not start speech recognition. Please try again.', 'error');
    }
  };

  // Toggle microphone listening state
  const toggleListening = () => {
    if (isListening || isRequestingPermission) {
      stopListening();
      showToast('Voice recording stopped.', 'info');
    } else {
      startListening();
    }
  };

  // Clean up speech recognition if modal closes or unmounts
  useEffect(() => {
    if (!isOpen) {
      stopListening();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  // Check if current form state differs from the last saved draft snapshot
  const hasUnsavedChanges = () => {
    const last = lastSavedRef.current;
    if (title.trim() !== last.title.trim()) return true;
    if (content !== last.content) return true;
    if (summary !== last.summary) return true;
    if (isFavorite !== last.isFavorite) return true;
    if (tags.length !== last.tags.length || tags.some((t, i) => t !== last.tags[i])) return true;
    return false;
  };

  // Perform auto-save draft to database
  const performAutoSave = async () => {
    if (!isOpen) return;
    if (isAutoSavingRef.current || isSaving) return;
    // Don't auto-save if completely empty note
    if (!content.trim() && !title.trim()) return;
    // Don't auto-save if nothing has changed since last save
    if (!hasUnsavedChanges()) return;

    isAutoSavingRef.current = true;
    setAutoSaveStatus('saving');

    try {
      const draftPayload = {
        title: title.trim() || 'Untitled Draft',
        content,
        tags,
        summary,
        isFavorite,
        isDraft: true,
      };

      const savedId = await onSave(draftPayload, currentNoteId);
      if (savedId && typeof savedId === 'string' && !currentNoteId) {
        setCurrentNoteId(savedId);
      }

      lastSavedRef.current = {
        title: title.trim() || 'Untitled Draft',
        content,
        tags: [...tags],
        summary,
        isFavorite,
      };

      setAutoSaveStatus('saved');
      setLastSavedTime(new Date());
    } catch (err) {
      console.warn('Auto-save draft error:', err);
      setAutoSaveStatus('error');
    } finally {
      isAutoSavingRef.current = false;
    }
  };

  // 10-Second Auto-save interval to database
  useEffect(() => {
    if (!isOpen) return;

    const autoSaveTimer = setInterval(() => {
      performAutoSave();
    }, 10000); // exactly every 10 seconds

    return () => clearInterval(autoSaveTimer);
  }, [isOpen, title, content, tags, summary, isFavorite, currentNoteId, isSaving]);

  // Track unsaved state when user edits note content or title
  useEffect(() => {
    if (!isOpen) return;
    if (hasUnsavedChanges()) {
      if (autoSaveStatus === 'saved' || autoSaveStatus === 'idle') {
        setAutoSaveStatus('unsaved');
      }
    }
  }, [title, content, tags, summary, isFavorite, isOpen]);

  // Keyboard shortcut: Cmd/Ctrl + S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        if (!showImproveDiff) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, title, content, tags, summary, isFavorite, showImproveDiff, isListening, currentNoteId]);

  if (!isOpen) return null;

  // Tag helpers
  const handleAddTag = (rawTag: string) => {
    const clean = rawTag.replace(/^[#\s]+|[#\s]+$/g, '').trim();
    if (!clean) return;
    if (!tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
    }
    // Remove from suggested tags if it was there
    setSuggestedTags((prev) => prev.filter((t) => t.toLowerCase() !== clean.toLowerCase()));
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  // AI Summarize
  const handleAiSummarize = async () => {
    if (!content.trim()) {
      showToast('Please enter some content before summarizing.', 'error');
      return;
    }
    setAiState((prev) => ({ ...prev, summarizing: true }));
    try {
      const result = await summarizeNote(content, title);
      setSummary(result);
      showToast('AI Summary generated!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'AI service is currently unavailable. Please try again.', 'error');
    } finally {
      setAiState((prev) => ({ ...prev, summarizing: false }));
    }
  };

  // AI Suggest Tags
  const handleAiSuggestTags = async () => {
    if (!content.trim()) {
      showToast('Please write some content to analyze tags.', 'error');
      return;
    }
    setAiState((prev) => ({ ...prev, suggestingTags: true }));
    try {
      const suggestions = await suggestTags(content, title, tags);
      const filtered = suggestions.filter(
        (t) => !tags.map((x) => x.toLowerCase()).includes(t.toLowerCase())
      );
      setSuggestedTags(filtered);
      if (filtered.length === 0) {
        showToast('No new tags suggested.', 'info');
      } else {
        showToast(`Suggested ${filtered.length} relevant tags!`, 'success');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'AI service is currently unavailable. Please try again.', 'error');
    } finally {
      setAiState((prev) => ({ ...prev, suggestingTags: false }));
    }
  };

  // AI Generate Title
  const handleAiGenerateTitle = async () => {
    if (!content.trim()) {
      showToast('Please enter some note content first.', 'error');
      return;
    }
    setAiState((prev) => ({ ...prev, generatingTitle: true }));
    try {
      const generated = await generateTitle(content);
      setTitle(generated);
      showToast('Title generated!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'AI service is currently unavailable. Please try again.', 'error');
    } finally {
      setAiState((prev) => ({ ...prev, generatingTitle: false }));
    }
  };

  // AI Improve Note
  const handleAiImprove = async () => {
    if (!content.trim()) {
      showToast('Please enter some content before improving.', 'error');
      return;
    }
    setAiState((prev) => ({ ...prev, improving: true }));
    try {
      const improved = await improveNote(content, title);
      setImprovedCandidate(improved);
      setShowImproveDiff(true);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'AI service is currently unavailable. Please try again.', 'error');
    } finally {
      setAiState((prev) => ({ ...prev, improving: false }));
    }
  };

  // Save Note (Finalize and clear draft state)
  const handleSave = async () => {
    if (!content.trim() && !title.trim()) {
      showToast('Please enter some content before saving.', 'error');
      return;
    }

    if (isListening || isRequestingPermission) {
      stopListening();
    }

    setIsSaving(true);
    try {
      await onSave(
        {
          title: title.trim() || 'Untitled Note',
          content,
          tags,
          summary,
          isFavorite,
          isDraft: false,
        },
        currentNoteId
      );

      lastSavedRef.current = {
        title: title.trim() || 'Untitled Note',
        content,
        tags: [...tags],
        summary,
        isFavorite,
      };

      setAutoSaveStatus('saved');
      showToast('Note saved successfully!', 'success');
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast('Unable to save your note. Please check your internet connection.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="relative w-full max-w-4xl max-h-[94vh] flex flex-col bg-[#FDFDFB] border border-neutral-300 shadow-2xl rounded-md overflow-hidden text-neutral-900">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-neutral-200 bg-white">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-neutral-500 font-semibold">
                {initialNote ? 'Edit Note' : 'New Note'}
              </span>
              <button
                type="button"
                onClick={() => setIsFavorite(!isFavorite)}
                className="p-1 rounded text-neutral-400 hover:text-amber-500 transition-colors cursor-pointer"
                title={isFavorite ? 'Starred note' : 'Mark as favorite'}
              >
                <Star
                  className={`w-4 h-4 ${
                    isFavorite ? 'fill-amber-400 text-amber-500' : 'text-neutral-400'
                  }`}
                />
              </button>

              {/* Real-time Draft Auto-Save Status Pill */}
              <div className="ml-2 flex items-center">
                {autoSaveStatus === 'saving' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono text-neutral-700 bg-neutral-100 border border-neutral-200 shadow-2xs">
                    <Loader2 className="w-3 h-3 animate-spin text-neutral-600" />
                    <span>Auto-saving draft...</span>
                  </span>
                )}
                {autoSaveStatus === 'saved' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200/70 shadow-2xs">
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Draft saved {lastSavedTime ? `(${lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})` : ''}</span>
                  </span>
                )}
                {autoSaveStatus === 'unsaved' && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono text-amber-800 bg-amber-50/80 border border-amber-200/70 shadow-2xs"
                    title="Auto-saves note content as a draft to the database every 10 seconds"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>Auto-saving in 10s</span>
                  </span>
                )}
                {autoSaveStatus === 'error' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono text-red-700 bg-red-50 border border-red-200">
                    <span>Draft save retry pending...</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block text-[11px] font-mono text-neutral-400">
                ⌘S to save
              </span>
              <button
                type="button"
                onClick={() => {
                  stopListening();
                  onClose();
                }}
                className="p-1 text-neutral-400 hover:text-neutral-900 rounded hover:bg-neutral-100 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* AI & Voice Toolbar */}
          <div className="px-4 sm:px-6 py-2.5 bg-neutral-50 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Microphone Button reflecting listening state */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleListening}
                className={`px-3 py-1.5 rounded font-medium flex items-center gap-2 transition-all cursor-pointer ${
                  isListening
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm ring-2 ring-red-400/40 animate-pulse'
                    : isRequestingPermission
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300'
                }`}
                title={isListening ? 'Click to stop listening' : 'Start speech-to-text recording'}
                aria-label={isListening ? 'Stop listening' : 'Start voice input'}
              >
                {isRequestingPermission ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Allowing Mic...</span>
                  </>
                ) : isListening ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <MicOff className="w-3.5 h-3.5" />
                    <span className="font-semibold">Listening... (Click to stop)</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-neutral-700" />
                    <span>🎙 Voice Input</span>
                  </>
                )}
              </button>

              {isListening && (
                <span className="text-[11px] font-mono text-red-600 hidden sm:inline-flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                  Transcribing speech in real-time...
                </span>
              )}
            </div>

            {/* AI Action Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={aiState.summarizing || !content.trim()}
                onClick={handleAiSummarize}
                className="px-2.5 py-1.5 bg-white hover:bg-neutral-100 disabled:opacity-40 text-neutral-800 border border-neutral-300 rounded font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Generate concise summary"
              >
                {aiState.summarizing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 text-neutral-700" />
                )}
                <span>Summarize</span>
              </button>

              <button
                type="button"
                disabled={aiState.suggestingTags || !content.trim()}
                onClick={handleAiSuggestTags}
                className="px-2.5 py-1.5 bg-white hover:bg-neutral-100 disabled:opacity-40 text-neutral-800 border border-neutral-300 rounded font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="AI suggests relevant tags"
              >
                {aiState.suggestingTags ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Tag className="w-3 h-3 text-neutral-700" />
                )}
                <span>Suggest Tags</span>
              </button>

              <button
                type="button"
                disabled={aiState.generatingTitle || !content.trim()}
                onClick={handleAiGenerateTitle}
                className="px-2.5 py-1.5 bg-white hover:bg-neutral-100 disabled:opacity-40 text-neutral-800 border border-neutral-300 rounded font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Auto-generate title from note content"
              >
                {aiState.generatingTitle ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <FileText className="w-3 h-3 text-neutral-700" />
                )}
                <span>AI Title</span>
              </button>

              <button
                type="button"
                disabled={aiState.improving || !content.trim()}
                onClick={handleAiImprove}
                className="px-2.5 py-1.5 bg-white hover:bg-neutral-100 disabled:opacity-40 text-neutral-800 border border-neutral-300 rounded font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Polish and restructure note"
              >
                {aiState.improving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Wand2 className="w-3 h-3 text-neutral-700" />
                )}
                <span>Improve Note</span>
              </button>
            </div>
          </div>

          {/* Real-time Voice Transcript Live Indicator */}
          {interimText && (
            <div className="px-6 py-2 bg-red-50 border-b border-red-200 text-xs text-red-900 font-mono flex items-center gap-2 animate-in fade-in duration-100">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-ping shrink-0" />
              <span className="font-semibold shrink-0">Live speech:</span>
              <span className="italic truncate">{interimText}</span>
            </div>
          )}

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 space-y-4">
            {/* Title Row with AI Title quick-trigger */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title (or click AI Title)..."
                className="flex-1 text-xl sm:text-2xl font-serif font-bold text-neutral-950 placeholder:text-neutral-400 bg-transparent border-b border-transparent focus:border-neutral-400 focus:outline-none py-1"
              />
              {!title.trim() && content.trim() && (
                <button
                  type="button"
                  onClick={handleAiGenerateTitle}
                  disabled={aiState.generatingTitle}
                  className="shrink-0 text-xs px-2.5 py-1 border border-neutral-300 hover:border-neutral-900 rounded font-mono text-neutral-600 hover:text-neutral-900 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-neutral-700" />
                  Auto-Title
                </button>
              )}
            </div>

            {/* Tags Input & Active Tag Pills */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-100 border border-neutral-200 text-xs font-mono text-neutral-800"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-neutral-400 hover:text-neutral-900 ml-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}

                <div className="inline-flex items-center">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    placeholder="+ Add tag (Enter)"
                    className="text-xs font-mono py-1 px-2 border border-dashed border-neutral-300 rounded focus:border-neutral-900 focus:outline-none bg-transparent w-32"
                  />
                </div>
              </div>

              {/* AI Suggested Tags row */}
              {suggestedTags.length > 0 && (
                <div className="p-2.5 bg-neutral-50 border border-dashed border-neutral-300 rounded text-xs flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-neutral-600" />
                    Suggested:
                  </span>
                  {suggestedTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleAddTag(tag)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:bg-neutral-900 hover:text-white border border-neutral-300 text-neutral-700 text-xs font-mono transition-colors group cursor-pointer"
                      title="Click to add tag"
                    >
                      <Plus className="w-3 h-3 text-neutral-400 group-hover:text-white" />#{tag}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      suggestedTags.forEach((t) => handleAddTag(t));
                      setSuggestedTags([]);
                    }}
                    className="text-[11px] font-mono text-neutral-500 hover:text-neutral-900 underline ml-auto cursor-pointer"
                  >
                    Accept All
                  </button>
                </div>
              )}
            </div>

            {/* AI Summary Callout (if exists) */}
            {summary && (
              <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono uppercase tracking-wider text-neutral-700 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-neutral-700" />
                    AI Summary
                  </span>
                  <button
                    type="button"
                    onClick={() => setSummary('')}
                    className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                    title="Remove summary"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="font-serif italic text-neutral-700 leading-relaxed">{summary}</p>
              </div>
            )}

            {/* Note Content Writing Canvas */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start writing or speaking your thoughts... (Markdown supported)"
                rows={14}
                className="w-full p-4 font-sans text-sm sm:text-base text-neutral-900 bg-white border border-neutral-200 rounded-md focus:border-neutral-900 focus:outline-none resize-y leading-relaxed"
              />
            </div>
          </div>

          {/* Bottom Bar with Metadata & Actions */}
          <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 text-neutral-400 font-mono text-[11px]">
              <span>{wordCount} words</span>
              <span>•</span>
              <span>{charCount} characters</span>
              <span className="hidden sm:inline-block">•</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-neutral-400">
                <Cloud className="w-3 h-3 text-neutral-400" />
                Draft auto-save (every 10s)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  stopListening();
                  onClose();
                }}
                className="px-4 py-2 border border-neutral-300 hover:bg-neutral-100 text-neutral-700 font-medium rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white font-medium rounded flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Save Note
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Improvement Diff / Review Modal */}
      <ImproveDiffModal
        isOpen={showImproveDiff}
        onClose={() => setShowImproveDiff(false)}
        originalContent={content}
        improvedContent={improvedCandidate}
        onAccept={(applied) => {
          setContent(applied);
          showToast('Applied AI improved note!', 'success');
        }}
      />
    </>
  );
};
