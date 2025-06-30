# 🧬 Database Schema Documentation

*Last updated: December 30, 2024, 20:06:24 (GMT-3)*

This document describes the complete database architecture, security policies, and automated logic for the pulpa.work project in Supabase. It serves as the definitive source of truth for the data schema.

## Core Tables

### Table: `profiles`

Extended user profile information that enhances the base `auth.users` table with application-specific data.

| Column | Data Type | Nullable | Default/Foreign Key | Description |
| :--- | :--- | :--- | :--- | :--- |
| **id** | `uuid` | No | **Primary Key**, FK to `auth.users.id` | Unique user identifier |
| `created_at` | `timestamptz` | No | `now()` | Profile creation timestamp |
| `updated_at` | `timestamptz` | Yes | `NULL` | Last profile update timestamp |
| `full_name` | `text` | Yes | `NULL` | User's full name for personalization |
| `timezone` | `text` | Yes | `NULL` | User timezone (e.g., 'America/Argentina/Buenos_Aires') |
| `goals` | `text` | Yes | `NULL` | User's goals and objectives for using the app |
| `role` | `text` | Yes | `NULL` | User's profession or role for context |
| `preferred_language` | `text` | Yes | `NULL` | Language preference ('en-US' or 'es-AR') |
| `preferred_voice_id` | `text` | Yes | `NULL` | ElevenLabs voice ID for TTS |
| `onboarding_completed` | `boolean` | No | `false` | Whether user completed onboarding flow |
| `long_term_persona` | `text` | Yes | `NULL` | **NEW** - AI-generated psychological profile |
| `persona_updated_at` | `timestamptz` | Yes | `NULL` | **NEW** - Last persona update timestamp |

### Table: `conversations`

Records each reflection session between the user and the AI assistant.

| Column | Data Type | Nullable | Default/Foreign Key | Description |
| :--- | :--- | :--- | :--- | :--- |
| **id** | `uuid` | No | `gen_random_uuid()` / **Primary Key** | Unique conversation identifier |
| `user_id` | `uuid` | No | FK to `profiles.id` | Owner of the conversation |
| `created_at` | `timestamptz` | No | `now()` | Conversation start timestamp |
| `summary` | `text` | Yes | `NULL` | AI-generated conversation summary |

### Table: `messages`

Stores individual messages within conversations with vector embeddings for semantic search.

| Column | Data Type | Nullable | Default/Foreign Key | Description |
| :--- | :--- | :--- | :--- | :--- |
| **id** | `uuid` | No | `gen_random_uuid()` / **Primary Key** | Unique message identifier |
| `conversation_id` | `uuid` | No | FK to `conversations.id` | Parent conversation |
| `role` | `text` | No | `NULL` | Message sender ('user' or 'model') |
| `text` | `text` | No | `NULL` | Message content |
| `created_at` | `timestamptz` | No | `now()` | Message creation timestamp |
| `embedding` | `vector(768)` | Yes | `NULL` | Vector embedding for semantic search |

**Constraints:**
- `messages_role_check`: Ensures role is either 'user' or 'model'

### Table: `periodic_summaries` (NEW)

Automated weekly and monthly analysis of user reflections with insights and patterns.

| Column | Data Type | Nullable | Default/Foreign Key | Description |
| :--- | :--- | :--- | :--- | :--- |
| **id** | `uuid` | No | `gen_random_uuid()` / **Primary Key** | Unique summary identifier |
| `user_id` | `uuid` | No | FK to `profiles.id` | Summary owner |
| `period_type` | `text` | No | `NULL` | Summary period ('weekly' or 'monthly') |
| `period_start` | `date` | No | `NULL` | Period start date |
| `period_end` | `date` | No | `NULL` | Period end date |
| `summary` | `text` | No | `NULL` | AI-generated narrative summary |
| `key_themes` | `text[]` | Yes | `NULL` | Main themes identified in the period |
| `emotional_patterns` | `text[]` | Yes | `NULL` | Emotional patterns observed |
| `growth_insights` | `text[]` | Yes | `NULL` | Personal growth insights |
| `conversation_count` | `integer` | Yes | `0` | Number of conversations in period |
| `total_messages` | `integer` | Yes | `0` | Total messages in period |
| `created_at` | `timestamptz` | Yes | `now()` | Summary creation timestamp |

**Constraints:**
- `periodic_summaries_period_type_check`: Ensures period_type is 'weekly' or 'monthly'
- Unique constraint on `(user_id, period_type, period_start, period_end)`

## Security Policies (Row Level Security)

All tables have RLS enabled with comprehensive policies to ensure data isolation.

