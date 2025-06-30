-- Step 1: Drop all overloaded versions of the function to resolve ambiguity.
-- This command removes all functions named 'match_messages' regardless of their arguments.
DROP FUNCTION IF EXISTS public.match_messages;

-- Step 2: Recreate the function with the correct, unambiguous signature.
CREATE OR REPLACE FUNCTION public.match_messages(
  p_user_id uuid,
  query_embedding vector(768),
  match_threshold double precision,
  match_count integer
)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  role text,
  text text,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.conversation_id,
    m.role,
    m.text,
    m.created_at,
    (1 - (m.embedding <=> query_embedding))::float as similarity
  FROM
    public.messages AS m
  INNER JOIN
    public.conversations AS c ON m.conversation_id = c.id
  WHERE
    c.user_id = p_user_id AND (1 - (m.embedding <=> query_embedding)) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT
    match_count;
END;
$$;
