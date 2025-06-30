import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@^2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PeriodicSummaryRequest {
  period_type: 'weekly' | 'monthly';
  user_id?: string; // Optional, if not provided, process all active users
}

interface ConversationData {
  id: string;
  created_at: string;
  messages: Array<{
    role: 'user' | 'model';
    text: string;
    created_at: string;
  }>;
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

interface AnalysisResult {
  summary: string;
  keyThemes: string[];
  emotionalPatterns: string[];
  growthInsights: string[];
}

async function callGeminiForPeriodicSummary(
  conversationsText: string,
  periodType: 'weekly' | 'monthly',
  profile: any,
  apiKey: string
): Promise<AnalysisResult> {
  const userName = profile?.full_name || 'el usuario';
  const userRole = profile?.role || 'persona reflexiva';
  const userGoals = profile?.goals || 'crecimiento personal';

  const periodLabel = periodType === 'weekly' ? 'semana' : 'mes';
  const timeContext = periodType === 'weekly' ? 'últimos 7 días' : 'último mes';

  const prompt = `Actúa como un psicólogo experto analizando las reflexiones de ${userName} durante ${timeContext}.

CONTEXTO DEL USUARIO:
- Nombre: ${userName}
- Rol/Ocupación: ${userRole}
- Objetivos: ${userGoals}

CONVERSACIONES DE LA ${periodLabel.toUpperCase()}:
${conversationsText}

Analiza estas reflexiones y proporciona un análisis estructurado en el siguiente formato JSON:

{
  "summary": "Un resumen narrativo de 150-200 palabras que capture la esencia de las reflexiones del período, escrito en primera persona como si fuera el propio usuario reflexionando sobre su ${periodLabel}",
  "keyThemes": ["tema1", "tema2", "tema3"],
  "emotionalPatterns": ["patrón emocional 1", "patrón emocional 2"],
  "growthInsights": ["insight de crecimiento 1", "insight de crecimiento 2"]
}

INSTRUCCIONES ESPECÍFICAS:
- El resumen debe ser empático, profundo y revelador
- Identifica 3-5 temas principales que emergieron
- Observa patrones emocionales recurrentes
- Destaca insights sobre crecimiento personal y autoconocimiento
- Usa un lenguaje que inspire introspección
- Mantén un tono profesional pero cálido

CRÍTICO: Responde ÚNICAMENTE con el JSON válido, sin texto adicional.`;

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.6,
      topK: 30,
      topP: 0.9,
      maxOutputTokens: 1500,
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
    throw new Error(`Failed to generate ${periodType} summary: ${response.statusText}`);
  }

  const data: GeminiResponse = await response.json();
  const responseText = data.candidates?.[0]?.content.parts[0]?.text;

  if (!responseText) {
    throw new Error('No response from Gemini API');
  }

  try {
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : responseText;
    const parsed = JSON.parse(jsonText);

    return {
      summary: parsed.summary || `Resumen del ${periodLabel} generado automáticamente.`,
      keyThemes: Array.isArray(parsed.keyThemes) ? parsed.keyThemes : [],
      emotionalPatterns: Array.isArray(parsed.emotionalPatterns) ? parsed.emotionalPatterns : [],
      growthInsights: Array.isArray(parsed.growthInsights) ? parsed.growthInsights : [],
    };
  } catch (parseError) {
    console.error('Failed to parse Gemini response as JSON:', parseError);
    // Fallback: use the raw response as summary
    return {
      summary: responseText.substring(0, 500),
      keyThemes: ['Reflexión personal', 'Autoconocimiento'],
      emotionalPatterns: ['Introspección'],
      growthInsights: ['Proceso de crecimiento personal'],
    };
  }
}

async function generateLongTermPersona(
  userId: string,
  supabaseClient: any,
  apiKey: string
): Promise<string> {
  // Get user profile
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  // Get recent summaries (last 6 months)
  const { data: summaries } = await supabaseClient
    .from('periodic_summaries')
    .select('*')
    .eq('user_id', userId)
    .gte('period_end', new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('period_end', { ascending: false });

  if (!summaries || summaries.length === 0) {
    return 'Perfil en desarrollo. Se necesitan más reflexiones para generar un análisis profundo.';
  }

  const summariesText = summaries
    .map(s => `${s.period_type === 'weekly' ? 'Semana' : 'Mes'} (${s.period_start}): ${s.summary}`)
    .join('\n\n');

  const prompt = `Basándote en los siguientes resúmenes de reflexiones de ${profile?.full_name || 'el usuario'}, crea un perfil psicológico profundo y contextual que capture su esencia, patrones de pensamiento, y evolución personal.

PERFIL DEL USUARIO:
- Nombre: ${profile?.full_name || 'Usuario'}
- Rol: ${profile?.role || 'No especificado'}
- Objetivos: ${profile?.goals || 'Crecimiento personal'}

RESÚMENES HISTÓRICOS:
${summariesText}

Crea un perfil de 200-300 palabras que incluya:
1. Personalidad y estilo de pensamiento
2. Temas recurrentes y preocupaciones principales
3. Patrones emocionales y de comportamiento
4. Evolución y crecimiento observado
5. Contexto actual y estado mental

El perfil debe ser empático, profundo y útil para personalizar futuras conversaciones. Escribe en tercera persona como si fueras un psicólogo describiendo a su paciente.

CRÍTICO: La respuesta DEBE estar en Español.`;

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000,
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
    throw new Error(`Failed to generate long-term persona: ${response.statusText}`);
  }

  const data: GeminiResponse = await response.json();
  return data.candidates?.[0]?.content.parts[0]?.text || 'Perfil en desarrollo...';
}

