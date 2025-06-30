// supabase/functions/chat-ai/index.ts (Updated with Enhanced Context)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@^2';

// Read the allowed origin from an environment variable for flexibility
const allowedOrigin = Deno.env.get('CORS_ORIGIN') || '*'; // Default to wildcard for simplicity

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

// --- Interfaces ---
// Message format from the client, includes extra fields.
interface ClientConversationMessage {
  role: 'user' | 'model';
  text: string;
  id?: string;
  timestamp?: string;
  audioUrl?: string;
}

// Message format for the Gemini API.
interface ConversationMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface UserProfile {
  fullName?: string;
  role?: string;
  goals?: string;
  long_term_persona?: string;
}

interface ChatRequest {
  userMessage: string;
  conversationHistory?: ClientConversationMessage[];
  languageCode?: string;
  userProfile?: UserProfile;
  metaContext?: {
    userQuery: string;
    relevantMemories: Array<{ content: string; role?: string; created_at?: string; similarity?: number; id?: number; }>;
  };
}

interface GeminiRequest {
  contents: Array<{
    role: string;
    parts: Array<{ text: string }>;
  }>;
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
}

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

// --- Helper Functions ---
async function getEnhancedUserContext(userId: string, supabaseClient: any): Promise<string> {
  try {
    // Get user profile with long-term persona
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('full_name, role, goals, long_term_persona, persona_updated_at')
      .eq('id', userId)
      .single();

    // Get recent periodic summaries for additional context
    const { data: recentSummaries } = await supabaseClient
      .from('periodic_summaries')
      .select('period_type, summary, key_themes, emotional_patterns, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3);

    let contextText = '';

    // Add long-term persona if available
    if (profile?.long_term_persona) {
      const personaAge = profile.persona_updated_at 
        ? Math.floor((Date.now() - new Date(profile.persona_updated_at).getTime()) / (1000 * 60 * 60 * 24))
        : 'unknown';
      
      contextText += `PERFIL PSICOLÓGICO PROFUNDO (actualizado hace ${personaAge} días):\n${profile.long_term_persona}\n\n`;
    }

    // Add recent summaries for current context
    if (recentSummaries && recentSummaries.length > 0) {
      contextText += `CONTEXTO RECIENTE:\n`;
      recentSummaries.forEach(summary => {
        const timeAgo = Math.floor((Date.now() - new Date(summary.created_at).getTime()) / (1000 * 60 * 60 * 24));
        contextText += `- ${summary.period_type === 'weekly' ? 'Semana' : 'Mes'} pasado (hace ${timeAgo} días): ${summary.summary}\n`;
        if (summary.key_themes?.length > 0) {
          contextText += `  Temas clave: ${summary.key_themes.join(', ')}\n`;
        }
      });
      contextText += '\n';
    }

    // Add basic profile info as fallback
    if (!contextText && profile) {
      contextText = `INFORMACIÓN BÁSICA:\n- Nombre: ${profile.full_name || 'Usuario'}\n- Rol: ${profile.role || 'No especificado'}\n- Objetivos: ${profile.goals || 'Crecimiento personal'}\n\n`;
    }

    return contextText;
  } catch (error) {
    console.error('Error getting enhanced user context:', error);
    return '';
  }
}

function getSystemPrompt(languageCode: string, userContext: string): string {
  const basePrompt = `Eres un asistente de IA empático y perspicaz especializado en autorreflexión. Tu propósito es ayudar al usuario a explorar sus pensamientos y sentimientos de manera profunda y significativa.

${userContext ? `CONTEXTO DEL USUARIO:\n${userContext}` : ''}

INSTRUCCIONES DE CONVERSACIÓN:
- Utiliza el contexto del usuario para personalizar tus respuestas y hacer conexiones relevantes
- Haz preguntas reflexivas que ayuden al usuario a profundizar en sus pensamientos
- Mantén un tono empático, cálido y ligeramente filosófico
- Prioriza respuestas breves (2-3 frases) para mantener la conversación ágil
- Si el tema requiere mayor profundidad, puedes extenderte hasta 1500 caracteres
- Conecta las reflexiones actuales con patrones o temas previos cuando sea relevante
- Conoces el nombre del usuario, pero úsalo con moderación y naturalidad, no en cada respuesta
- Evita comenzar cada mensaje con el nombre del usuario, varía tu forma de dirigirte a él`;

  if (languageCode.startsWith('es')) {
    return basePrompt + `\n\nCRÍTICO: Responde ÚNICAMENTE en español (Español). Usa español natural y conversacional apropiado para Argentina/Latinoamérica.`;
  } else {
    return basePrompt + `\n\nCRITICAL: Respond ONLY in English. Use natural, conversational English.`;
  }
}

async function callGeminiForMetaReflection(
  metaContext: { userQuery: string; relevantMemories: Array<{ content: string }> },
  apiKey: string,
  userProfile?: UserProfile,
  languageCode: string = 'es-AR' 
): Promise<string> {
  console.log("🧠 Calling Gemini for Meta-Reflection...");

  const formattedMemories = metaContext.relevantMemories
    .map((mem, index) => `  Reflection ${index + 1}: "${mem.content}"`)  
    .join('\n');

  const profileContext = userProfile ? `

Contexto sobre el usuario:
- Rol/Ocupación: ${userProfile.role || 'No especificado'}
- Metas: ${userProfile.goals || 'No especificadas'}
${userProfile.long_term_persona ? `- Perfil psicológico: ${userProfile.long_term_persona}` : ''}` : '';

  const metaPrompt = `Actúa como un sabio y perspicaz analista de pensamiento, un guía que ayuda a los usuarios a encontrar patrones y significados profundos en sus propias reflexiones. No eres un simple resumidor; eres un sintetizador de ideas que conecta puntos y revela insights ocultos.${profileContext}

Un usuario te ha hecho la siguiente pregunta: '${metaContext.userQuery}'

Para ayudarle a encontrar una respuesta, hemos recuperado las siguientes reflexiones de su diario personal:
${formattedMemories}

Tu tarea es sintetizar estos recuerdos para construir una respuesta profunda y reveladora a la pregunta del usuario. No te limites a enumerar lo que dicen las reflexiones. En lugar de eso, busca temas recurrentes, contradicciones, emociones subyacentes y patrones de pensamiento. Ayuda al usuario a ver el bosque, no solo los árboles. La respuesta debe ser en primera persona, como si fueras el propio sabio interior del usuario hablándole directamente. Sé empático, profundo y utiliza un lenguaje que inspire a la introspección.

CRÍTICO: La respuesta DEBE estar en ${languageCode.startsWith('es') ? 'Español' : 'Inglés'}.`;

  const requestBody = {
    contents: [{ role: "user", parts: [{ text: metaPrompt }] }],
    generationConfig: {
      temperature: 0.6, 
      topK: 30,
      topP: 0.9,
      maxOutputTokens: 1500, 
    },
  };

  const model_id = "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model_id}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`❌ Gemini API Error (Meta-Reflection): ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`Gemini API request failed: ${response.statusText}`);
    }

    const data: GeminiResponse = await response.json();

    if (data.candidates && data.candidates[0]?.content.parts[0]?.text) {
      console.log("✅ Gemini meta-reflection response received.");
      return data.candidates[0].content.parts[0].text;
    } else {
      console.warn("🤔 Gemini meta-reflection response did not contain expected content.", data);
      if (data.promptFeedback?.blockReason) {
        console.error(`❌ Request blocked due to: ${data.promptFeedback.blockReason}`);
        return `Mi política de seguridad me impide procesar esa reflexión. ¿Podemos intentar con otra?`;
      }
      return "Lo siento, no pude generar un análisis. Por favor, intenta de nuevo.";
    }
  } catch (error) {
    console.error('❌ Error calling Gemini API for meta-reflection:', error);
    return `Error: ${error.message}`;
  }
}

