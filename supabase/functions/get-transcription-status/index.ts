// supabase/functions/get-transcription-status/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleServiceAccount } from "../_shared/types.ts";
import {
  getGoogleCloudAccessToken,
  getTranscriptionResult,
  deleteFromGcs,
} from "../_shared/google-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

interface CheckStatusRequest {
  operationName: string;
  gcsFileName: string;
}

serve(async (req: Request) => {
  console.log(`\n=== 🔄 Check Transcription Status Request Received [${new Date().toISOString()}] ===`);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let accessToken: string | null = null;
  const gcsBucketName = Deno.env.get("GCS_BUCKET_NAME")?.trim();

  try {
    // 1. Get credentials and validate request body
    const credentialsJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_CREDENTIALS");
    if (!credentialsJson) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_CREDENTIALS");
    if (!gcsBucketName) throw new Error("Missing GCS_BUCKET_NAME environment variable");
    const serviceAccount: GoogleServiceAccount = JSON.parse(credentialsJson);

    const { operationName, gcsFileName }: CheckStatusRequest = await req.json();
    if (!operationName) throw new Error('Missing operationName in request body');
    if (!gcsFileName) throw new Error('Missing gcsFileName in request body');

    // 2. Authenticate with Google Cloud
    console.log("🔑 Authenticating with Google Cloud...");
    const scope = "https://www.googleapis.com/auth/cloud-platform";
    accessToken = await getGoogleCloudAccessToken(serviceAccount, scope);
    console.log("✅ Google Cloud authentication successful.");

    // 3. Check the status of the transcription job
    const operationResult = await getTranscriptionResult(operationName, accessToken);

    if (!operationResult.done) {
      console.log("⏳ Transcription is still in progress.");
      return new Response(
        JSON.stringify({ success: true, done: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Process the finished job
    console.log("✅ Transcription job is done.");
    if (operationResult.error) {
      throw new Error(`Transcription failed: ${operationResult.error.message}`);
    }

    const transcript = operationResult.response?.results
      ?.map(result => result.alternatives[0].transcript)
      .join('\n') || "";
      
    console.log(`📝 Final transcript: "${transcript}"`);

    // 5. Clean up the GCS file and return the transcript
    console.log(`Cleaning up GCS file: ${gcsFileName}...`);
    await deleteFromGcs(gcsFileName, accessToken, gcsBucketName);

    return new Response(
      JSON.stringify({ success: true, done: true, transcript }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error("=== ❌ Error in get-transcription-status function ===");
    console.error("Error message:", error.message);
    console.error("Timestamp:", new Date().toISOString());
    return new Response(
      JSON.stringify({ success: false, error: error.message || "An unknown error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});