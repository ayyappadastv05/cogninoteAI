import React from 'react';
import type { Note } from '../types/note';
import {
  FileText,
  Star,
  Tag,
  Hash,
  Sparkles,
  Layers,
  ChevronRight,
  X,
} from 'lucide-react';

interface SidebarProps {
  notes: Note[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  showFavoritesOnly: boolean;
  onToggleFavoritesOnly: (only: boolean) => void;
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  notes,
  selectedTag,
  onSelectTag,
  showFavoritesOnly,
  onToggleFavoritesOnly,
  isOpenOnMobile = false,
  onCloseMobile,
}) => {
  // Compute tag frequencies
  const tagCounts: Record<string, number> = {};
  let totalSummaries = 0;
  let totalFavorites = 0;

  notes.forEach((note) => {
    if (note.summary) totalSummaries++;
    if (note.isFavorite) totalFavorites++;
    note.tags?.forEach((t) => {
      const clean = t.trim();
      if (clean) {
        tagCounts[clean] = (tagCounts[clean] || 0) + 1;
      }
    });
  });

  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

  const content = (
    <aside className="w-64 h-full flex flex-col justify-between py-6 px-4 bg-white border-r border-neutral-200 select-none">
      <div className="space-y-6">
        {/* Mobile close button */}
        {onCloseMobile && (
          <div className="flex md:hidden items-center justify-between pb-2 border-b border-neutral-100">
            <span className="font-serif font-bold text-sm">Navigation</span>
            <button
              onClick={onCloseMobile}
              className="p-1 text-neutral-400 hover:text-neutral-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Primary Views */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold px-2">
            Workspace
          </span>
          <nav className="mt-2 space-y-1 text-xs">
            <button
              onClick={() => {
                onToggleFavoritesOnly(false);
                onSelectTag(null);
                onCloseMobile?.();
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded font-medium transition-colors ${
                !showFavoritesOnly && !selectedTag
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <span className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                All Notes
              </span>
              <span
                className={`text-[11px] font-mono px-1.5 py-0.2 rounded ${
                  !showFavoritesOnly && !selectedTag
                    ? 'bg-neutral-800 text-neutral-300'
                    : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                {notes.length}
              </span>
            </button>

            <button
              onClick={() => {
                onToggleFavoritesOnly(true);
                onSelectTag(null);
                onCloseMobile?.();
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded font-medium transition-colors ${
                showFavoritesOnly && !selectedTag
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <span className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                Favorites
              </span>
              <span
                className={`text-[11px] font-mono px-1.5 py-0.2 rounded ${
                  showFavoritesOnly && !selectedTag
                    ? 'bg-neutral-800 text-neutral-300'
                    : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                {totalFavorites}
              </span>
            </button>
          </nav>
        </div>

        {/* Tags Section */}
        <div>
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold flex items-center gap-1">
              <Hash className="w-3 h-3" /> Tags
            </span>
            {selectedTag && (
              <button
                onClick={() => onSelectTag(null)}
                className="text-[10px] text-neutral-400 hover:text-neutral-900 underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto space-y-0.5 text-xs pr-1">
            {sortedTags.length === 0 ? (
              <p className="text-[11px] text-neutral-400 italic px-2 py-2">
                No tags added yet. Use AI tags or type #tag in any note!
              </p>
            ) : (
              sortedTags.map(([tag, count]) => {
                const isActive = selectedTag?.toLowerCase() === tag.toLowerCase();
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      onToggleFavoritesOnly(false);
                      onSelectTag(isActive ? null : tag);
                      onCloseMobile?.();
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors text-left ${
                      isActive
                        ? 'bg-neutral-900 text-white font-medium'
                        : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    <span className="truncate flex items-center gap-1 font-mono text-[11px]">
                      <span>#</span>
                      <span className="truncate">{tag}</span>
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 rounded ${
                        isActive
                          ? 'bg-neutral-800 text-neutral-300'
                          : 'bg-neutral-100 text-neutral-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Footer Stats / Minimalist Indicator & Creator Credit */}
      <div className="pt-4 border-t border-neutral-100 text-[11px] font-mono text-neutral-400 space-y-1.5">
        <div className="flex justify-between items-center px-1">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-neutral-500" /> AI Summaries
          </span>
          <span className="font-semibold text-neutral-700">{totalSummaries}</span>
        </div>
        <div className="flex justify-between items-center px-1">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-neutral-500" /> Total Notes
          </span>
          <span className="font-semibold text-neutral-700">{notes.length}</span>
        </div>
        <div className="pt-2 px-1 text-[10px] text-neutral-400 border-t border-neutral-100">
          Created by <strong className="text-neutral-700 font-semibold">AYYAPPADAS TV</strong>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop static sidebar */}
      <div className="hidden md:block shrink-0">{content}</div>

      {/* Mobile drawer */}
      {isOpenOnMobile && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-50 animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
