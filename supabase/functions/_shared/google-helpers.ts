// supabase/functions/_shared/google-helpers.ts

import { GoogleServiceAccount, GoogleOperationResponse } from "./types.ts";

// --- Utility Functions ---

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Authentication Functions ---

async function createJwt(serviceAccount: GoogleServiceAccount, scope: string): Promise<string> {
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: serviceAccount.private_key_id,
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: serviceAccount.token_uri,
    iat: now,
    exp: now + 3600, // 1-hour expiration
    scope: scope,
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const privateKeyData = atob(serviceAccount.private_key.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\n/g, ""));
  const keyBuffer = new Uint8Array(privateKeyData.length).map((_, i) => privateKeyData.charCodeAt(i));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(dataToSign));
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${dataToSign}.${encodedSignature}`;
}

export async function getGoogleCloudAccessToken(serviceAccount: GoogleServiceAccount, scope: string): Promise<string> {
  try {
    const jwt = await createJwt(serviceAccount, scope);
    const response = await fetch(serviceAccount.token_uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Token request failed:", response.status, errorText);
      throw new Error(`Failed to get access token: ${errorText}`);
    }
    const tokenData = await response.json();
    return tokenData.access_token;
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error("❌ Error getting Google Cloud access token:", error);
    throw new Error(`Token acquisition failed: ${error.message}`);
  }
}

// --- Google Cloud Storage Functions ---

export async function uploadToGcs(
  base64Audio: string,
  fileName: string,
  accessToken: string,
  bucketName: string,
  contentType = 'audio/webm'
): Promise<string> {
  console.log(`☁️ Uploading audio to GCS bucket: ${bucketName}, file: ${fileName}`);
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${encodeURIComponent(fileName)}`;
  
  const audioData = atob(base64Audio);
  const audioBuffer = new Uint8Array(audioData.length).map((_, i) => audioData.charCodeAt(i));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': contentType,
      'Content-Length': audioBuffer.length.toString(),
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`❌ GCS upload failed: ${response.status}`, errorBody);
    throw new Error(`Failed to upload to GCS: ${errorBody}`);
  }
  
  console.log(`✅ File uploaded successfully to GCS.`);
  return `gs://${bucketName}/${fileName}`;
}

export async function deleteFromGcs(
  fileName: string,
  accessToken: string,
  bucketName: string
): Promise<void> {
  console.log(`🗑️ Deleting file from GCS: ${fileName}`);
  const url = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o/${encodeURIComponent(fileName)}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (response.status === 404) {
    console.warn(`⚠️ File not found for deletion, might have been already deleted: ${fileName}`);
    return;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`❌ GCS delete failed: ${response.status}`, errorBody);
    throw new Error(`Failed to delete from GCS: ${errorBody}`);
  }

  console.log(`✅ File deleted successfully from GCS.`);
}

// --- Core Transcription Logic ---

export async function startLongRunningRecognition(
  gcsUri: string,
  accessToken: string,
  config: {
    languageCode: string;
    encoding: 'WEBM_OPUS' | 'LINEAR16';
    sampleRateHertz: number;
  }
): Promise<string> {
  console.log(`▶️ Starting long-running recognition for GCS URI: ${gcsUri}`);
  const url = 'https://speech.googleapis.com/v1/speech:longrunningrecognize';
  
  const body = {
    config: {
      encoding: config.encoding,
      sample_rate_hertz: config.sampleRateHertz,
      language_code: config.languageCode,
      enable_automatic_punctuation: true,
    },
    audio: { uri: gcsUri },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`❌ Failed to start transcription job: ${response.status}`, errorBody);
    throw new Error(`Failed to start transcription job: ${errorBody}`);
  }

  const data = await response.json();
  console.log(`✅ Transcription job started successfully. Operation name: ${data.name}`);
  return data.name;
}

export async function getTranscriptionResult(
  operationName: string,
  accessToken: string
): Promise<GoogleOperationResponse> {
  const url = `https://speech.googleapis.com/v1/operations/${operationName}`;
  console.log(`🔄 Checking operation status for: ${operationName}`);

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to check operation status: ${errorBody}`);
  }

  return await response.json();
}
