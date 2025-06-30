-- 1. Drop the old function with the incorrect signature (bigint).
-- We specify the argument types to avoid ambiguity and ensure we drop the correct one.
-- Note: PostgreSQL requires the types, not the names, for the signature.
DROP FUNCTION IF EXISTS public.insert_message_with_embedding(bigint, message_role, text, vector);

-- 2. Recreate the function with the correct signature (uuid).
CREATE OR REPLACE FUNCTION public.insert_message_with_embedding(
  p_conversation_id uuid,
  p_role message_role,
  p_text text,
  p_embedding vector(1536)
)
RETURNS SETOF messages
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.messages (conversation_id, role, text, embedding)
  VALUES (p_conversation_id, p_role, p_text, p_embedding)
  RETURNING *;
END;
$$;