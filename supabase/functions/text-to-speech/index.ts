import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from 'std/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'
import { encode } from 'https://deno.land/std@0.208.0/encoding/base64.ts';

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech'

// Voice IDs
// CRITICAL: Correct voice IDs for natural-sounding Spanish and English voices.
const voice_ids: Record<string, string> = {
  'es-AR': 'dtqbhKQTKfVe9T23mwwa', // Correct, natural-sounding Spanish voice
  'en-US': 'BhNB1AU2JwDb7tLknpZF', // Correct English voice ID
};

serve(async (req) => {
  // Handle preflight OPTIONS request. This is crucial for authenticated functions.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('--- New text-to-speech request received ---');
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      console.error('Auth Error: Missing Authorization header.');
      return new Response(JSON.stringify({ error: 'Authentication failed: Missing Authorization header.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`Authorization header received. Type: ${authHeader.split(' ')[0]}`);

    // 1. Create a Supabase client scoped to this request using the user's token.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // 2. Verify the user and get their data.
    console.log('Attempting to get user from token...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError) {
      console.error('User retrieval error:', userError.message);
      return new Response(JSON.stringify({ error: `Authentication error: ${userError.message}` }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!user) {
      console.error('Authentication failed: No user session found for the provided token.');
      return new Response(JSON.stringify({ error: 'Authentication failed: No user session found.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✅ Authentication successful. User ID: ${user.id}`);

    const { text, languageCode, voiceId, voice_settings } = await req.json();

    if (!text) {
      throw new Error('Missing required parameter: text');
    }

    // Prioritize the user's preferred voice, then language-based, then default.
    const final_voice_id = voiceId || voice_ids[languageCode] || voice_ids['es-AR'];

    const response = await fetch(`${ELEVENLABS_API_URL}/${final_voice_id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY!,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: voice_settings || {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      // Propagate a more detailed error message to the client
      throw new Error(`ElevenLabs API Error (${response.status}): ${errorBody}`);
    }

    // Manually buffer the entire audio stream to handle large responses
    if (!response.body) {
      throw new Error('Response from ElevenLabs has no body');
    }

    const reader = response.body.getReader();
    const chunks = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      receivedLength += value.length;
    }

    console.log(`Stream finished. Total size: ${receivedLength} bytes.`);

    // Combine chunks into a single Uint8Array
    const audioByteArray = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      audioByteArray.set(chunk, position);
      position += chunk.length;
    }

    // Convert ArrayBuffer to Base64 using the standard library for safety.
    const base64Audio = encode(audioByteArray);

    // Return as JSON
    const responsePayload = { audioData: base64Audio };

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('TTS Function General Error:', error.message);
    const isAuthError = error.message.includes('Authentication');
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: isAuthError ? 401 : 500,
    })
  }
})