import React from 'react';
import type { Note } from '../types/note';
import { Star, Sparkles, MoreVertical, Edit2, Trash2, Calendar, Eye, Clock } from 'lucide-react';
import { calculateReadingTime } from '../utils/readingTime';

interface NoteCardProps {
  note: Note;
  onSelect: (note: Note) => void;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  onToggleFavorite: (noteId: string, current: boolean) => void;
  onTagClick?: (tag: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  onSelect,
  onEdit,
  onDelete,
  onToggleFavorite,
  onTagClick,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Recent';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Truncate content preview to 3 lines
  const cleanContentPreview = note.content
    ? note.content
        .replace(/^#+\s/gm, '') // remove markdown heading signs
        .replace(/[*_`]/g, '') // remove basic markdown chars
        .trim()
    : 'No content yet...';

  const readingStats = calculateReadingTime(note.content || '');

  return (
    <div
      onClick={() => onSelect(note)}
      className="group relative flex flex-col justify-between p-5 bg-white hover:bg-[#FCFCFA] border border-neutral-200 hover:border-neutral-900 rounded-md transition-all duration-150 cursor-pointer shadow-xs hover:shadow-sm"
    >
      <div>
        {/* Top row: Title & Star / Menu */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h3 className="font-serif font-bold text-lg text-neutral-950 group-hover:text-black line-clamp-1 leading-snug">
              {note.title}
            </h3>
            {note.isDraft && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-50 text-amber-800 border border-amber-200">
                Draft
              </span>
            )}
          </div>

          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onToggleFavorite(note.id, note.isFavorite)}
              className="p-1 rounded text-neutral-300 hover:text-amber-500 transition-colors"
              title={note.isFavorite ? 'Unfavorite' : 'Favorite'}
            >
              <Star
                className={`w-4 h-4 ${
                  note.isFavorite ? 'fill-amber-400 text-amber-500' : 'text-neutral-300 group-hover:text-neutral-400'
                }`}
              />
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1 text-neutral-400 hover:text-neutral-800 rounded transition-colors"
                aria-label="Note options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-neutral-200 rounded shadow-lg py-1 z-30 text-xs">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onSelect(note);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 flex items-center gap-2 text-neutral-700"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onEdit(note);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 flex items-center gap-2 text-neutral-700"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete(note);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content snippet */}
        <p className="text-xs text-neutral-600 font-sans leading-relaxed line-clamp-3 mb-3.5">
          {cleanContentPreview}
        </p>

        {/* AI Summary Badge if present */}
        {note.summary && (
          <div className="mb-3.5 p-2 bg-neutral-50 border-l-2 border-neutral-800 rounded-r text-[11px] text-neutral-700 font-serif italic line-clamp-2">
            <span className="font-mono not-italic font-bold mr-1 text-[10px] uppercase text-neutral-500">
              AI:
            </span>
            {note.summary}
          </div>
        )}
      </div>

      <div>
        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {note.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                onClick={(e) => {
                  if (onTagClick) {
                    e.stopPropagation();
                    onTagClick(tag);
                  }
                }}
                className="inline-block px-2 py-0.5 text-[10px] font-mono bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded transition-colors"
              >
                #{tag}
              </span>
            ))}
            {note.tags.length > 3 && (
              <span className="text-[10px] font-mono text-neutral-400">
                +{note.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Card Footer: Timestamp & Reading Time */}
        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] font-mono text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(note.updatedAt || note.createdAt)}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-neutral-500" title={`Estimated reading time (${readingStats.wordCount} words)`}>
              <Clock className="w-3 h-3 text-neutral-400" />
              {readingStats.label}
            </span>
          </div>
          {note.summary && (
            <span
              className="inline-flex items-center gap-1 text-[10px] text-neutral-500 font-mono"
              title="Includes AI Summary"
            >
              <Sparkles className="w-2.5 h-2.5 text-neutral-700" />
              Summary
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
