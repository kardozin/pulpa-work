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

    // 1. Fetch messages without embeddings
    const { data: messages, error: fetchError } = await supabaseClient
      .from('messages')
      .select('id, text')
      .is('embedding', null);

    if (fetchError) {
      throw new Error(`Failed to fetch messages: ${fetchError.message}`);
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ message: 'No messages found to backfill.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let updatedCount = 0;
    // 2. Generate and update embeddings for each message
    for (const message of messages) {
      console.log(`Processing message ID: ${message.id}`);
      const { data: embeddingResponse, error: embeddingError } = await supabaseClient.functions.invoke(
        'generate-embedding',
        { body: { text: message.text } }
      );

      if (embeddingError) {
        console.error(`Failed to generate embedding for message ${message.id}:`, embeddingError);
        continue; // Skip to the next message
      }

      const embedding = embeddingResponse.embedding;

      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({ embedding })
        .eq('id', message.id);

      if (updateError) {
        console.error(`Failed to update message ${message.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }

    return new Response(JSON.stringify({ success: true, message: `Successfully backfilled embeddings for ${updatedCount} out of ${messages.length} messages.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in backfill-embeddings function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
