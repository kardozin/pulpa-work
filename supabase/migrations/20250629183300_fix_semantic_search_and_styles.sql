DROP FUNCTION IF EXISTS pulpa_match_messages(uuid,vector,double precision,integer);

CREATE OR REPLACE FUNCTION pulpa_match_messages(
  p_user_id UUID,
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (id UUID, conversation_id UUID, content TEXT, role TEXT, created_at TIMESTAMPTZ, similarity FLOAT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.conversation_id,
    m.text AS content,
    m.role,
    m.created_at,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM
    messages AS m
  INNER JOIN
    conversations AS c ON m.conversation_id = c.id
  WHERE
    c.user_id = p_user_id
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT
    match_count;
END;
$$;
