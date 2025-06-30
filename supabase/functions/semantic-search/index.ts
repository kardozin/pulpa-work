import { serve } from 'std/http/server.ts'
import { createClient } from '@supabase/supabase-js'

console.log(`[semantic-search] function started`);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query } = await req.json()
    console.log(`[semantic-search] 1. Received query: "${query}"`);
    if (!query) {
      throw new Error('`query` is required.')
    }

    const authHeader = req.headers.get('Authorization')!
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    console.log('[semantic-search] 2. Supabase client created.');

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('[semantic-search] User auth error:', userError);
      return new Response(JSON.stringify({ error: 'User not authenticated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    console.log(`[semantic-search] 3. Authenticated as user: ${user.id}`);

    console.log('[semantic-search] 4. Invoking generate-embedding...');
    const { data: embeddingData, error: embeddingError } = await supabaseClient.functions.invoke(
      'generate-embedding',
      { body: { text: query } }
    )

    if (embeddingError) {
      console.error('[semantic-search] Error from generate-embedding invoke:', embeddingError);
      throw new Error(`Failed to generate embedding: ${embeddingError.message}`)
    }
    if (!embeddingData || !embeddingData.embedding) {
        console.error('[semantic-search] Invalid data from generate-embedding:', embeddingData);
        throw new Error('No embedding returned from generate-embedding function');
    }
    
    const embedding = embeddingData.embedding;
    console.log('[semantic-search] 5. Embedding generated successfully.');

    console.log('[semantic-search] 6. Calling pulpa_match_messages RPC...');
    const { data: messages, error: rpcError } = await supabaseClient.rpc('pulpa_match_messages', {
      p_user_id: user.id,
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 5,
    })

        if (rpcError) {
      console.error('[semantic-search] Error from pulpa_match_messages RPC:', JSON.stringify(rpcError, null, 2));
      throw new Error(`Failed to match messages: ${JSON.stringify(rpcError)}`);
    }
    console.log(`[semantic-search] 7. Found ${messages?.length || 0} matches.`);
    console.log('[semantic-search] DEBUG: Raw response from RPC:', JSON.stringify(messages, null, 2));

    return new Response(JSON.stringify({ matches: messages }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }   } catch (error) {
    console.error('[semantic-search] CATCH BLOCK ERROR:', error);
    return new Response(JSON.stringify({ 
      error: 'An internal server error occurred.',
      details: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
