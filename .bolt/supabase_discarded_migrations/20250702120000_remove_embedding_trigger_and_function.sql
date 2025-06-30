-- Remove the redundant trigger and function for generating embeddings from the database.
-- This logic is now handled exclusively by the 'add-message' and 'generate-embedding' Edge Functions.

DROP TRIGGER IF EXISTS trigger_generate_embedding_on_new_message ON public.messages;

DROP FUNCTION IF EXISTS public.create_embedding_for_message();
