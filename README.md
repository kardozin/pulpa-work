# Pulpa.work - Voice-Guided Self-Reflection App

*Última actualización: 29 de junio de 2025, 20:06:24 (GMT-3)*

Pulpa.work is a web application designed for voice-guided self-reflection. It acts as an AI-powered "stoic interviewer" that helps users delve deeper into their daily thoughts and experiences through a spoken dialogue, building a searchable, long-term knowledge base of their insights.

## Core Features

### 1. Conversational AI Flow
-   **Voice Recording**: Captures user audio via the browser's `MediaRecorder`.
-   **Asynchronous Transcription**: Uses a two-step process (`/transcribe` and `/get-transcription-status` functions) with Google Cloud Speech-to-Text to handle long audio without timeouts.
-   **Contextual AI Inquiry**: The `/chat-ai` function uses Google Gemini, leveraging `systemInstruction` and user profile data (`full_name`, `role`, `goals`) to provide personalized and context-aware follow-up questions.
-   **Reliable Speech Synthesis**: The `/text-to-speech` function securely calls the ElevenLabs API and returns audio as a Base64 string within a JSON object to prevent data corruption.

### 2. Knowledge Base & Memory
Beyond the real-time conversation, Pulpa.work is designed to build a long-term, searchable knowledge base of the user's thoughts.

-   **Persistent Storage**: Every conversation, including each user message and AI response, is saved to the `conversations` and `messages` tables in the database.
-   **Automatic Summarization**: At the end of a session, the `summarize-conversation` function is triggered to generate a concise, AI-powered summary of the key insights, which is stored with the conversation.
-   **Memory Lane Interface**: The `MemoryLane.tsx` component provides a dedicated view for users to browse, read, and revisit their past conversations and summaries.
-   **Dual-Mode Search**: The application implements two powerful search methods:
    1.  **Keyword Search**: A simple text search to find conversations containing specific words.
    2.  **Semantic Search**: An advanced search powered by the `semantic-search` function and `pgvector`. It allows users to ask questions in natural language and find the most conceptually relevant thoughts, even if the exact words don't match.

### 3. User Management & Onboarding
-   **Guided Onboarding**: A mandatory, one-time flow guides new users to set up their profile, including `full_name`, `role`, `goals`, and voice/language preferences.
-   **Profile Management**: Users can edit their profile at any time, and this data is used to personalize the AI's interaction.
-   **Secure Authentication**: All core Edge Functions are protected and require a valid user JWT.

## Tech Stack

-   **Frontend**: React, TypeScript, Vite, TailwindCSS
-   **Backend & DB**: Supabase (PostgreSQL, Auth, Edge Functions, pgvector)
-   **External APIs**: Google Cloud Speech-to-Text, Google Gemini Pro, ElevenLabs

---

## Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or later)
-   [Supabase CLI](https://supabase.com/docs/guides/cli)
-   API keys for Google Cloud and ElevenLabs.

### 1. Clone the Repository

```bash
git clone <repository-url>
cd pulpa-work
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1.  **Start Supabase services**:

    ```bash
    npx supabase start
    ```

2.  **Link your local project to your Supabase project** (if you have one):

    ```bash
    npx supabase link --project-ref <your-project-ref>
    ```

3.  **Push database migrations**:

    ```bash
    npx supabase db push
    ```

### 4. Configure Environment Variables

Create a `.env` file in the root of the project by copying the example file:

```bash
# For Windows
copy .env.example .env
# For macOS/Linux
cp .env.example .env
```

Then, create a `.env` file in the `supabase` directory for the Edge Functions:

```bash
# For Windows
copy supabase\.env.example supabase\.env
# For macOS/Linux
cp supabase/.env.example supabase/.env
```

You will need to populate these files with your specific keys and credentials.

**Root `.env` (for Vite/Frontend):**

```
# Get these from your Supabase project's "API" settings
VITE_SUPABASE_URL=https://awqkjxprdocadfmnjjrz.supabase.co
VITE_SUPABASE_ANON_KEY=your-cloud-project-public-anon-key
```

**`supabase/.env` (for Edge Functions):**

```
# Get this from your Google Cloud project
GOOGLE_API_KEY=your-google-api-key-for-gemini

# Get this from your ElevenLabs account
ELEVENLABS_API_KEY=your-elevenlabs-api-key

# This is the full JSON content of your Google Cloud Service Account key
# IMPORTANT: It should be a single line string. You can use an online tool to convert your JSON key to a single line.
GOOGLE_SERVICE_ACCOUNT_CREDENTIALS='{"type": "service_account", "project_id": "...", ...}'

# The name of your Google Cloud Storage bucket for audio files
GCS_BUCKET_NAME=your-gcs-bucket-name
```

### 5. Deploy Supabase Functions

Deploy your Edge Functions to the Supabase cloud:

```bash
# Deploy a specific function after making changes
npx supabase functions deploy <function-name>

# Or deploy all functions
npx supabase functions deploy
```

### 6. Run the Development Server

Start the Vite development server:

```bash
npm run dev
```

The application should now be running on `http://localhost:5173`.

---

## Detailed Data Flow

This section provides a step-by-step technical breakdown of a single user interaction cycle, including database operations.

### Phase 1: Audio Recording (Frontend)
1.  **Trigger**: User holds the recording button.
2.  **Action**: `useAppLogic.ts` initializes `MediaRecorder`.
3.  **Completion**: User releases the button, `mediaRecorder.stop()` is called.

### Phase 2: Asynchronous Transcription & Conversation Creation (Frontend → Supabase → Google STT)
1.  **Trigger**: `onstop` event fires. The audio `Blob` is created.
2.  **API Call (Create Conversation)**: If it's the first message of a new session, the frontend first calls a function (`createConversation`) to insert a new row into the `conversations` table, getting back a `conversation_id`.
3.  **API Call (Start Transcription)**: The audio `Blob` is sent to the `/transcribe` function.
4.  **Backend Logic (`/transcribe`)**: Validates JWT, uploads audio to GCS, starts the Google STT job, and returns an `operationName`.
5.  **API Call (Polling for Status)**: Frontend polls `/get-transcription-status`.
6.  **Backend Logic (`/get-transcription-status`)**: Checks job status. On completion, returns the transcript and deletes the GCS file.

### Phase 3: Message Persistence (Frontend → Supabase)
1.  **Trigger**: The frontend receives a final text string to be saved (either a user's transcript or an AI's response).
2.  **API Call (Save Message)**: The frontend calls the `/add-message` Edge Function, sending the `conversation_id`, the `text` of the message, and the `role` (`'user'` or `'model'`).
3.  **Backend Logic (`/add-message`)**: This is the core of the new architecture.
    -   Validates the user's JWT.
    -   Calls the `/generate-embedding` function to create a vector embedding for the message text.
    -   Calls the `insert_message_with_embedding` database function (RPC) to save the message and its embedding in a single, atomic transaction.

### Phase 4: AI Chat Response (Frontend → Supabase → Google Gemini)
1.  **Trigger**: The user's message has been successfully saved via `/add-message`.
2.  **API Call**: The frontend sends the conversation history and user profile to the `/chat-ai` function.
3.  **Backend Logic (`/chat-ai`)**: Validates JWT and uses `systemInstruction` and profile data to generate a contextual response from Gemini.
4.  **Save AI Message**: The frontend receives the AI's text response and triggers **Phase 3** again, this time with the `role` set to `'model'`.

### Phase 4: Text-to-Speech (Frontend → Supabase → ElevenLabs)
1.  **Trigger**: Frontend receives the AI response.
2.  **API Call**: The AI's text is sent to the `/text-to-speech` function.
3.  **Backend Logic (`/text-to-speech`)**:
    -   Validates JWT.
    -   Calls ElevenLabs API.
    -   Reads the audio stream, encodes it to Base64, and returns it in a JSON object.
4.  **Playback**: Frontend decodes the Base64 audio and plays it.

### Phase 5: Session Summarization (Optional, e.g., on session end)
1.  **Trigger**: User ends the session (e.g., closes the conversation view).
2.  **API Call**: The frontend calls the `/summarize-conversation` function with the `conversation_id`.
3.  **Backend Logic (`/summarize-conversation`)**:
    -   Fetches all messages for the conversation.
    -   Sends the full text to Gemini to generate a summary.
    -   Updates the `summary` column in the `conversations` table for that `conversation_id`.
