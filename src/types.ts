export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  goals: string | null;
  timezone: string | null;
  preferred_language?: 'en-US' | 'es-AR';
  preferred_voice_id?: string | null;
  onboarding_completed: boolean | null;
}

export interface ConversationMessage {
  id?: string; // Optional client-side ID for list rendering
  role: 'user' | 'model';
  parts: { text: string }[];
  timestamp?: string; // Optional because we don't have it when creating a new message
}

export interface SemanticSearchResult {
  id: string; // Message ID
  conversation_id: string;
  content: string;
  role: 'user' | 'model';
  created_at: string;
  relevance: number;
}

export interface MetaReflectionRequest {
  userQuery: string;
  relevantMemories: SemanticSearchResult[];
}

export interface RecordingState {
  isRecording: boolean;
  isProcessing: boolean;
  isAiThinking: boolean;
  isGeneratingAudio: boolean;
  isPlayingAudio: boolean;
  hasPermission: boolean;
  permissionDenied: boolean;
  error: string;
  status: string;
  recordingDuration: number;
  audioLevel: number;
}
