/*
  # Periodic Summaries and Enhanced User Context

  1. New Tables
    - `periodic_summaries`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `period_type` (text, 'weekly' or 'monthly')
      - `period_start` (date)
      - `period_end` (date)
      - `summary` (text)
      - `key_themes` (text array)
      - `emotional_patterns` (text array)
      - `growth_insights` (text array)
      - `conversation_count` (integer)
      - `total_messages` (integer)
      - `created_at` (timestamptz)

  2. Profile Enhancements
    - Add `long_term_persona` column to profiles
    - Add `persona_updated_at` column to profiles

  3. Security
    - Enable RLS on `periodic_summaries` table
    - Add policies for users to read their own summaries
    - Add policies for service role to manage all summaries

  4. Functions
    - `insert_periodic_summary()` for atomic summary insertion
    - `get_user_context_for_ai()` for enhanced AI context

  5. Automation
    - Weekly summary generation cron job (Mondays at 02:00 UTC)
    - Monthly summary generation cron job (1st of month at 03:00 UTC)
*/

-- 1. Create periodic summaries table
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

-- 2. Add long-term persona fields to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'long_term_persona'
  ) THEN
    ALTER TABLE profiles ADD COLUMN long_term_persona text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'persona_updated_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN persona_updated_at timestamptz;
  END IF;
END $$;

-- 3. Enable RLS on periodic_summaries (only if table exists and RLS not already enabled)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'periodic_summaries') THEN
    ALTER TABLE periodic_summaries ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 4. Security policies for periodic_summaries (with existence checks)
DO $$
BEGIN
  -- Policy for users to read their own summaries
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'periodic_summaries' 
    AND policyname = 'Users can read their own periodic summaries'
  ) THEN
    CREATE POLICY "Users can read their own periodic summaries"
      ON periodic_summaries
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  -- Policy for service role to manage all summaries
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'periodic_summaries' 
    AND policyname = 'Service role can manage periodic summaries'
  ) THEN
    CREATE POLICY "Service role can manage periodic summaries"
      ON periodic_summaries
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 5. Function for inserting periodic summaries with conflict handling
CREATE OR REPLACE FUNCTION insert_periodic_summary(
  p_user_id uuid,
  p_period_type text,
  p_period_start date,
  p_period_end date,
  p_summary text,
  p_key_themes text[] DEFAULT NULL,
  p_emotional_patterns text[] DEFAULT NULL,
  p_growth_insights text[] DEFAULT NULL,
  p_conversation_count integer DEFAULT 0,
  p_total_messages integer DEFAULT 0
) RETURNS periodic_summaries AS $$
DECLARE
  new_summary periodic_summaries;
BEGIN
  INSERT INTO periodic_summaries (
    user_id,
    period_type,
    period_start,
    period_end,
    summary,
    key_themes,
    emotional_patterns,
    growth_insights,
    conversation_count,
    total_messages
  ) VALUES (
    p_user_id,
    p_period_type,
    p_period_start,
    p_period_end,
    p_summary,
    p_key_themes,
    p_emotional_patterns,
    p_growth_insights,
    p_conversation_count,
    p_total_messages
  )
  ON CONFLICT (user_id, period_type, period_start, period_end)
  DO UPDATE SET
    summary = EXCLUDED.summary,
    key_themes = EXCLUDED.key_themes,
    emotional_patterns = EXCLUDED.emotional_patterns,
    growth_insights = EXCLUDED.growth_insights,
    conversation_count = EXCLUDED.conversation_count,
    total_messages = EXCLUDED.total_messages,
    created_at = now()
  RETURNING * INTO new_summary;

  RETURN new_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function for getting enhanced user context for AI
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
  -- Get user profile
  SELECT * INTO user_profile
  FROM profiles
  WHERE id = p_user_id;

  -- Get most recent weekly summary
  SELECT * INTO recent_weekly_summary
  FROM periodic_summaries
  WHERE user_id = p_user_id AND period_type = 'weekly'
  ORDER BY period_end DESC
  LIMIT 1;

  -- Get most recent monthly summary
  SELECT * INTO recent_monthly_summary
  FROM periodic_summaries
  WHERE user_id = p_user_id AND period_type = 'monthly'
  ORDER BY period_end DESC
  LIMIT 1;

  -- Get usage statistics
  SELECT COUNT(*) INTO conversation_count
  FROM conversations
  WHERE user_id = p_user_id;

  SELECT COUNT(DISTINCT DATE(created_at)) INTO days_active
  FROM conversations
  WHERE user_id = p_user_id
    AND created_at >= now() - interval '30 days';

  -- Build result JSON
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
            'summary', recent_weekly_summary.summary,
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
            'summary', recent_monthly_summary.summary,
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

-- 7. Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_periodic_summaries_user_period 
ON periodic_summaries(user_id, period_type, period_end DESC);

-- 8. Set up cron jobs for automated summary generation (simplified approach)
-- Note: We'll create these without existence checks to avoid complex nested delimiter issues
-- If they already exist, the migration will show a warning but continue

-- Weekly summaries: Every Monday at 02:00 UTC
SELECT cron.schedule(
  'generate-weekly-summaries',
  '0 2 * * 1',
  $CRON$
  SELECT net.http_post(
    url := 'https://awqkjxprdocadfmnjjrz.supabase.co/functions/v1/generate-periodic-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := jsonb_build_object('period_type', 'weekly')
  );
  $CRON$
);

-- Monthly summaries: 1st of each month at 03:00 UTC
SELECT cron.schedule(
  'generate-monthly-summaries',
  '0 3 1 * *',
  $CRON$
  SELECT net.http_post(
    url := 'https://awqkjxprdocadfmnjjrz.supabase.co/functions/v1/generate-periodic-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := jsonb_build_object('period_type', 'monthly')
  );
  $CRON$
);