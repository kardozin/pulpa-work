export interface Profile {
  id?: string;
  created_at?: string;
  full_name?: string | null;
  role?: string | null;
  goals?: string | null;
  timezone?: string | null;
  onboarding_completed?: boolean | null;
  preferred_language?: 'es-AR' | 'en-US' | null;
  preferred_voice_id?: string | null;
}

export interface ConversationMessage {
  id: string;
  conversation_id?: string; // To associate message with a conversation
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
  text?: string; // Optional flattened text for convenience
  timestamp?: string;
}

export interface SearchResult {
  id: number;
  content: string;
  created_at: string;
  role: 'user' | 'model';
  similarity: number;
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
