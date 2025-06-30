# Pulpa.work - AI-Powered Voice Reflection Platform

*Last updated: December 30, 2024, 20:06:24 (GMT-3)*

Pulpa.work is a sophisticated web application for voice-guided self-reflection that combines AI conversation, semantic search, and automated analytics to help users develop deeper self-awareness and track personal growth over time.

## 🌟 Core Features

### 🎙️ Voice-Guided Reflection
- **Natural Conversation:** Speak naturally with an AI that adapts to your communication style
- **Asynchronous Processing:** Handle long recordings without timeouts using Google Cloud Speech-to-Text
- **Multi-language Support:** Full support for Spanish and English with cultural context
- **Real-time Visualization:** Audio level monitoring and recording duration display

### 🧠 AI-Powered Insights
- **Contextual Conversations:** AI maintains deep context using your profile, goals, and reflection history
- **Long-term Persona:** Automatically developed psychological profile that evolves with your reflections
- **Adaptive Questioning:** Questions become more sophisticated as the AI learns about you
- **Meta-Reflection:** Ask questions about your patterns and get AI-powered insights

### 🔍 Advanced Search & Discovery
- **Semantic Search:** Find conceptually similar thoughts using vector embeddings, not just keywords
- **Pattern Analysis:** AI analyzes search results to help you understand recurring themes
- **Cross-Reference Navigation:** Click through from insights to original conversations
- **Dual Search Modes:** Both semantic and traditional keyword search available

### 📊 Automated Analytics
- **Weekly Summaries:** Automatically generated every Monday with key themes and patterns
- **Monthly Deep Dives:** Comprehensive analysis with emotional patterns and growth insights
- **Theme Tracking:** Identify how your concerns and interests evolve over time
- **Emotional Intelligence:** Track emotional patterns and mental health trends

## 🏗️ Technical Architecture

### Frontend Stack
- **React 18** with TypeScript for type safety
- **Vite** for fast development and optimized builds
- **TailwindCSS** for responsive, modern design
- **Zustand** for state management
- **React Router** for navigation
- **Lucide React** for consistent iconography

### Backend Infrastructure
- **Supabase** for database, authentication, and serverless functions
- **PostgreSQL** with pgvector extension for semantic search
- **Deno** runtime for Edge Functions
- **Google Cloud** Speech-to-Text for transcription
- **Google Gemini Pro** for AI conversations
- **ElevenLabs** for natural voice synthesis

### AI & Analytics
- **Vector Embeddings:** Google text-embedding-004 for semantic search
- **Automated Scheduling:** pg_cron for periodic summary generation
- **Context Management:** Multi-layered AI context with persona and summaries
- **Pattern Recognition:** Advanced analytics for emotional and thematic patterns

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- API keys for Google Cloud, Google AI, and ElevenLabs

### 1. Clone and Install

```bash
git clone <repository-url>
cd pulpa-work
npm install
```

### 2. Set Up Supabase

```bash
# Start local Supabase services
npx supabase start

# Link to your Supabase project (optional)
npx supabase link --project-ref <your-project-ref>

# Apply database migrations
npx supabase db push
```

### 3. Configure Environment Variables

Create `.env` in the project root:

```env
# Supabase Configuration (from your project settings)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Create `supabase/.env` for Edge Functions:

```env
# Google AI Services
GOOGLE_API_KEY=your-google-api-key
GOOGLE_SERVICE_ACCOUNT_CREDENTIALS='{"type": "service_account", ...}'
GCS_BUCKET_NAME=your-gcs-bucket-name

# ElevenLabs Text-to-Speech
ELEVENLABS_API_KEY=your-elevenlabs-api-key
```

### 4. Deploy Edge Functions

```bash
# Deploy all functions
npx supabase functions deploy

# Or deploy specific functions
npx supabase functions deploy transcribe
npx supabase functions deploy chat-ai
npx supabase functions deploy text-to-speech
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

## 📋 Detailed Data Flow

### Recording to Insight Pipeline

1. **Audio Capture** → Browser MediaRecorder API with real-time visualization
2. **Async Transcription** → Google Cloud Speech-to-Text with status polling
3. **Message Storage** → Supabase with vector embedding generation
4. **AI Response** → Google Gemini with enhanced context (persona + summaries)
5. **Voice Synthesis** → ElevenLabs TTS with robust audio handling
6. **Periodic Analysis** → Automated weekly/monthly summaries via cron jobs
7. **Persona Evolution** → Long-term psychological profile updates
8. **Enhanced Context** → Enriched context feeds back into future conversations

### Search and Discovery Flow

1. **User Query** → Semantic search interface with natural language
2. **Vector Search** → pgvector similarity matching with relevance scoring
3. **Result Presentation** → Ranked results with similarity percentages
4. **Meta-Analysis** → AI analyzes patterns across search results
5. **Insight Generation** → Personalized reflections on user patterns
6. **Navigation** → Click-through to source conversations for context

## 🗄️ Database Schema

### Core Tables

