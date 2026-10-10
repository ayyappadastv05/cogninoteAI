export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  summary?: string;
  tags: string[];
  isFavorite: boolean;
  isDraft?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  isAnonymous?: boolean;
}

export type SpeechState = 'idle' | 'listening' | 'error' | 'unsupported';

export interface AiActionState {
  summarizing: boolean;
  suggestingTags: boolean;
  generatingTitle: boolean;
  improving: boolean;
  asking: boolean;
}
