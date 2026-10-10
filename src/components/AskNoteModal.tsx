import React, { useState } from 'react';
import type { Note } from '../types/note';
import { askNote } from '../services/aiClient';
import { useToast } from './Toast';
import { X, Send, Sparkles, MessageSquare, Loader2, Copy, Check } from 'lucide-react';

interface AskNoteModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AskNoteModal: React.FC<AskNoteModalProps> = ({ note, isOpen, onClose }) => {
  const { showToast } = useToast();
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<Array<{ q: string; a: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen || !note) return null;

  const handleAsk = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!question.trim()) return;

    const currentQ = question.trim();
    setQuestion('');
    setLoading(true);

    try {
      const answer = await askNote(note.title, note.content, currentQ);
      setAnswers((prev) => [...prev, { q: currentQ, a: answer }]);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'AI service is currently unavailable. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyAnswer = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
    showToast('Copied answer to clipboard', 'info');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl max-h-[85vh] flex flex-col bg-white border border-neutral-300 shadow-2xl rounded-md overflow-hidden text-neutral-900">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-neutral-800" />
            <div>
              <h3 className="font-serif font-bold text-base text-neutral-950">Ask Note</h3>
              <p className="text-xs text-neutral-500 truncate max-w-xs">
                Questioning: {note.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[220px]">
          {answers.length === 0 && !loading && (
            <div className="text-center py-8">
              <div className="w-10 h-10 mx-auto rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 mb-3">
                <Sparkles className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-neutral-800">Ask anything about this note</p>
              <p className="text-xs text-neutral-400 mt-1">
                E.g. "What are the core ideas?", "Summarize into 3 bullets", "Extract technical keywords"
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {['What are the main takeaways?', 'Summarize into 3 action points', 'Explain simply'].map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setQuestion(suggestion);
                      }}
                      className="px-2.5 py-1 text-xs bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-full text-neutral-600 transition-colors"
                    >
                      {suggestion}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {answers.map((item, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex justify-end">
                <div className="bg-neutral-900 text-white text-xs sm:text-sm px-3.5 py-2 rounded-lg max-w-[85%]">
                  {item.q}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-neutral-50 border border-neutral-200 text-neutral-800 text-xs sm:text-sm px-3.5 py-2.5 rounded-lg max-w-[90%] relative group">
                  <p className="whitespace-pre-wrap leading-relaxed">{item.a}</p>
                  <button
                    onClick={() => copyAnswer(item.a, idx)}
                    className="absolute top-2 right-2 p-1 text-neutral-400 hover:text-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Copy answer"
                  >
                    {copiedIndex === idx ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-neutral-500 italic py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              CogniNote AI is thinking...
            </div>
          )}
        </div>

        <form onSubmit={handleAsk} className="p-4 border-t border-neutral-200 bg-neutral-50 flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type your question..."
            className="flex-1 px-3 py-2 text-xs sm:text-sm border border-neutral-300 rounded focus:outline-none focus:border-neutral-900 bg-white"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-medium rounded flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            Ask
          </button>
        </form>
      </div>
    </div>
  );
};
