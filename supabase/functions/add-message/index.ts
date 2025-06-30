import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@^2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { conversation_id, role, text } = await req.json();

    if (!conversation_id || !role || !text) {
      return new Response(JSON.stringify({ error: 'Missing required fields: conversation_id, role, and text are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing Authorization header.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // 1. Generate embedding for the message text
    console.log(`Generating embedding for text: "${text}"`); // Log para depuración
    const { data: embeddingResponse, error: embeddingError } = await supabaseClient.functions.invoke(
      'generate-embedding',
      { body: { text } }
    );

    if (embeddingError) {
      throw new Error(`Failed to generate embedding: ${embeddingError.message}`);
    }

    // Detailed logging to debug meta-reflection flow
    console.log('Response from generate-embedding:', JSON.stringify(embeddingResponse, null, 2));
    console.log('Type of embeddingResponse:', typeof embeddingResponse);

    // 4. Parse embedding and insert message via RPC
    try {
      const parsedData = typeof embeddingResponse === 'string' ? JSON.parse(embeddingResponse) : embeddingResponse;
      const embedding = parsedData.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Embedding vector not found or is not an array in the response from generate-embedding.');
      }

      // Call the database function to insert the message
      const { data, error: rpcError } = await supabaseClient
        .rpc('insert_message_with_embedding', {
          p_conversation_id: conversation_id,
          p_role: role,
          p_text: text,
          p_embedding: embedding,
        })
        .single(); // The function returns a single row, so .single() is appropriate.

      if (rpcError) {
        const details = (rpcError as any).details ? `Details: ${(rpcError as any).details}` : '';
        throw new Error(`RPC error: ${rpcError.message}. ${details}`);
      }

      // The RPC call with .single() should return one object from the SETOF result.
      return new Response(JSON.stringify({ success: true, message: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } catch (e: any) {
      console.error('Error processing embedding or calling RPC:', e.message);
      // Re-throw with detailed context for client-side debugging.
      throw new Error(
        `Failed to process embedding or call RPC. Raw embedding response: ${JSON.stringify(embeddingResponse, null, 2)}. Error: ${e.message}`
      );
    }

  } catch (error) {
    console.error('Error in add-message function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
