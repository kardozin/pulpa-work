-- 1. Crear tabla para resúmenes periódicos
CREATE TABLE IF NOT EXISTS periodic_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  summary text NOT NULL,
  key_themes text[],
  emotional_patterns text[],
  growth_insights text[],
  conversation_count integer DEFAULT 0,
  total_messages integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, period_type, period_start, period_end)
);

-- 2. Agregar campos para contexto enriquecido a profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'long_term_persona'
  ) THEN
    ALTER TABLE profiles ADD COLUMN long_term_persona text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'persona_updated_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN persona_updated_at timestamptz;
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

CREATE POLICY "Service role can manage periodic summaries"
  ON periodic_summaries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Función para obtener contexto enriquecido del usuario
CREATE OR REPLACE FUNCTION get_user_enhanced_context(p_user_id uuid)
RETURNS json AS $$
DECLARE
  user_profile profiles;
  recent_summaries periodic_summaries[];
  conversation_count integer;
  days_active integer;
  result json;
BEGIN
  -- Obtener perfil del usuario
  SELECT * INTO user_profile
  FROM profiles
  WHERE id = p_user_id;

  -- Obtener resúmenes recientes (últimos 3)
  SELECT array_agg(ps ORDER BY ps.period_end DESC) INTO recent_summaries
  FROM (
    SELECT *
    FROM periodic_summaries
    WHERE user_id = p_user_id
    ORDER BY period_end DESC
    LIMIT 3
  ) ps;

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
      'long_term_persona', user_profile.long_term_persona,
      'persona_updated_at', user_profile.persona_updated_at
    ),
    'recent_summaries', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'period_type', s.period_type,
          'summary', s.summary,
          'key_themes', s.key_themes,
          'emotional_patterns', s.emotional_patterns,
          'growth_insights', s.growth_insights,
          'period_end', s.period_end,
          'created_at', s.created_at
        )
      ) FROM unnest(recent_summaries) s),
      '[]'::json
    ),
    'usage_stats', json_build_object(
      'total_conversations', conversation_count,
      'days_active_last_month', days_active
    )
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_periodic_summaries_user_period 
ON periodic_summaries(user_id, period_type, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_user_date 
ON conversations(user_id, created_at DESC);

-- 7. Configurar cron jobs para generar resúmenes automáticamente

-- Primero, verificar que la extensión pg_cron esté disponible
DO $$
BEGIN
  -- Resúmenes semanales: cada lunes a las 02:00 UTC (para procesar la semana anterior)
  PERFORM cron.schedule(
    'generate-weekly-summaries',
    '0 2 * * 1',  -- Lunes a las 02:00 UTC
    $$
    SELECT net.http_post(
      url := 'https://awqkjxprdocadfmnjjrz.supabase.co/functions/v1/generate-periodic-summary',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('period_type', 'weekly')
    );
    $$
  );

  -- Resúmenes mensuales: primer día de cada mes a las 03:00 UTC (para procesar el mes anterior)
  PERFORM cron.schedule(
    'generate-monthly-summaries',
    '0 3 1 * *',  -- Primer día del mes a las 03:00 UTC
    $$
    SELECT net.http_post(
      url := 'https://awqkjxprdocadfmnjjrz.supabase.co/functions/v1/generate-periodic-summary',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('period_type', 'monthly')
    );
    $$
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Si hay algún error con cron, lo registramos pero no fallamos la migración
    RAISE NOTICE 'Could not schedule cron jobs: %', SQLERRM;
END $$;

-- 8. Comentarios para documentación
COMMENT ON TABLE periodic_summaries IS 'Almacena resúmenes automáticos semanales y mensuales de las reflexiones del usuario';
COMMENT ON COLUMN periodic_summaries.period_type IS 'Tipo de período: weekly o monthly';
COMMENT ON COLUMN periodic_summaries.summary IS 'Resumen generado por IA del período';
COMMENT ON COLUMN periodic_summaries.key_themes IS 'Temas principales identificados en el período';
COMMENT ON COLUMN periodic_summaries.emotional_patterns IS 'Patrones emocionales observados';
COMMENT ON COLUMN periodic_summaries.growth_insights IS 'Insights sobre crecimiento personal';

COMMENT ON COLUMN profiles.long_term_persona IS 'Perfil psicológico profundo generado a partir de resúmenes históricos';
COMMENT ON COLUMN profiles.persona_updated_at IS 'Última vez que se actualizó el perfil psicológico';