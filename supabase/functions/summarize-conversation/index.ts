import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@^2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
  }>;
  promptFeedback?: {
    blockReason: string;
    safetyRatings: Array<any>;
  };
}

async function callGeminiForSummary(conversationText: string, apiKey: string, languageCode: string = 'es-AR'): Promise<string> {
  const isSpanish = languageCode.startsWith('es');
  
  const prompt = isSpanish 
    ? `Resume la siguiente conversación de autorreflexión en una única frase concisa e reveladora que capture la esencia del descubrimiento del usuario. El resumen debe ser en primera persona, desde la perspectiva del usuario. Conversación: ${conversationText}`
    : `Summarize the following self-reflection conversation in a single concise and revealing sentence that captures the essence of the user's discovery. The summary should be in first person, from the user's perspective. Conversation: ${conversationText}`;

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 150,
    },
  };

  const model_id = 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model_id}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Gemini API Error: ${response.status} ${response.statusText}`, errorBody);
    throw new Error(`Gemini API request failed: ${response.statusText}`);
  }

  const data: GeminiResponse = await response.json();

  if (data.candidates && data.candidates[0]?.content.parts[0]?.text) {
    return data.candidates[0].content.parts[0].text.trim();
  } else {
    if (data.promptFeedback?.blockReason) {
      throw new Error(`Request blocked by Gemini due to: ${data.promptFeedback.blockReason}`);
    }
    throw new Error('Failed to generate summary from Gemini.');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { conversationId } = await req.json();
    if (!conversationId) {
      return new Response(JSON.stringify({ error: 'conversationId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the conversation belongs to the user
    const { data: conversation, error: convError } = await supabaseClient
      .from('conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get messages for the conversation
    const { data: messages, error: messagesError } = await supabaseClient
      .from('messages')
      .select('role, text')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      throw new Error(`Failed to fetch messages: ${messagesError.message}`);
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No messages found for this conversation' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's preferred language
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('preferred_language')
      .eq('id', user.id)
      .single();

    const languageCode = profile?.preferred_language || 'es-AR';

    // Format conversation text
    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'Usuario' : 'Pulpa'}: ${m.text}`)
      .join('\n');

    const apiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is not set in environment variables');
    }

    // Generate summary
    const summary = await callGeminiForSummary(conversationText, apiKey, languageCode);

    // Update conversation with summary
    const { error: updateError } = await supabaseClient
      .from('conversations')
      .update({ summary })
      .eq('id', conversationId);

    if (updateError) {
      throw new Error(`Failed to update conversation: ${updateError.message}`);
    }

    console.log(`Successfully generated summary for conversation ${conversationId}: "${summary}"`);

    return new Response(JSON.stringify({ 
      success: true, 
      summary,
      message: 'Session finished and summary generated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in summarize-conversation function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'An unexpected error occurred',
      details: 'Failed to generate conversation summary'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});