async function callGemini(
  userMessage: string,
  conversationHistory: ClientConversationMessage[],
  apiKey: string,
  languageCode: string = 'es-AR',
  userProfile?: UserProfile,
  userId?: string,
  supabaseClient?: any
): Promise<string> {
  try {
    console.log("🤖 Calling Google Generative AI (Gemini) API...");

    // Get enhanced user context if userId is provided
    let userContext = '';
    if (userId && supabaseClient) {
      userContext = await getEnhancedUserContext(userId, supabaseClient);
    }

    // Construct the system instruction with enhanced context
    const systemInstruction = {
      role: 'system',
      parts: [
        {
          text: getSystemPrompt(languageCode, userContext),
        },
      ],
    };

    // Filter out any empty or invalid messages from the history
    const contents = [
      ...conversationHistory
        .filter(msg => msg.text && msg.text.trim() !== '') // Filter out empty messages
        .map((msg) => {
          const role = msg.role; // Direct assignment, as roles are already 'user' | 'model'
          return {
            role,
            parts: [{ text: msg.text }],
          };
        }),
      { role: "user", parts: [{ text: userMessage }] } // Add current user message
    ];

    // 2. Construct the full request body with contents and the persistent systemInstruction.
    const requestBody = {
      contents,
      systemInstruction,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    };

    const model_id = "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model_id}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`❌ Gemini API Error: ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`Gemini API request failed: ${response.statusText}`);
    }

    const data: GeminiResponse = await response.json();

    // 3. Process the response, checking for content or safety blocks.
    if (data.candidates && data.candidates[0]?.content.parts[0]?.text) {
      const responseText = data.candidates[0].content.parts[0].text;
      console.log("✅ Gemini response received.");
      return responseText;
    } else {
      console.warn("🤔 Gemini response did not contain expected content.", data);
      if (data.promptFeedback?.blockReason) {
         console.error(`❌ Request blocked due to: ${data.promptFeedback.blockReason}`);
         const fallbackMessage = languageCode.startsWith('es')
           ? `Mi política de seguridad me impide responder a eso. ¿Podemos hablar de otra cosa?`
           : `My safety policy prevents me from responding to that. Can we talk about something else?`;
         return fallbackMessage;
      }
      const fallbackMessage = languageCode.startsWith('es')
        ? "Lo siento, no pude generar una respuesta. Por favor, intenta de nuevo."
        : "Sorry, I couldn't generate a response. Please try again.";
      return fallbackMessage;
    }
  } catch (error) {
    console.error('❌ Error calling Gemini API:', error);
    return `Error: ${error.message}`;
  }
}