- **`profiles`** - Extended user profiles with preferences and long-term persona
- **`conversations`** - Reflection sessions with AI-generated summaries
- **`messages`** - Individual messages with vector embeddings for search
- **`periodic_summaries`** - Automated weekly/monthly analytics with insights

### Advanced Features

- **Vector Search** - pgvector extension for semantic similarity
- **Automated Analytics** - pg_cron for scheduled summary generation
- **RLS Security** - Row-level security ensuring data privacy
- **Atomic Operations** - Transactional message storage with embeddings

## 🔧 Edge Functions

### Core Functions

| Function | Purpose | Features |
|----------|---------|----------|
| `transcribe` | Start async audio transcription | GCS upload, long-running recognition |
| `get-transcription-status` | Poll transcription progress | Status checking, file cleanup |
| `chat-ai` | AI conversation with context | Enhanced prompting, meta-reflection |
| `text-to-speech` | Voice synthesis | Multi-voice, robust streaming |
| `semantic-search` | Vector-based search | pgvector integration, relevance scoring |
| `add-message` | Store messages with embeddings | Atomic operations, error handling |
| `generate-periodic-summary` | Automated analytics | Weekly/monthly insights, persona updates |

### Shared Utilities

- **`google-helpers.ts`** - Authentication, GCS operations, Speech-to-Text
- **`types.ts`** - TypeScript interfaces for Google APIs
- **`cors.ts`** - Standardized CORS headers

## 🎨 UI/UX Features

### Modern Design System
- **Glassmorphism** - Translucent panels with backdrop blur effects
- **Responsive Layout** - Optimized for mobile and desktop
- **Real-time Feedback** - Audio visualization and progress indicators
- **Smooth Animations** - Micro-interactions and state transitions

### User Experience
- **Guided Onboarding** - Step-by-step setup for new users
- **Voice Selection** - Multiple voices for different languages
- **Conversation Panel** - Elegant chat interface with message history
- **Memory Lane** - Advanced search interface with dual search modes

## 📊 Analytics & Insights

### Automated Analysis
- **Weekly Summaries** - Generated every Monday at 02:00 UTC
- **Monthly Reports** - First of each month at 03:00 UTC
- **Pattern Recognition** - Emotional trends and thematic evolution
- **Growth Tracking** - Personal development insights over time

### AI Context Enhancement
- **Long-term Persona** - Psychological profile based on reflection patterns
- **Recent Context** - Integration of recent summaries into conversations
- **Adaptive Responses** - AI learns communication preferences
- **Cultural Awareness** - Language-appropriate responses and cultural context

## 🔒 Security & Privacy

### Data Protection
- **End-to-end Encryption** - All data encrypted in transit and at rest
- **Row-level Security** - Database policies ensure data isolation
- **JWT Authentication** - Secure token-based authentication
- **API Key Protection** - Server-side API key management

### Privacy Controls
- **Data Ownership** - Users own and control their reflection data
- **Export Capabilities** - Full data export in standard formats
- **Deletion Rights** - Complete data removal on request
- **Anonymization** - Optional anonymous analytics participation

## 🚀 Deployment

### Frontend (Netlify)
```bash
# Build for production
npm run build

# Deploy to Netlify (automatic via Git integration)
```

### Backend (Supabase)
```bash
# Deploy all Edge Functions
npx supabase functions deploy

# Apply database migrations
npx supabase db push
```

### Environment Setup
- **Production Environment Variables** - Configure in Netlify dashboard
- **Supabase Secrets** - Set in Supabase dashboard under Edge Functions
- **Domain Configuration** - Custom domain setup in Netlify

## 📈 Performance Optimization

### Frontend Optimization
- **Code Splitting** - Lazy loading for optimal bundle sizes
- **Image Optimization** - WebP format with fallbacks
- **Caching Strategy** - Service worker for offline capabilities
- **CDN Distribution** - Global content delivery via Netlify

### Backend Optimization
- **Database Indexing** - Optimized indexes for common queries
- **Vector Search** - HNSW indexes for fast similarity search
- **Function Caching** - Intelligent caching for AI responses
- **Resource Management** - Efficient memory and CPU usage

## 🔮 Future Roadmap

### Planned Features
- **Visual Analytics** - Charts and graphs of reflection patterns
- **Mobile Apps** - Native iOS and Android applications
- **API Access** - Developer API for third-party integrations
- **Collaboration Tools** - Sharing insights with coaches/therapists

### Technical Improvements
- **Real-time Features** - Live collaboration and instant insights
- **Advanced AI** - Integration with next-generation language models
- **Offline Support** - Local storage and sync capabilities
- **Performance** - Further optimization for global scale

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for:
- Code style and standards
- Testing requirements
- Pull request process
- Issue reporting

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation** - Comprehensive guides in the `/docs` folder
- **Issues** - Report bugs and request features via GitHub Issues
- **Community** - Join our Discord for discussions and support
- **Email** - Contact us at support@pulpa.work

---

**Built with ❤️ using modern web technologies and AI to help people discover deeper insights about themselves through reflection.**