async function processUserSummary(
  userId: string,
  periodType: 'weekly' | 'monthly',
  supabaseClient: any,
  apiKey: string
): Promise<void> {
  console.log(`Processing ${periodType} summary for user: ${userId}`);

  // Calculate date range
  const now = new Date();
  const periodStart = new Date();
  const periodEnd = new Date(now);

  if (periodType === 'weekly') {
    periodStart.setDate(now.getDate() - 7);
  } else {
    periodStart.setMonth(now.getMonth() - 1);
  }

  // Check if summary already exists for this period
  const { data: existingSummary } = await supabaseClient
    .from('periodic_summaries')
    .select('id')
    .eq('user_id', userId)
    .eq('period_type', periodType)
    .gte('period_start', periodStart.toISOString().split('T')[0])
    .single();

  if (existingSummary) {
    console.log(`${periodType} summary already exists for user ${userId}`);
    return;
  }

  // Get conversations from the period
  const { data: conversations } = await supabaseClient
    .from('conversations')
    .select(`
      id,
      created_at,
      messages (
        role,
        text,
        created_at
      )
    `)
    .eq('user_id', userId)
    .gte('created_at', periodStart.toISOString())
    .lt('created_at', periodEnd.toISOString())
    .order('created_at', { ascending: true });

  if (!conversations || conversations.length === 0) {
    console.log(`No conversations found for user ${userId} in ${periodType} period`);
    return;
  }

  // Get user profile
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  // Format conversations for analysis
  const conversationsText = conversations
    .map((conv: ConversationData) => {
      const messagesText = conv.messages
        .map(msg => `${msg.role === 'user' ? 'Usuario' : 'Pulpa'}: ${msg.text}`)
        .join('\n');
      return `Conversación ${conv.created_at}:\n${messagesText}`;
    })
    .join('\n\n---\n\n');

  // Generate summary using Gemini
  const analysis = await callGeminiForPeriodicSummary(
    conversationsText,
    periodType,
    profile,
    apiKey
  );

  // Save the summary
  const { error: insertError } = await supabaseClient
    .from('periodic_summaries')
    .insert({
      user_id: userId,
      period_type: periodType,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      summary: analysis.summary,
      key_themes: analysis.keyThemes,
      emotional_patterns: analysis.emotionalPatterns,
      growth_insights: analysis.growthInsights,
      conversation_count: conversations.length,
      total_messages: conversations.reduce((sum: number, conv: ConversationData) => sum + conv.messages.length, 0)
    });

  if (insertError) {
    throw new Error(`Failed to save ${periodType} summary: ${insertError.message}`);
  }

  // Update long-term persona (only for monthly summaries to avoid too frequent updates)
  if (periodType === 'monthly') {
    const longTermPersona = await generateLongTermPersona(userId, supabaseClient, apiKey);
    
    const { error: personaError } = await supabaseClient
      .from('profiles')
      .update({ 
        long_term_persona: longTermPersona,
        persona_updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (personaError) {
      console.error(`Failed to update long-term persona for user ${userId}:`, personaError);
    } else {
      console.log(`Updated long-term persona for user ${userId}`);
    }
  }

  console.log(`Successfully generated ${periodType} summary for user ${userId}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY not configured');
    }

    // Use service role for cron jobs
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { period_type, user_id }: PeriodicSummaryRequest = await req.json();

    if (!period_type || !['weekly', 'monthly'].includes(period_type)) {
      return new Response(JSON.stringify({ error: 'Invalid period_type. Must be "weekly" or "monthly"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (user_id) {
      // Process specific user
      await processUserSummary(user_id, period_type, supabaseClient, apiKey);
      return new Response(JSON.stringify({ 
        success: true, 
        message: `${period_type} summary generated for user ${user_id}` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Process all users with recent activity
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (period_type === 'weekly' ? 7 : 30));

      const { data: activeUsers } = await supabaseClient
        .from('conversations')
        .select('user_id')
        .gte('created_at', cutoffDate.toISOString())
        .group('user_id');

      if (!activeUsers || activeUsers.length === 0) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'No active users found for summary generation' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const uniqueUserIds = [...new Set(activeUsers.map(u => u.user_id))];
      let processedCount = 0;
      let errorCount = 0;

      for (const userId of uniqueUserIds) {
        try {
          await processUserSummary(userId, period_type, supabaseClient, apiKey);
          processedCount++;
        } catch (error) {
          console.error(`Error processing ${period_type} summary for user ${userId}:`, error);
          errorCount++;
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Processed ${processedCount} users, ${errorCount} errors`,
        processed: processedCount,
        errors: errorCount
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in generate-periodic-summary function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});