// --- Main Server ---
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Ensure the method is POST
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: corsHeaders });
    }

    // Get API Key from environment variables
    const apiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!apiKey) {
      console.error("❌ Missing GOOGLE_API_KEY environment variable.");
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: corsHeaders });
    }

    // Create Supabase client for enhanced context
    const authHeader = req.headers.get('Authorization');
    let supabaseClient = null;
    let userId = null;

    if (authHeader) {
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );

      try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        userId = user?.id;
      } catch (error) {
        console.warn('Could not get user for enhanced context:', error);
      }
    }

    // Extract parameters from the request body
    const { userMessage, conversationHistory, languageCode, userProfile, metaContext } = await req.json();

    let responseText;

    // Prioritize meta-reflection if metaContext is provided
    if (metaContext) {
      if (!metaContext.userQuery || !metaContext.relevantMemories) {
        return new Response(JSON.stringify({ error: 'metaContext must include userQuery and relevantMemories' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // If there's context for meta-reflection, use the specialized function
      responseText = await callGeminiForMetaReflection(metaContext, apiKey, userProfile, languageCode);
    } else if (userMessage) {
      // Otherwise, proceed with the standard chat flow if there's a user message
      responseText = await callGemini(userMessage, conversationHistory, apiKey, languageCode, userProfile, userId, supabaseClient);
    } else {
      // If neither is provided, return an error
      return new Response(JSON.stringify({ error: 'userMessage or metaContext is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return the successful response
    return new Response(
      JSON.stringify({ success: true, response: responseText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ An unexpected error occurred in the main handler:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unknown error occurred.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});