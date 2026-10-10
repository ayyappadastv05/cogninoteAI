import React from 'react';
import { PenTool, Mic, Plus, Search } from 'lucide-react';

interface EmptyStateProps {
  isFiltering: boolean;
  onClearFilters: () => void;
  onNewNote: () => void;
  onVoiceNote: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  isFiltering,
  onClearFilters,
  onNewNote,
  onVoiceNote,
}) => {
  if (isFiltering) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-12 h-12 rounded-full border border-neutral-200 bg-white flex items-center justify-center text-neutral-400 mb-3 shadow-2xs">
          <Search className="w-5 h-5" />
        </div>
        <h3 className="font-serif font-bold text-lg text-neutral-900 mb-1">
          No matching notes found
        </h3>
        <p className="text-xs text-neutral-500 max-w-sm mb-4">
          Try adjusting your search query, clearing tag filters, or creating a new note.
        </p>
        <button
          onClick={onClearFilters}
          className="px-4 py-2 border border-neutral-300 hover:border-neutral-900 text-neutral-800 text-xs font-medium rounded transition-colors"
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-full border border-neutral-300 bg-white flex items-center justify-center text-neutral-800 mb-4 shadow-xs">
        <PenTool className="w-7 h-7" />
      </div>
      <h3 className="font-serif font-bold text-xl sm:text-2xl text-neutral-950 mb-2">
        Your digital notebook is waiting
      </h3>
      <p className="text-xs sm:text-sm text-neutral-500 max-w-md mb-6 leading-relaxed">
        Capture fast thoughts, tech snippets, and ideas. Write manually or speak out loud, and let InkNote AI summarize, tag, and structure your notes.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onNewNote}
          className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs sm:text-sm font-medium rounded flex items-center gap-2 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Create First Note
        </button>
        <button
          onClick={onVoiceNote}
          className="px-4 py-2.5 border border-neutral-300 hover:border-neutral-900 bg-white text-neutral-800 text-xs sm:text-sm font-medium rounded flex items-center gap-2 transition-colors"
        >
          <Mic className="w-4 h-4 text-neutral-700" />
          Record Voice Note
        </button>
      </div>
    </div>
  );
};