| Table | Policy Name | Command | Purpose |
| :--- | :--- | :--- | :--- |
| `profiles` | `Allow authenticated users to read their own profile` | `SELECT` | Users can only read their own profile |
| `profiles` | `Allow authenticated users to insert their own profile` | `INSERT` | Users can create their own profile |
| `profiles` | `Allow authenticated users to update their own profile` | `UPDATE` | Users can modify their own profile |
| `conversations` | `Users can manage their own conversations` | `ALL` | Full CRUD access to own conversations |
| `messages` | `Users can manage messages in their conversations` | `ALL` | Access to messages in owned conversations |
| `periodic_summaries` | `Users can read their own periodic summaries` | `SELECT` | Read access to own summaries |
| `periodic_summaries` | `Service role can manage periodic summaries` | `ALL` | Service role for automated generation |

## Database Functions

### RPC Functions (Remote Procedure Call)

These functions provide secure, optimized operations for the application.

#### 1. `insert_message_with_embedding(p_conversation_id, p_role, p_text, p_embedding)`
**Purpose:** Atomically insert a message with its vector embedding.
**Usage:** Called by the `add-message` Edge Function after generating embeddings.
**Returns:** The inserted message record.

#### 2. `pulpa_match_messages(p_user_id, query_embedding, match_threshold, match_count)`
**Purpose:** Semantic search using vector similarity.
**Parameters:**
- `p_user_id`: User to search within
- `query_embedding`: Vector to match against
- `match_threshold`: Minimum similarity score (0.0-1.0)
- `match_count`: Maximum results to return
**Returns:** Array of matching messages with similarity scores.

#### 3. `get_user_enhanced_context(p_user_id)` (NEW)
**Purpose:** Retrieve comprehensive user context for AI conversations.
**Returns:** Formatted string with:
- Long-term psychological persona
- Recent periodic summaries
- Key themes and patterns
- Emotional insights

### Trigger Functions

#### 1. `handle_new_user()`
**Purpose:** Automatically create a profile when a user registers.
**Trigger:** `AFTER INSERT` on `auth.users`

## Automated Analytics System

### Cron Jobs (pg_cron)

The system includes automated jobs for generating insights:

#### Weekly Summary Generation
- **Schedule:** Every Monday at 02:00 UTC
- **Function:** `generate-periodic-summary`
- **Scope:** All users with activity in the past week

#### Monthly Summary Generation
- **Schedule:** 1st of each month at 03:00 UTC
- **Function:** `generate-periodic-summary`
- **Scope:** All users with activity in the past month
- **Additional:** Updates long-term persona based on accumulated insights

### Analytics Data Flow

1. **Data Collection:** Messages stored with embeddings during conversations
2. **Periodic Analysis:** Cron jobs trigger summary generation
3. **Pattern Recognition:** AI identifies themes, emotions, and growth patterns
4. **Persona Evolution:** Monthly updates to psychological profile
5. **Context Enhancement:** Enriched context feeds back into future conversations

## Indexes and Performance

### Optimized Indexes

| Table | Index Name | Definition | Purpose |
| :--- | :--- | :--- | :--- |
| `conversations` | `idx_conversations_user_date` | `(user_id, created_at DESC)` | Fast user conversation lookup |
| `periodic_summaries` | `idx_periodic_summaries_user_period` | `(user_id, period_type, period_end DESC)` | Efficient summary queries |
| `messages` | Vector index on `embedding` | pgvector HNSW | Fast semantic search |

### Vector Search Configuration

- **Extension:** pgvector for PostgreSQL
- **Dimensions:** 768 (Google text-embedding-004)
- **Distance Function:** Cosine similarity
- **Index Type:** HNSW for optimal performance

## Data Types and Enums

### Custom Types

#### `message_role` (enum)
- Values: `'user'`, `'assistant'`, `'model'`
- Usage: Ensures consistent role identification

## Migration History

The database schema has evolved through several key migrations:

1. **Initial Schema:** Basic profiles, conversations, messages
2. **Onboarding Enhancement:** Added onboarding fields and status
3. **Vector Search:** Added pgvector extension and embedding columns
4. **Semantic Search:** Created optimized search functions
5. **Periodic Analytics:** Added summaries table and automation
6. **Enhanced Context:** Added long-term persona and context functions

## Data Retention and Cleanup

### Automatic Cleanup
- **Temporary Files:** GCS audio files deleted after transcription
- **Old Summaries:** Configurable retention period for periodic summaries
- **Embedding Backfill:** Function available for retroactive embedding generation

### Data Export
- **User Data:** Full export capabilities for GDPR compliance
- **Analytics:** Summary data can be exported for external analysis

## Security Considerations

### Data Protection
- **Encryption:** All data encrypted at rest and in transit
- **Access Control:** RLS policies enforce strict data isolation
- **API Security:** All functions require valid JWT tokens
- **Audit Trail:** Comprehensive logging of all data access

### Privacy Features
- **Data Minimization:** Only necessary data is collected and stored
- **User Control:** Users can delete their data at any time
- **Anonymization:** Analytics can be anonymized for research purposes

---

This schema supports a sophisticated AI-powered reflection platform with advanced analytics, semantic search, and automated insight generation while maintaining strict security and privacy standards.