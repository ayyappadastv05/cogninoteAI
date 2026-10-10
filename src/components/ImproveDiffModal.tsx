import React from 'react';
import { X, Check, ArrowRight, Wand2 } from 'lucide-react';

interface ImproveDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalContent: string;
  improvedContent: string;
  onAccept: (improved: string) => void;
}

export const ImproveDiffModal: React.FC<ImproveDiffModalProps> = ({
  isOpen,
  onClose,
  originalContent,
  improvedContent,
  onAccept,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white border border-neutral-300 shadow-2xl rounded-md overflow-hidden text-neutral-900">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center">
              <Wand2 className="w-3.5 h-3.5 text-neutral-800" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-neutral-950">
                AI Note Improvement
              </h3>
              <p className="text-xs text-neutral-500">
                Review the restructured draft before applying changes.
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

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Original Content */}
          <div className="flex flex-col border border-neutral-200 rounded-md overflow-hidden bg-neutral-50">
            <div className="px-3.5 py-2 border-b border-neutral-200 bg-neutral-100/70 flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-neutral-600 font-semibold">
                Original Draft
              </span>
              <span className="text-[11px] text-neutral-400">Current</span>
            </div>
            <div className="p-4 flex-1 overflow-y-auto text-xs sm:text-sm text-neutral-700 whitespace-pre-wrap font-sans">
              {originalContent || <span className="italic text-neutral-400">Empty</span>}
            </div>
          </div>

          {/* Improved Content */}
          <div className="flex flex-col border border-neutral-900 rounded-md overflow-hidden bg-white shadow-xs">
            <div className="px-3.5 py-2 border-b border-neutral-900 bg-neutral-900 text-white flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-white font-semibold flex items-center gap-1.5">
                <Wand2 className="w-3 h-3 text-neutral-300" />
                AI Suggested Version
              </span>
              <span className="text-[11px] text-neutral-300">Enhanced</span>
            </div>
            <div className="p-4 flex-1 overflow-y-auto text-xs sm:text-sm text-neutral-900 whitespace-pre-wrap font-sans leading-relaxed">
              {improvedContent}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-neutral-300 hover:bg-neutral-100 text-neutral-700 text-xs font-medium rounded transition-colors"
          >
            Keep Original
          </button>
          <button
            onClick={() => {
              onAccept(improvedContent);
              onClose();
            }}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium rounded flex items-center gap-1.5 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Apply AI Improvement
          </button>
        </div>
      </div>
    </div>
  );
};
