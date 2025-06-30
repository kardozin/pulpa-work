import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')
const EMBEDDING_MODEL_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // O un origen específico para mayor seguridad
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Manejo de la solicitud pre-flight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Recibir y validar el texto de entrada
    const body = await req.json()
    console.log('[generate-embedding] Received request body:', body);
    const { text } = body
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return new Response(JSON.stringify({ error: 'El campo "text" es requerido y debe ser un string no vacío.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!GOOGLE_API_KEY) {
        return new Response(JSON.stringify({ error: 'La variable de entorno GOOGLE_API_KEY no está configurada.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // 2. Llamar a la API de Google Embeddings
    const googleApiRes = await fetch(`${EMBEDDING_MODEL_ENDPOINT}?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        model: "models/text-embedding-004",
        content: {
          parts: [{
            text: text
          }]
        }
      }),
    })

    if (!googleApiRes.ok) {
      const errorBody = await googleApiRes.json()
      console.error('Error desde la API de Google:', errorBody)
      return new Response(JSON.stringify({ error: 'Error al generar el embedding.', details: errorBody }), {
        status: googleApiRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { embedding } = await googleApiRes.json()

    // 3. Devolver el vector de embedding como un objeto JSON directo
    const responsePayload = { success: true, embedding: embedding.values };
    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error inesperado:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
