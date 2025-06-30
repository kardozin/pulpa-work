/*
  # Sistema de Resúmenes Periódicos y Contexto de Usuario Mejorado

  1. Nuevas Tablas
    - `periodic_summaries`: Almacena resúmenes semanales y mensuales
    - Actualiza `profiles` con campo `long_term_persona`

  2. Funciones de Base de Datos
    - `insert_periodic_summary`: Inserta resúmenes con embeddings
    - `get_user_context_for_ai`: Obtiene contexto enriquecido del usuario

  3. Programación Automática
    - Cron jobs para generar resúmenes semanales (domingos)
    - Cron jobs para generar resúmenes mensuales (último día del mes)
*/

-- 1. Crear tabla para resúmenes periódicos
CREATE TABLE IF NOT EXISTS periodic_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  summary_text text NOT NULL,
  embedding vector(768),
  key_themes text[],
  emotional_patterns text[],
  growth_insights text[],
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, period_type, period_start, period_end)
);

-- 2. Agregar campo long_term_persona a profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'long_term_persona'
  ) THEN
    ALTER TABLE profiles ADD COLUMN long_term_persona text;
  END IF;
END $$;

-- 3. Habilitar RLS en periodic_summaries
ALTER TABLE periodic_summaries ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de seguridad para periodic_summaries
CREATE POLICY "Users can read their own periodic summaries"
  ON periodic_summaries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert periodic summaries"
  ON periodic_summaries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. Función para insertar resúmenes periódicos con embedding
CREATE OR REPLACE FUNCTION insert_periodic_summary(
  p_user_id uuid,
  p_period_type text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_summary_text text,
  p_embedding vector(768),
  p_key_themes text[] DEFAULT NULL,
  p_emotional_patterns text[] DEFAULT NULL,
  p_growth_insights text[] DEFAULT NULL
) RETURNS periodic_summaries AS $$
DECLARE
  new_summary periodic_summaries;
BEGIN
  INSERT INTO periodic_summaries (
    user_id,
    period_type,
    period_start,
    period_end,
    summary_text,
    embedding,
    key_themes,
    emotional_patterns,
    growth_insights
  ) VALUES (
    p_user_id,
    p_period_type,
    p_period_start,
    p_period_end,
    p_summary_text,
    p_embedding,
    p_key_themes,
    p_emotional_patterns,
    p_growth_insights
  )
  ON CONFLICT (user_id, period_type, period_start, period_end)
  DO UPDATE SET
    summary_text = EXCLUDED.summary_text,
    embedding = EXCLUDED.embedding,
    key_themes = EXCLUDED.key_themes,
    emotional_patterns = EXCLUDED.emotional_patterns,
    growth_insights = EXCLUDED.growth_insights,
    created_at = now()
  RETURNING * INTO new_summary;

  RETURN new_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Función para obtener contexto enriquecido del usuario
CREATE OR REPLACE FUNCTION get_user_context_for_ai(p_user_id uuid)
RETURNS json AS $$
DECLARE
  user_profile profiles;
  recent_weekly_summary periodic_summaries;
  recent_monthly_summary periodic_summaries;
  conversation_count integer;
  days_active integer;
  result json;
BEGIN
  -- Obtener perfil del usuario
  SELECT * INTO user_profile
  FROM profiles
  WHERE id = p_user_id;

  -- Obtener resumen semanal más reciente
  SELECT * INTO recent_weekly_summary
  FROM periodic_summaries
  WHERE user_id = p_user_id AND period_type = 'weekly'
  ORDER BY period_end DESC
  LIMIT 1;

  -- Obtener resumen mensual más reciente
  SELECT * INTO recent_monthly_summary
  FROM periodic_summaries
  WHERE user_id = p_user_id AND period_type = 'monthly'
  ORDER BY period_end DESC
  LIMIT 1;

  -- Estadísticas de uso
  SELECT COUNT(*) INTO conversation_count
  FROM conversations
  WHERE user_id = p_user_id;

  SELECT COUNT(DISTINCT DATE(created_at)) INTO days_active
  FROM conversations
  WHERE user_id = p_user_id
    AND created_at >= now() - interval '30 days';

  -- Construir resultado JSON
  result := json_build_object(
    'profile', json_build_object(
      'full_name', user_profile.full_name,
      'role', user_profile.role,
      'goals', user_profile.goals,
      'long_term_persona', user_profile.long_term_persona
    ),
    'recent_patterns', json_build_object(
      'weekly_summary', CASE 
        WHEN recent_weekly_summary.id IS NOT NULL THEN
          json_build_object(
            'summary', recent_weekly_summary.summary_text,
            'key_themes', recent_weekly_summary.key_themes,
            'emotional_patterns', recent_weekly_summary.emotional_patterns,
            'growth_insights', recent_weekly_summary.growth_insights,
            'period_end', recent_weekly_summary.period_end
          )
        ELSE NULL
      END,
      'monthly_summary', CASE 
        WHEN recent_monthly_summary.id IS NOT NULL THEN
          json_build_object(
            'summary', recent_monthly_summary.summary_text,
            'key_themes', recent_monthly_summary.key_themes,
            'emotional_patterns', recent_monthly_summary.emotional_patterns,
            'growth_insights', recent_monthly_summary.growth_insights,
            'period_end', recent_monthly_summary.period_end
          )
        ELSE NULL
      END
    ),
    'usage_stats', json_build_object(
      'total_conversations', conversation_count,
      'days_active_last_month', days_active
    )
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_periodic_summaries_user_period 
ON periodic_summaries(user_id, period_type, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_periodic_summaries_embedding 
ON periodic_summaries USING ivfflat (embedding vector_cosine_ops);

-- 8. Configurar cron jobs para generar resúmenes automáticamente

-- Resúmenes semanales: cada domingo a las 23:59 UTC
SELECT cron.schedule(
  'generate-weekly-summaries',
  '59 23 * * 0',  -- Domingo a las 23:59
  $$
  SELECT net.http_post(
    url := 'https://awqkjxprdocadfmnjjrz.supabase.co/functions/v1/generate-periodic-summary',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}',
    body := '{"period_type": "weekly"}'
  );
  $$
);

-- Resúmenes mensuales: último día de cada mes a las 23:59 UTC
SELECT cron.schedule(
  'generate-monthly-summaries',
  '59 23 28-31 * *',  -- Días 28-31 de cada mes a las 23:59
  $$
  -- Solo ejecutar si es realmente el último día del mes
  DO $$
  BEGIN
    IF EXTRACT(DAY FROM (CURRENT_DATE + INTERVAL '1 day')) = 1 THEN
      PERFORM net.http_post(
        url := 'https://awqkjxprdocadfmnjjrz.supabase.co/functions/v1/generate-periodic-summary',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}',
        body := '{"period_type": "monthly"}'
      );
    END IF;
  END $$;
  $$
);