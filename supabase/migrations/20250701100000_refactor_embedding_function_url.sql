-- Refactor create_embedding_for_message to use Supabase Vault for the Edge Function URL

CREATE OR REPLACE FUNCTION public.create_embedding_for_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_embedding vector(768);
  v_url text;
  v_payload jsonb;
  v_headers jsonb;
  v_response jsonb;
BEGIN
  -- Get the Edge Function URL from Supabase Vault
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'EDGE_FUNCTION_GENERATE_EMBEDDING_URL';

  -- If the URL is not configured, raise an error
  IF v_url IS NULL THEN
    RAISE EXCEPTION 'Secret EDGE_FUNCTION_GENERATE_EMBEDDING_URL not found in Vault.';
  END IF;

  -- Build the payload and headers
  v_payload := jsonb_build_object('text', NEW.text);
  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('request.jwt.claim', true)
  );

  -- Call the Edge Function to generate the embedding
  SELECT
    content::jsonb INTO v_response
  FROM
    extensions.http_post(
      v_url,
      v_payload::text,
      'application/json',
      v_headers::text
    );

  -- Extract the embedding from the response
  v_embedding := (v_response->'embedding')::text::vector;

  -- Update the message row with the generated embedding
  UPDATE public.messages
  SET
    embedding = v_embedding
  WHERE
    id = NEW.id;

  RETURN NEW;
END;
$$;
