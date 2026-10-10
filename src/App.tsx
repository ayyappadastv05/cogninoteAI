import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AuthProvider, useAuth, type AppUser } from './context/AuthContext';
import { ToastProvider, useToast } from './components/Toast';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { NoteCard } from './components/NoteCard';
import { NoteEditorModal } from './components/NoteEditorModal';
import { NoteDetailModal } from './components/NoteDetailModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { AskNoteModal } from './components/AskNoteModal';
import { AuthModal } from './components/AuthModal';
import { LoginPage } from './components/LoginPage';
import { EmptyState } from './components/EmptyState';
import {
  subscribeNotes,
  createNote,
  updateNote,
  deleteNote,
  toggleFavorite,
  seedStarterNotes,
} from './services/notesService';
import type { Note } from './types/note';
import {
  Plus,
  ArrowUpDown,
  X,
  Loader2,
  Brain,
} from 'lucide-react';

interface CogniNoteMainProps {
  user: AppUser;
}

function CogniNoteMain({ user }: CogniNoteMainProps) {
  const { showToast } = useToast();

  // All states
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<'updated' | 'created' | 'title'>('updated');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Modals
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [deletingNote, setDeletingNote] = useState<Note | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [askingNote, setAskingNote] = useState<Note | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Seed tracker
  const hasCheckedSeed = useRef(false);

  // Subscribe to real-time notes
  useEffect(() => {
    setLoadingNotes(true);
    const unsubscribe = subscribeNotes(
      user.uid,
      async (fetchedNotes) => {
        setNotes(fetchedNotes);
        setLoadingNotes(false);

        // Auto-seed welcoming starter notes if user has 0 notes
        if (fetchedNotes.length === 0 && !hasCheckedSeed.current) {
          hasCheckedSeed.current = true;
          try {
            await seedStarterNotes(user.uid);
          } catch (e) {
            console.warn('Starter seed skipped:', e);
          }
        }
      },
      (err) => {
        console.error('Notes subscription error:', err);
        setLoadingNotes(false);
        showToast('Unable to load notes. Check your connection.', 'error');
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  // Filtered & Sorted notes
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    // Search query: matches title, content, or tags
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Selected Tag
    if (selectedTag) {
      result = result.filter((n) =>
        n.tags?.some((t) => t.toLowerCase() === selectedTag.toLowerCase())
      );
    }

    // Favorites only
    if (showFavoritesOnly) {
      result = result.filter((n) => n.isFavorite);
    }

    // Sort order
    result.sort((a, b) => {
      if (sortOrder === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortOrder === 'created') {
        const timeA = typeof a.createdAt === 'number' ? a.createdAt : 0;
        const timeB = typeof b.createdAt === 'number' ? b.createdAt : 0;
        return timeB - timeA;
      }
      // default: updated
      const timeA = typeof a.updatedAt === 'number' ? a.updatedAt : 0;
      const timeB = typeof b.updatedAt === 'number' ? b.updatedAt : 0;
      return timeB - timeA;
    });

    return result;
  }, [notes, searchQuery, selectedTag, showFavoritesOnly, sortOrder]);

  // Note actions
  const handleSaveNote = async (
    data: {
      title: string;
      content: string;
      tags: string[];
      summary?: string;
      isFavorite?: boolean;
      isDraft?: boolean;
    },
    targetNoteId?: string | null
  ): Promise<string> => {
    const idToUpdate = targetNoteId || editingNote?.id;
    if (idToUpdate) {
      await updateNote(idToUpdate, data);
      if (viewingNote?.id === idToUpdate) {
        setViewingNote((prev) => (prev ? { ...prev, ...data } : null));
      }
      return idToUpdate;
    } else {
      const newId = await createNote(user.uid, data);
      return newId;
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingNote) return;
    setIsDeleting(true);
    try {
      await deleteNote(deletingNote.id);
      showToast('Note deleted.', 'info');
      if (viewingNote?.id === deletingNote.id) {
        setViewingNote(null);
      }
      setDeletingNote(null);
    } catch (err: any) {
      console.error(err);
      showToast('Unable to delete note.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleFav = async (noteId: string, current: boolean) => {
    try {
      await toggleFavorite(noteId, current);
      if (viewingNote?.id === noteId) {
        setViewingNote((prev) => (prev ? { ...prev, isFavorite: !current } : null));
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating favorite state.', 'error');
    }
  };

  const isFiltering = !!(searchQuery || selectedTag || showFavoritesOnly);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedTag(null);
    setShowFavoritesOnly(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F7F4] text-neutral-900 font-sans">
      {/* Top Navigation */}
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewNote={() => {
          setEditingNote(null);
          setIsEditorOpen(true);
        }}
        onVoiceQuickNote={() => {
          setEditingNote(null);
          setIsEditorOpen(true);
        }}
        onOpenAuth={() => setIsAuthOpen(true)}
        onToggleSidebar={() => setMobileSidebarOpen(true)}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Left Sidebar */}
        <Sidebar
          notes={notes}
          selectedTag={selectedTag}
          onSelectTag={setSelectedTag}
          showFavoritesOnly={showFavoritesOnly}
          onToggleFavoritesOnly={setShowFavoritesOnly}
          isOpenOnMobile={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        {/* Notes Grid & Content View */}
        <main className="flex-1 px-4 sm:px-8 py-6 overflow-y-auto">
          {/* Subheader Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-neutral-200">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif font-bold text-xl sm:text-2xl text-neutral-950">
                  {selectedTag ? (
                    <span className="flex items-center gap-1">
                      <span className="font-mono text-neutral-400">#</span>
                      {selectedTag}
                    </span>
                  ) : showFavoritesOnly ? (
                    'Favorite Notes'
                  ) : searchQuery ? (
                    'Search Results'
                  ) : (
                    'All Notes'
                  )}
                </h2>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700">
                  {filteredNotes.length}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                {selectedTag
                  ? `Showing notes categorized under #${selectedTag}`
                  : showFavoritesOnly
                  ? 'Your starred, high-priority notes'
                  : searchQuery
                  ? `Matching query: "${searchQuery}"`
                  : 'Intelligent canvas for thoughts, technical notes, and ideas'}
              </p>
            </div>

            {/* Filter pills & Sort selector */}
            <div className="flex flex-wrap items-center gap-2">
              {isFiltering && (
                <button
                  onClick={clearAllFilters}
                  className="px-2.5 py-1 text-xs border border-neutral-300 hover:border-neutral-900 rounded bg-white text-neutral-700 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" /> Clear filters
                </button>
              )}

              {/* Sort Order */}
              <div className="flex items-center border border-neutral-300 rounded bg-white text-xs px-2 py-1">
                <ArrowUpDown className="w-3 h-3 text-neutral-500 mr-1.5" />
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="bg-transparent focus:outline-none text-neutral-800 font-medium cursor-pointer"
                >
                  <option value="updated">Recently Updated</option>
                  <option value="created">Recently Created</option>
                  <option value="title">Title (A-Z)</option>
                </select>
              </div>

              {/* New note button */}
              <button
                onClick={() => {
                  setEditingNote(null);
                  setIsEditorOpen(true);
                }}
                className="hidden sm:flex px-3 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-xs font-medium items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Note</span>
              </button>
            </div>
          </div>

          {/* Active Tag Filter Banner */}
          {selectedTag && (
            <div className="mb-6 p-3 bg-neutral-100 border border-neutral-300 rounded-md flex items-center justify-between text-xs">
              <span className="font-mono text-neutral-800 font-semibold">
                Filtering by tag: <span className="underline">#{selectedTag}</span>
              </span>
              <button
                onClick={() => setSelectedTag(null)}
                className="text-neutral-500 hover:text-neutral-900 underline font-mono cursor-pointer"
              >
                View all notes
              </button>
            </div>
          )}

          {/* Notes Grid */}
          {loadingNotes ? (
            <div className="flex items-center justify-center py-24 text-neutral-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-sm font-mono">Loading your notes...</span>
            </div>
          ) : filteredNotes.length === 0 ? (
            <EmptyState
              isFiltering={isFiltering}
              onClearFilters={clearAllFilters}
              onNewNote={() => {
                setEditingNote(null);
                setIsEditorOpen(true);
              }}
              onVoiceNote={() => {
                setEditingNote(null);
                setIsEditorOpen(true);
              }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onSelect={(n) => setViewingNote(n)}
                  onEdit={(n) => {
                    setEditingNote(n);
                    setIsEditorOpen(true);
                  }}
                  onDelete={(n) => setDeletingNote(n)}
                  onToggleFavorite={handleToggleFav}
                  onTagClick={(tag) => setSelectedTag(tag)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Floating Action Button on Mobile */}
      <button
        onClick={() => {
          setEditingNote(null);
          setIsEditorOpen(true);
        }}
        className="sm:hidden fixed bottom-6 right-6 w-12 h-12 bg-neutral-900 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-neutral-800 z-30 cursor-pointer"
        aria-label="New Note"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Modals */}
      <NoteEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingNote(null);
        }}
        onSave={handleSaveNote}
        initialNote={editingNote}
      />

      <NoteDetailModal
        note={viewingNote}
        isOpen={!!viewingNote}
        onClose={() => setViewingNote(null)}
        onEdit={(note) => {
          setViewingNote(null);
          setEditingNote(note);
          setIsEditorOpen(true);
        }}
        onDelete={(note) => {
          setDeletingNote(note);
        }}
        onToggleFavorite={handleToggleFav}
        onOpenAskModal={(note) => setAskingNote(note)}
      />

      <DeleteConfirmModal
        isOpen={!!deletingNote}
        onClose={() => setDeletingNote(null)}
        onConfirm={handleConfirmDelete}
        title={deletingNote?.title}
        loading={isDeleting}
      />

      <AskNoteModal
        note={askingNote}
        isOpen={!!askingNote}
        onClose={() => setAskingNote(null)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  );
}

function AppContent() {
  const { currentUser, loading: authLoading } = useAuth();

  // 1. If auth is loading, render clean spinner
  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F8F7F4] text-neutral-900">
        <div className="w-10 h-10 rounded bg-neutral-950 text-white flex items-center justify-center shadow-xs mb-3 animate-pulse">
          <Brain className="w-5 h-5" />
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-neutral-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Starting CogniNote AI...</span>
        </div>
      </div>
    );
  }

  // 2. If not authenticated, render the dedicated Authentication page
  if (!currentUser) {
    return <LoginPage />;
  }

  // 3. User is authenticated -> Render main dashboard (all hooks in CogniNoteMain run unconditionally)
  return <CogniNoteMain user={currentUser} />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
