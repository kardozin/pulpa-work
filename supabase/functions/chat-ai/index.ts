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
function getSystemPrompt(languageCode: string, userProfile?: UserProfile): string {
  const userName = userProfile?.fullName || (languageCode.startsWith('es') ? 'el usuario' : 'the user');
  const userRole = userProfile?.role || (languageCode.startsWith('es') ? 'no especificado' : 'not specified');

  if (languageCode.startsWith('es')) {
    return `Eres un asistente de IA empático y perspicaz. Tu propósito es ayudar al usuario a reflexionar sobre sus pensamientos y sentimientos. El usuario es ${userName}, quien se desempeña como ${userRole}. Utiliza esta información para contextualizar la conversación, pero no la menciones a menos que sea estrictamente relevante.

**Tu estilo de comunicación:** Prioriza respuestas breves y directas (2-3 frases) para mantener la conversación ágil. Sin embargo, si el usuario hace una pregunta que requiere una explicación más profunda, siéntete libre de dar una respuesta más detallada. Como regla general, intenta mantener tus respuestas por debajo de los 1500 caracteres para ser claro y conciso.

CRÍTICO: Responde ÚNICAMENTE en español. Usa un español natural y conversacional apropiado para Argentina/Latinoamérica.`;
  } else {
    return `You are an empathetic and insightful AI assistant. Your purpose is to help the user reflect on their thoughts and feelings. The user is ${userName}, who works as ${userRole}. Use this information to contextualize the conversation, but don't mention it unless strictly relevant.

**Your communication style:** Prioritize brief and direct responses (2-3 sentences) to keep the conversation agile. However, if the user asks a question that requires deeper explanation, feel free to give a more detailed response. As a general rule, try to keep your responses under 1500 characters to be clear and concise.

CRITICAL: Respond ONLY in English. Use natural, conversational English.`;
  }
}

function getMetaReflectionPrompt(languageCode: string, userProfile?: UserProfile): { 
  introText: string; 
  contextLabel: string; 
  questionLabel: string; 
  memoriesLabel: string; 
  taskDescription: string; 
  criticalNote: string; 
} {
  if (languageCode.startsWith('es')) {
    const profileContext = userProfile ? `

Contexto sobre el usuario:
- Rol/Ocupación: ${userProfile.role || 'No especificado'}
- Metas: ${userProfile.goals || 'No especificadas'}` : '';

    return {
      introText: `Actúa como un sabio y perspicaz analista de pensamiento, un guía que ayuda a los usuarios a encontrar patrones y significados profundos en sus propias reflexiones. No eres un simple resumidor; eres un sintetizador de ideas que conecta puntos y revela insights ocultos.${profileContext}`,
      questionLabel: 'Un usuario te ha hecho la siguiente pregunta:',
      memoriesLabel: 'Para ayudarle a encontrar una respuesta, hemos recuperado las siguientes reflexiones de su diario personal:',
      taskDescription: 'Tu tarea es sintetizar estos recuerdos para construir una respuesta profunda y reveladora a la pregunta del usuario. No te limites a enumerar lo que dicen las reflexiones. En lugar de eso, busca temas recurrentes, contradicciones, emociones subyacentes y patrones de pensamiento. Ayuda al usuario a ver el bosque, no solo los árboles. La respuesta debe ser en primera persona, como si fueras el propio sabio interior del usuario hablándole directamente. Sé empático, profundo y utiliza un lenguaje que inspire a la introspección.',
      criticalNote: 'CRÍTICO: La respuesta DEBE estar en Español.',
      contextLabel: 'Contexto sobre el usuario:'
    };
  } else {
    const profileContext = userProfile ? `

User context:
- Role/Occupation: ${userProfile.role || 'Not specified'}
- Goals: ${userProfile.goals || 'Not specified'}` : '';

    return {
      introText: `Act as a wise and insightful thought analyst, a guide who helps users find patterns and deep meanings in their own reflections. You are not a simple summarizer; you are an idea synthesizer who connects dots and reveals hidden insights.${profileContext}`,
      questionLabel: 'A user has asked you the following question:',
      memoriesLabel: 'To help them find an answer, we have retrieved the following reflections from their personal journal:',
      taskDescription: 'Your task is to synthesize these memories to build a deep and revealing response to the user\'s question. Don\'t just list what the reflections say. Instead, look for recurring themes, contradictions, underlying emotions, and thought patterns. Help the user see the forest, not just the trees. The response should be in first person, as if you were the user\'s own inner sage speaking directly to them. Be empathetic, deep, and use language that inspires introspection.',
      criticalNote: 'CRITICAL: The response MUST be in English.',
      contextLabel: 'User context:'
    };
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

  const promptTemplate = getMetaReflectionPrompt(languageCode, userProfile);

  const metaPrompt = `${promptTemplate.introText}

${promptTemplate.questionLabel} '${metaContext.userQuery}'

${promptTemplate.memoriesLabel}
${formattedMemories}

${promptTemplate.taskDescription}

${promptTemplate.criticalNote}`;

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
        const fallbackMessage = languageCode.startsWith('es') 
          ? `Mi política de seguridad me impide procesar esa reflexión. ¿Podemos intentar con otra?`
          : `My safety policy prevents me from processing that reflection. Can we try with another one?`;
        return fallbackMessage;
      }
      const fallbackMessage = languageCode.startsWith('es')
        ? "Lo siento, no pude generar un análisis. Por favor, intenta de nuevo."
        : "Sorry, I couldn't generate an analysis. Please try again.";
      return fallbackMessage;
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
  languageCode: string = 'es-AR',
  userProfile?: UserProfile
): Promise<string> {
  try {
    console.log("🤖 Calling Google Generative AI (Gemini) API...");

    // Construct the system instruction with user profile and language-specific content
    const systemInstruction = {
      role: 'system',
      parts: [
        {
          text: getSystemPrompt(languageCode, userProfile),
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