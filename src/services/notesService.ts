import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import type { Note } from '../types/note';

const NOTES_STORAGE_PREFIX = 'cogninote_notes_';

function getLocalNotes(userId: string): Note[] {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_PREFIX + userId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalNotes(userId: string, notes: Note[]) {
  try {
    localStorage.setItem(NOTES_STORAGE_PREFIX + userId, JSON.stringify(notes));
    window.dispatchEvent(new Event('cogninote_local_notes_updated'));
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
}

function isLocalUser(userId: string): boolean {
  if (!userId) return true;
  if (userId.startsWith('usr_') || userId.startsWith('guest_') || userId.startsWith('local_')) {
    return true;
  }
  return !auth.currentUser || auth.currentUser.uid !== userId;
}

export function subscribeNotes(
  userId: string,
  onUpdate: (notes: Note[]) => void,
  onError?: (err: Error) => void
) {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  // Handle local user or guest or non-Firebase session
  if (isLocalUser(userId)) {
    const emit = () => {
      const notes = getLocalNotes(userId);
      notes.sort((a, b) => {
        const timeA = typeof a.updatedAt === 'number' ? a.updatedAt : 0;
        const timeB = typeof b.updatedAt === 'number' ? b.updatedAt : 0;
        return timeB - timeA;
      });
      onUpdate(notes);
    };

    emit();
    const handler = () => emit();
    window.addEventListener('cogninote_local_notes_updated', handler);
    window.addEventListener('storage', handler);

    return () => {
      window.removeEventListener('cogninote_local_notes_updated', handler);
      window.removeEventListener('storage', handler);
    };
  }

  // Handle authenticated Firestore user
  try {
    const notesRef = collection(db, 'notes');
    const q = query(notesRef, where('userId', '==', userId));

    return onSnapshot(
      q,
      (snapshot) => {
        const notes: Note[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            userId: data.userId,
            title: data.title || 'Untitled Note',
            content: data.content || '',
            summary: data.summary || '',
            tags: Array.isArray(data.tags) ? data.tags : [],
            isFavorite: !!data.isFavorite,
            isDraft: !!data.isDraft,
            createdAt: data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
            updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || Date.now(),
          };
        });

        // Sort client-side by updatedAt descending
        notes.sort((a, b) => {
          const timeA = typeof a.updatedAt === 'number' ? a.updatedAt : 0;
          const timeB = typeof b.updatedAt === 'number' ? b.updatedAt : 0;
          return timeB - timeA;
        });

        onUpdate(notes);
      },
      (err) => {
        console.warn('Firestore onSnapshot error, falling back to local store:', err);
        // Fall back gracefully to local notes so UI never freezes or displays error
        const local = getLocalNotes(userId);
        onUpdate(local);
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    console.warn('Could not establish Firestore listener:', err);
    onUpdate(getLocalNotes(userId));
    return () => {};
  }
}

export async function createNote(
  userId: string,
  data: {
    title: string;
    content: string;
    tags: string[];
    summary?: string;
    isFavorite?: boolean;
    isDraft?: boolean;
  }
): Promise<string> {
  const isLocal = isLocalUser(userId);

  if (isLocal) {
    const list = getLocalNotes(userId);
    const id = 'note_' + Math.random().toString(36).substring(2, 10);
    const newNote: Note = {
      id,
      userId,
      title: data.title.trim() || 'Untitled Note',
      content: data.content,
      tags: data.tags.map((t) => t.replace(/^#/, '').trim()).filter(Boolean),
      summary: data.summary || '',
      isFavorite: !!data.isFavorite,
      isDraft: !!data.isDraft,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    list.unshift(newNote);
    saveLocalNotes(userId, list);
    return id;
  }

  try {
    const notesRef = collection(db, 'notes');
    const docRef = await addDoc(notesRef, {
      userId,
      title: data.title.trim() || 'Untitled Note',
      content: data.content,
      tags: data.tags.map((t) => t.replace(/^#/, '').trim()).filter(Boolean),
      summary: data.summary || '',
      isFavorite: !!data.isFavorite,
      isDraft: !!data.isDraft,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    // If Firestore fails, save to local store as backup
    const list = getLocalNotes(userId);
    const id = 'note_' + Math.random().toString(36).substring(2, 10);
    const newNote: Note = {
      id,
      userId,
      title: data.title.trim() || 'Untitled Note',
      content: data.content,
      tags: data.tags.map((t) => t.replace(/^#/, '').trim()).filter(Boolean),
      summary: data.summary || '',
      isFavorite: !!data.isFavorite,
      isDraft: !!data.isDraft,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    list.unshift(newNote);
    saveLocalNotes(userId, list);
    return id;
  }
}

export async function updateNote(
  noteId: string,
  data: {
    title?: string;
    content?: string;
    tags?: string[];
    summary?: string;
    isFavorite?: boolean;
    isDraft?: boolean;
  }
): Promise<void> {
  // Check local note stores first
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(NOTES_STORAGE_PREFIX)) {
      const userId = key.replace(NOTES_STORAGE_PREFIX, '');
      const list = getLocalNotes(userId);
      const idx = list.findIndex((n) => n.id === noteId);
      if (idx !== -1) {
        const target = list[idx];
        if (data.title !== undefined) target.title = data.title.trim() || 'Untitled Note';
        if (data.content !== undefined) target.content = data.content;
        if (data.tags !== undefined) {
          target.tags = data.tags.map((t) => t.replace(/^#/, '').trim()).filter(Boolean);
        }
        if (data.summary !== undefined) target.summary = data.summary;
        if (data.isFavorite !== undefined) target.isFavorite = data.isFavorite;
        if (data.isDraft !== undefined) target.isDraft = data.isDraft;
        target.updatedAt = Date.now();
        saveLocalNotes(userId, list);
        return;
      }
    }
  }

  try {
    const noteRef = doc(db, 'notes', noteId);
    const updatePayload: any = {
      updatedAt: serverTimestamp(),
    };

    if (data.title !== undefined) updatePayload.title = data.title.trim() || 'Untitled Note';
    if (data.content !== undefined) updatePayload.content = data.content;
    if (data.tags !== undefined) {
      updatePayload.tags = data.tags.map((t) => t.replace(/^#/, '').trim()).filter(Boolean);
    }
    if (data.summary !== undefined) updatePayload.summary = data.summary;
    if (data.isFavorite !== undefined) updatePayload.isFavorite = data.isFavorite;
    if (data.isDraft !== undefined) updatePayload.isDraft = data.isDraft;

    await updateDoc(noteRef, updatePayload);
  } catch (err) {
    console.warn('Update doc error:', err);
  }
}

export async function deleteNote(noteId: string): Promise<void> {
  // Check local note stores first
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(NOTES_STORAGE_PREFIX)) {
      const userId = key.replace(NOTES_STORAGE_PREFIX, '');
      const list = getLocalNotes(userId);
      const filtered = list.filter((n) => n.id !== noteId);
      if (filtered.length !== list.length) {
        saveLocalNotes(userId, filtered);
        return;
      }
    }
  }

  try {
    const noteRef = doc(db, 'notes', noteId);
    await deleteDoc(noteRef);
  } catch (err) {
    console.warn('Delete doc error:', err);
  }
}

export async function toggleFavorite(noteId: string, currentFavorite: boolean): Promise<void> {
  await updateNote(noteId, { isFavorite: !currentFavorite });
}

// Seed starter notes for new users
export async function seedStarterNotes(userId: string): Promise<void> {
  const starter1 = {
    title: 'Welcome to CogniNote AI 🧠',
    content: `CogniNote AI is your intelligent thought canvas engineered for speed, focus, and clarity.\n\n*Created by AYYAPPADAS TV*\n\n### How to get the most out of CogniNote:\n• 🎙 **Voice-to-Text**: Click the mic icon to transcribe your thoughts instantly.\n• ✨ **AI Summarize**: Extract crisp key points from lengthy notes with Gemini.\n• 🏷️ **AI Tags**: Auto-categorize your ideas into smart indexes.\n• 💡 **AI Title**: Let Gemini generate a punchy title from your raw thoughts.\n• 🪄 **AI Improve**: Restructure messy brain dumps into clear, formatted markdown.`,
    tags: ['GettingStarted', 'CogniNote', 'Productivity'],
    summary: 'An introduction to CogniNote AI created by AYYAPPADAS TV, featuring voice input, smart tagging, and Gemini AI writing tools.',
    isFavorite: true,
  };

  const starter2 = {
    title: 'Learning Django REST Framework',
    content: `Today I explored Django REST Framework (DRF) architecture:\n\n1. **Serializers**: Convert complex queryset and model instances into Python native datatypes that can easily be rendered into JSON/XML.\n2. **Views & ViewSets**: Provide business logic and CRUD handlers (APIView vs ModelViewSet).\n3. **Authentication**: JWT authentication using SimpleJWT ensures stateless security across client and server.\n4. **Permissions**: IsAuthenticated, IsAdminUser, or custom permission classes.`,
    tags: ['Django', 'Python', 'Backend', 'API'],
    summary: 'Django REST Framework provides serializers, viewsets, JWT authentication, and permissions for scalable backend API development.',
    isFavorite: false,
  };

  await createNote(userId, starter1);
  await createNote(userId, starter2);
}
