// supabase/functions/transcribe/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleServiceAccount } from "../_shared/types.ts";
import {
  getGoogleCloudAccessToken,
  uploadToGcs,
  startLongRunningRecognition,
} from "../_shared/google-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

interface TranscribeRequest {
  audioContent: string; // Base64 encoded audio
  languageCode?: string;
  encoding?: 'WEBM_OPUS' | 'LINEAR16';
  sampleRateHertz?: number;
}

serve(async (req: Request) => {
  console.log(`\n=== 🎙️ Transcribe Function Request Received [${new Date().toISOString()}] ===`);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Get environment variables and credentials
    const gcsBucketName = Deno.env.get("GCS_BUCKET_NAME")?.trim();
    const credentialsJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_CREDENTIALS");
    if (!credentialsJson) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_CREDENTIALS");
    if (!gcsBucketName) throw new Error("Missing GCS_BUCKET_NAME environment variable");
    const serviceAccount: GoogleServiceAccount = JSON.parse(credentialsJson);

    // 2. Parse request and get audio data
    const requestData: TranscribeRequest = await req.json();
    if (!requestData.audioContent) throw new Error('Missing audioContent in request body');

    // 3. Authenticate with Google Cloud
    console.log("🔑 Authenticating with Google Cloud...");
    const scope = "https://www.googleapis.com/auth/cloud-platform";
    const accessToken = await getGoogleCloudAccessToken(serviceAccount, scope);
    console.log("✅ Google Cloud authentication successful.");

    // 4. Upload audio to GCS
    const gcsFileName = `${new Date().toISOString().replace(/:/g, '-')}-${crypto.randomUUID()}.webm`;
    const gcsUri = await uploadToGcs(requestData.audioContent, gcsFileName, accessToken, gcsBucketName);

    // 5. Start the long-running recognition job
    const transcriptionConfig = {
      languageCode: requestData.languageCode || "es-AR",
      encoding: requestData.encoding || 'WEBM_OPUS',
      sampleRateHertz: requestData.sampleRateHertz || 48000,
    };
    const operationName = await startLongRunningRecognition(gcsUri, accessToken, transcriptionConfig);
    console.log(`🚀 Transcription job started. Operation Name: ${operationName}`);

    // 6. Return the operation name and GCS file name to the client immediately
    return new Response(
      JSON.stringify({ success: true, operationName, gcsFileName }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } } // 202 Accepted
    );

  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error("=== ❌ Error in transcribe function ===");
    console.error("Error message:", error.message);
    console.error("Timestamp:", new Date().toISOString());
    return new Response(
      JSON.stringify({ success: false, error: error.message || "An unknown error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});