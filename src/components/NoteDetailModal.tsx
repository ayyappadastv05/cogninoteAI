import React, { useState } from 'react';
import type { Note } from '../types/note';
import { summarizeNote } from '../services/aiClient';
import { updateNote } from '../services/notesService';
import { useToast } from './Toast';
import {
  X,
  Edit3,
  Trash2,
  Sparkles,
  Star,
  Calendar,
  MessageSquare,
  Check,
  Copy,
  Loader2,
  Clock,
} from 'lucide-react';
import { calculateReadingTime } from '../utils/readingTime';

interface NoteDetailModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  onToggleFavorite: (noteId: string, current: boolean) => void;
  onOpenAskModal: (note: Note) => void;
}

export const NoteDetailModal: React.FC<NoteDetailModalProps> = ({
  note,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onToggleFavorite,
  onOpenAskModal,
}) => {
  const { showToast } = useToast();
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState(note?.summary || '');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !note) return null;

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Recent';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleGenerateSummary = async () => {
    if (!note.content.trim()) {
      showToast('Note has no content to summarize.', 'error');
      return;
    }

    setIsSummarizing(true);
    try {
      const generated = await summarizeNote(note.content, note.title);
      setSummary(generated);
      // Persist summary to note in Firestore
      await updateNote(note.id, { summary: generated });
      showToast('AI summary generated and saved!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'AI service is currently unavailable. Please try again.', 'error');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(note.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Copied note to clipboard', 'info');
  };

  const readingStats = calculateReadingTime(note.content || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#FDFDFB] border border-neutral-300 shadow-2xl rounded-md overflow-hidden text-neutral-900">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleFavorite(note.id, note.isFavorite)}
              className="p-1 rounded text-neutral-400 hover:text-amber-500 transition-colors"
              title={note.isFavorite ? 'Unstar note' : 'Star note'}
            >
              <Star
                className={`w-4 h-4 ${
                  note.isFavorite ? 'fill-amber-400 text-amber-500' : 'text-neutral-400'
                }`}
              />
            </button>
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">
              Note View
            </span>
            {note.isDraft && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-50 text-amber-800 border border-amber-200">
                Draft
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyContent}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded hover:bg-neutral-100 transition-colors"
              title="Copy note text"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded hover:bg-neutral-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6">
          {/* Note Title & Timestamps */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-950 tracking-tight leading-snug">
              {note.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono text-neutral-500 mt-3 pt-2 border-t border-neutral-100">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                Created: {formatDate(note.createdAt)}
              </span>
              <span>•</span>
              <span>Updated: {formatDate(note.updatedAt)}</span>
              <span>•</span>
              <span
                className="flex items-center gap-1.5 text-neutral-800 bg-neutral-100/90 px-2 py-0.5 rounded border border-neutral-200/70"
                title={`Calculated at ~200 words/min (${readingStats.wordCount} words)`}
              >
                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                {readingStats.label}
              </span>
              <span className="text-neutral-400">({readingStats.wordCount} words)</span>
            </div>
          </div>

          <div className="border-t border-neutral-200" />

          {/* AI Summary Box (if present or active) */}
          {(summary || note.summary || isSummarizing) && (
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-neutral-700 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-neutral-700" />
                  AI Summary
                </span>
                <button
                  disabled={isSummarizing}
                  onClick={handleGenerateSummary}
                  className="text-[11px] text-neutral-500 hover:text-neutral-900 underline flex items-center gap-1"
                >
                  {isSummarizing ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Regenerating...
                    </>
                  ) : (
                    'Regenerate'
                  )}
                </button>
              </div>
              <p className="text-sm text-neutral-700 font-serif italic leading-relaxed">
                {isSummarizing ? 'Synthesizing key insights from this note...' : summary || note.summary}
              </p>
            </div>
          )}

          {/* Note Body Content */}
          <div className="text-sm sm:text-base text-neutral-800 leading-relaxed font-sans whitespace-pre-wrap selection:bg-neutral-200">
            {note.content}
          </div>

          <div className="border-t border-neutral-200" />

          {/* Tags */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {note.tags && note.tags.length > 0 ? (
                note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 py-1 rounded bg-neutral-100 border border-neutral-200 text-xs font-mono text-neutral-700"
                  >
                    #{tag}
                  </span>
                ))
              ) : (
                <span className="text-xs text-neutral-400 italic font-mono">No tags assigned</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions as per PRD */}
        <div className="px-6 py-4 border-t border-neutral-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAskModal(note)}
              className="px-3 py-1.5 border border-neutral-300 hover:border-neutral-900 text-neutral-700 text-xs font-medium rounded flex items-center gap-1.5 transition-colors"
              title="Ask AI questions about this note"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Ask Note
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(note)}
              className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium rounded flex items-center gap-1.5 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>

            {!(summary || note.summary) && (
              <button
                disabled={isSummarizing}
                onClick={handleGenerateSummary}
                className="px-3 py-1.5 border border-neutral-300 hover:border-neutral-900 text-neutral-800 text-xs font-medium rounded flex items-center gap-1.5 transition-colors"
              >
                {isSummarizing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-neutral-600" />
                )}
                AI Summary
              </button>
            )}

            <button
              onClick={() => onDelete(note)}
              className="px-3 py-1.5 text-red-600 hover:bg-red-50 text-xs font-medium rounded border border-transparent hover:border-red-200 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
