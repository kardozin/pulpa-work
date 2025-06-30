// supabase/functions/_shared/types.ts

/**
 * Represents the structure of the Google Service Account credentials JSON.
 */
export interface GoogleServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

/**
 * Represents the structure of a long-running operation response from Google Speech API.
 */
export interface GoogleOperationResponse {
  name: string;
  done: boolean;
  response?: {
    results: Array<{
      alternatives: Array<{
        transcript: string;
        confidence: number;
      }>;
    }>;
  };
  error?: { code: number; message: string };
}
