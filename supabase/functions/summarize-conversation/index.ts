import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

async function callGeminiForSummary(conversationText: string, apiKey: string): Promise<string> {
  const prompt = `Resume la siguiente conversación de autorreflexión en una única frase concisa e reveladora que capture la esencia del descubrimiento del usuario. El resumen debe ser en primera persona, desde la perspectiva del usuario. Conversación: ${conversationText}`;

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 100,
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { conversationId } = await req.json();
    if (!conversationId) {
      return new Response(JSON.stringify({ error: 'conversationId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: messages, error: messagesError } = await supabaseClient
      .from('messages')
      .select('role, text')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) throw messagesError;
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No messages found for this conversation' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'Usuario' : 'Guía'}: ${m.text}`)
      .join('\n');

    const apiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is not set in environment variables');
    }

    const summary = await callGeminiForSummary(conversationText, apiKey);

    const { error: updateError } = await supabaseClient
      .from('conversations')
      .update({ summary })
      .eq('id', conversationId);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
