import { supabase } from '../supabaseClient';
import { ConversationMessage, Profile, SemanticSearchResult } from '../types';

export const invokeTextToSpeech = async (text: string, languageCode: string, voiceId: string | null) => {
  if (!text) throw new Error("invokeTextToSpeech: No text provided.");

  const { data, error } = await supabase.functions.invoke('text-to-speech', {
    body: { text, languageCode, voiceId },
  });

  if (error) throw new Error(`TTS function invocation error: ${error.message}`);
  if (!data || !data.audioData) {
    throw new Error('Received invalid or empty audio data from server.');
  }

  const binaryString = window.atob(data.audioData);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const audioBuffer = bytes.buffer;

  return new Blob([audioBuffer], { type: 'audio/mpeg' });
};

export interface InvokeChatAiParams {
  userMessage?: string; // Optional for meta-reflection
  conversationHistory?: ConversationMessage[]; // Optional for meta-reflection
  languageCode: string;
  profile: Profile | null;
  metaContext?: {
    userQuery: string;
    relevantMemories: Array<{ content: string }>;
  };
}

export const invokeChatAi = async ({
  userMessage,
  conversationHistory,
  languageCode,
  profile,
  metaContext,
}: InvokeChatAiParams) => {
  const userProfilePayload = profile
    ? {
        fullName: profile.full_name,
        role: profile.role,
        goals: profile.goals,
      }
    : undefined;

  // Build the request body based on whether it's a standard chat or a meta-reflection
  const requestBody: any = {
    languageCode,
    userProfile: userProfilePayload,
  };

  if (metaContext) {
    // For meta-reflection, only the context is needed.
    requestBody.metaContext = metaContext;
  } else {
    // For a standard conversation, the user message and history are needed.
    requestBody.userMessage = userMessage;
    requestBody.conversationHistory = conversationHistory;
  }

  const { data, error } = await supabase.functions.invoke('chat-ai', {
    body: requestBody,
  });

  if (error || !data || !data.response) {
    const errorMessage = error ? error.message : 'Invalid or empty AI response.';
    throw new Error(errorMessage);
  }

  return data.response as string;
};

export const invokeTranscribe = async (audioBlob: Blob, languageCode: string) => {
  const base64Audio = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });

  const { data, error } = await supabase.functions.invoke('transcribe', {
    body: { audioContent: base64Audio, languageCode, encoding: 'WEBM_OPUS', sampleRateHertz: 48000, isLastChunk: true },
  });

  if (error) throw new Error(`Supabase final transcription error: ${error.message}`);
  
  return (data?.transcript || '') as string;
};

export const createConversation = async () => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated to create a conversation.');
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: user.id })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    throw new Error(error.message);
  }

  return data.id;
};

interface SaveMessagePayload {
  conversation_id: string;
  role: 'user' | 'model';
  parts: { text: string }[];
}

export const saveMessage = async (messageData: SaveMessagePayload) => {
  const { data, error } = await supabase.functions.invoke('add-message', {
    body: {
      conversation_id: messageData.conversation_id,
      role: messageData.role,
      text: messageData.parts.map(p => p.text).join('\n\n'), // Join parts into a single string
    },
  });

  if (error) {
    console.error('Error saving message via function:', error);
    throw new Error(error.message);
  }

  return data.message;
};

export const fetchConversations = async (searchTerm?: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('No user authenticated, returning empty array.');
    return [];
  }

  // Use !inner join to only get conversations that have matching messages if a search term is provided
  const selectStatement = searchTerm 
    ? 'id, created_at, summary, messages!inner(id, role, text, created_at)'
    : 'id, created_at, summary, messages(id, role, text, created_at)';

  let query = supabase
    .from('conversations')
    .select(selectStatement)
    .eq('user_id', user.id);

  if (searchTerm && searchTerm.trim() !== '') {
    query = query.ilike('messages.text', `%${searchTerm}%`);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching conversations:', error);
    throw new Error(error.message);
  }

  return data || [];
};

export const fetchConversationById = async (conversationId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('No user authenticated, returning null.');
    return null;
  }

  const { data, error } = await supabase
    .from('conversations')
    .select('id, created_at, summary, messages(id, role, text, created_at)')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error(`Error fetching conversation ${conversationId}:`, error);
    throw new Error(error.message);
  }

  return data;
};

export const summarizeConversation = async (conversationId: string) => {
  const { data, error } = await supabase.functions.invoke('summarize-conversation', {
    body: { conversationId },
  });

  if (error) {
    console.error('Error summarizing conversation:', error);
    throw new Error(error.message);
  }

  return data;
};

export const semanticSearch = async (query: string): Promise<SemanticSearchResult[]> => {
  if (!query || query.trim() === '') {
    // Devuelve un array vacío para no romper el flujo de la UI
    return [];
  }

  const { data, error } = await supabase.functions.invoke('semantic-search', {
    body: { query: query }, // Asegura que el cuerpo sea { query: "..." }
  });

  if (error) {
    console.error('Error invoking semantic-search:', error);
    throw new Error(`Semantic search failed: ${error.message}`);
  }

  if (!data || !data.matches) {
    console.error('Invalid response from semantic-search:', data);
    return [];
  }

  return data.matches as SemanticSearchResult[];
};
