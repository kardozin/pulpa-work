// supabase/functions/chat-ai/index.ts (Corrected and Final Version)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
function getSystemPrompt(languageCode: string): string {
  const basePrompt = `You are a wise, empathetic AI interviewer inspired by Stoic philosophy. Your role is to guide users through deep self-reflection about their daily experiences, emotions, and learnings. Your interviewing style is to ask open-ended, probing questions, maintain context, and help users discover deeper insights. Use a calm, empathetic, and subtly Stoic-inspired questioning approach. Keep your responses conversational, warm, and focused on one thoughtful question at a time.`;

  if (languageCode.startsWith('es')) {
    return basePrompt + `\n\nCRITICAL: Respond ONLY in Spanish (Español). Use natural, conversational Spanish appropriate for Argentina/Latin America.`;
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
- Metas: ${userProfile.goals || 'No especificadas'}` : '';

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
  conversationHistory: ClientConversationMessage[], // Use correct type
  apiKey: string,
  languageCode: string = 'es-AR', // Note: languageCode is currently unused as prompt is hardcoded in Spanish
  userProfile?: UserProfile
): Promise<string> {
  try {
    console.log("🤖 Calling Google Generative AI (Gemini) API...");

    const userName = userProfile?.fullName || 'el usuario';
    const userRole = userProfile?.role || 'no especificado';

    // Construct the system instruction with user profile and a directive for flexible response length
    const systemInstruction = {
      role: 'system',
      parts: [
        {
          text: `Eres un asistente de IA empático y perspicaz. Tu propósito es ayudar al usuario a reflexionar sobre sus pensamientos y sentimientos. El usuario es ${userName}, quien se desempeña como ${userRole}. Utiliza esta información para contextualizar la conversación, pero no la menciones a menos que sea estrictamente relevante.\n\n**Tu estilo de comunicación:** Prioriza respuestas breves y directas (2-3 frases) para mantener la conversación ágil. Sin embargo, si el usuario hace una pregunta que requiere una explicación más profunda, siéntete libre de dar una respuesta más detallada. Como regla general, intenta mantener tus respuestas por debajo de los 1500 caracteres para ser claro y conciso.`,
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
         return `Mi política de seguridad me impide responder a eso. ¿Podemos hablar de otra cosa?`;
      }
      return "Lo siento, no pude generar una respuesta. Por favor, intenta de nuevo.";
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
      responseText = await callGemini(userMessage, conversationHistory, apiKey, languageCode, userProfile);
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