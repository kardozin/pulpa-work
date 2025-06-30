import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Brain, Mic, MicOff, Pause, Loader2, MessageCircle, LogOut, User as UserIcon, X, ScrollText, Square } from 'lucide-react';
import { useProfile } from '../hooks/useProfile';
import ProfileForm from '../components/Profile';
import { useAppLogic } from '../hooks/useAppLogic';
import { useAuth } from '../hooks/useAuth';
import OnboardingFlow from '../components/OnboardingFlow';
import { useOnboardingStore } from '../stores/onboardingStore';
import { ConversationMessage } from '../types';
import AnimatedBackground from '../components/AnimatedBackground';
import MemoryLane from '../components/MemoryLane';
import ModalPanel from '../components/ui/ModalPanel';
import { MAX_TURN_DURATION } from '../config/audio';
import { useEffect } from 'react';

// Official Built with Bolt Badge Component (Hackathon Requirements)
const BoltBadge = () => (
  <div className="fixed bottom-4 right-4 z-50">
    <a 
      href="https://bolt.new" 
      target="_blank" 
      rel="noopener noreferrer"
      className="block transition-transform hover:scale-105"
    >
      <img 
        src="/logotext_poweredby_360w.png" 
        alt="Built with Bolt" 
        className="h-8 w-auto opacity-90 hover:opacity-100 transition-opacity"
        onError={(e) => {
          // Fallback if image fails to load
          e.currentTarget.style.display = 'none';
          const fallback = document.createElement('div');
          fallback.className = 'bg-black text-white px-3 py-1.5 rounded-lg shadow-lg border border-gray-700 text-xs font-medium';
          fallback.innerHTML = '⚡ Built with Bolt';
          e.currentTarget.parentNode?.appendChild(fallback);
        }}
      />
    </a>
  </div>
);

function MainApp() {
  // 1. Core Hooks Orchestration
  const auth = useAuth();
  const { profile, loading: profileLoading, updateProfile } = useProfile(auth.user);
  const {
    recordingState,
    conversationHistory,
    showConversation,
    setShowConversation,
    handleMainButtonClick,
    handleFinishSession,
    isSummarizing,
    currentConversationId,

  } = useAppLogic(profile, auth);

  // 2. UI State
  const [showProfile, setShowProfile] = useState(false);
  const [showMemoryLane, setShowMemoryLane] = useState(false);

  // 3. Apply no-scroll class to body when in main app
  useEffect(() => {
    document.body.classList.add('app-no-scroll');
    return () => {
      document.body.classList.remove('app-no-scroll');
    };
  }, []);

    const handleFinishOnboarding = async () => {
    // Get the final state directly from the Zustand store
    const { profileData, selectedLanguage, selectedVoiceId, resetOnboarding } = useOnboardingStore.getState();

    const finalPayload = {
      full_name: profileData.fullName,
      role: profileData.role || null,
      goals: profileData.goals || null,
      preferred_language: selectedLanguage,
      preferred_voice_id: selectedVoiceId,
      onboarding_completed: true,
    };

    await updateProfile(finalPayload);
    resetOnboarding(); // Reset the store for future sessions
  };

  const getButtonState = () => {
    console.log('🔍 Button State Debug:', {
      hasPermission: recordingState.hasPermission,
      error: recordingState.error,
      isRecording: recordingState.isRecording,
      isProcessing: recordingState.isProcessing,
      isAiThinking: recordingState.isAiThinking,
      isGeneratingAudio: recordingState.isGeneratingAudio,
      isPlayingAudio: recordingState.isPlayingAudio,
    });

    if (!recordingState.hasPermission) return 'permission';
    if (recordingState.error) return 'error';
    if (recordingState.isProcessing) return 'transcribing';
    if (recordingState.isAiThinking) return 'thinking';
    if (recordingState.isGeneratingAudio) return 'generating';
    if (recordingState.isPlayingAudio) return 'playing';
    if (recordingState.isRecording) return 'recording';
    return 'ready';
  };

  const getButtonIcon = () => {
    const buttonState = getButtonState();
    console.log('🎨 Button Icon for state:', buttonState);
    
    switch (buttonState) {
      case 'permission':
        return <MicOff className="w-12 h-12 text-white" />;
      case 'error':
        return <Mic className="w-12 h-12 text-white" />;
      case 'ready':
        return <Mic className="w-12 h-12 text-white" />;
      case 'recording':
        return <Square className="w-12 h-12 text-white" />;
      case 'transcribing':
      case 'thinking':
      case 'generating':
        return <Loader2 className="w-12 h-12 text-white animate-spin" />;
      case 'playing':
        return <Pause className="w-12 h-12 text-white" />;
      default:
        return <Mic className="w-12 h-12 text-white" />;
    }
  };

  const getButtonColor = () => {
    const buttonState = getButtonState();
    console.log('🎨 Button Color for state:', buttonState);
    
    switch (buttonState) {
      case 'permission':
        return 'bg-gray-600';
      case 'error':
        return 'bg-gradient-to-br from-red-500 to-red-600 shadow-2xl shadow-red-500/50 hover:scale-105';
      case 'ready':
        return 'bg-gradient-to-br from-indigo-400 to-purple-500 shadow-2xl shadow-indigo-500/50 hover:scale-105';
      case 'recording':
        return 'bg-gradient-to-br from-red-500 to-orange-500 shadow-2xl shadow-red-500/50 hover:scale-105';
      case 'transcribing':
      case 'thinking':
      case 'generating':
        return 'bg-gradient-to-br from-yellow-500 to-orange-500 shadow-2xl shadow-yellow-500/50';
      case 'playing':
        return 'bg-gradient-to-br from-orange-500 to-red-500 shadow-2xl shadow-orange-500/50 hover:scale-105';
      default:
        return 'bg-gradient-to-br from-indigo-400 to-purple-500 shadow-2xl shadow-indigo-500/50 hover:scale-105';
    }
  };

  const getButtonTooltip = () => {
    const buttonState = getButtonState();
    
    switch (buttonState) {
      case 'permission':
        return 'Click to enable microphone';
      case 'error':
        return 'Click to retry';
      case 'ready':
        return 'Click to start recording';
      case 'recording':
        return 'Click to stop recording';
      case 'transcribing':
        return 'Transcribing your voice...';
      case 'thinking':
        return 'AI is thinking...';
      case 'generating':
        return 'Generating audio response...';
      case 'playing':
        return 'Click to pause and enable microphone';
      default:
        return 'Click to interact';
    }
  };

  const buttonState = getButtonState();
  const isProcessing = ['transcribing', 'thinking', 'generating'].includes(buttonState);

  if (auth.isSessionLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col overflow-hidden">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    );
  }

    if (auth.user && profile && !profile.onboarding_completed) {
    return <OnboardingFlow onOnboardingComplete={handleFinishOnboarding} />;
  }

  if (!auth.user) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center p-4 overflow-hidden">
        <AnimatedBackground />
        <div className="w-full max-w-sm mx-auto z-10">
          <div className="text-center mb-10">
            <Brain className="w-10 h-10 text-primary mx-auto mb-2" />
            <h1 className="text-3xl font-light text-text-main tracking-wide">pulpa.work</h1>
          </div>
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/20 p-8">
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                className: {
                  button: 'rounded-full',
                  input: 'rounded-full',
                },
                variables: { default: { colors: { brand: 'hsl(153, 53%, 49%)', brandAccent: 'hsl(154, 56%, 43%)' } } },
              }}
              providers={[]}
              theme="dark"
              localization={{
                variables: {
                  sign_in: { email_label: 'Email', password_label: 'Contraseña', button_label: 'Iniciar Sesión' },
                  sign_up: { email_label: 'Email', password_label: 'Contraseña', button_label: 'Crear Cuenta' },
                },
              }}
            />
          </div>
        </div>
        
        <BoltBadge />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex flex-col items-center justify-center overflow-hidden">
      <AnimatedBackground />

      <header className="absolute top-0 left-0 right-0 p-4 z-20">
        <div className="container mx-auto flex justify-between items-center">
          <button onClick={() => setShowConversation(true)} className="p-3 rounded-full hover:bg-white/20 transition-colors" title="Show Conversation">
            <MessageCircle className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-4">
            <button onClick={() => setShowMemoryLane(true)} className="p-3 rounded-full hover:bg-white/20 transition-colors" title="Memory Lane">
              <ScrollText className="w-6 h-6" />
            </button>
            <button onClick={() => setShowProfile(true)} className="p-2 rounded-full hover:bg-white/20 transition-colors" title="Profile">
              <UserIcon className="w-6 h-6 text-white" />
            </button>
            <button onClick={auth.signOut} className="p-3 rounded-full hover:bg-white/20 transition-colors" title="Log Out">
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 min-h-screen grid grid-rows-[auto,1fr,auto] items-center justify-center p-8 w-full">
        {/* Bloque 1: Título */}
        <div className="text-center">
          <Brain className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-4xl font-light text-white tracking-wider">pulpa.work</h1>
        </div>

        {/* Bloque 2: Área de Acción Central */}
        <div className={`grid place-items-center transition-transform duration-500 ease-in-out ${showConversation ? '-translate-y-20' : 'translate-y-0'}`}>
          <div className="relative flex items-center justify-center w-52 h-52">
            {/* Anillo de procesamiento para cuando la IA está pensando */}
            <div className={`absolute inset-0 rounded-full transition-all duration-500 ease-in-out ${isProcessing ? 'bg-yellow-500/30 scale-100 animate-pulse' : 'bg-transparent scale-90'}`}></div>
            
            <button 
              onClick={handleMainButtonClick}
              disabled={!recordingState.hasPermission && recordingState.permissionDenied && !recordingState.error}
              title={getButtonTooltip()}
              className={`relative w-64 h-64 rounded-full flex items-center justify-center transition-all duration-300 transform-gpu focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${getButtonColor()}`}
            >
              <div className="absolute inset-4 rounded-full bg-white/10 backdrop-blur-sm"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                {getButtonIcon()}
              </div>
              {recordingState.isRecording && (
                <div 
                  className="absolute inset-0 rounded-full border-2 border-white/30 transition-all duration-100" 
                  style={{ 
                    transform: `scale(${1 + recordingState.audioLevel * 0.3})`, 
                    opacity: Math.max(0.3, 1 - recordingState.audioLevel * 0.5)
                  }}
                ></div>
              )}
            </button>
            {recordingState.isRecording && (
              <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 text-center w-48">
                <div className="text-white/80 text-sm font-light">
                  {Math.floor(recordingState.recordingDuration / 1000 / 60)}:{(Math.floor(recordingState.recordingDuration / 1000) % 60).toString().padStart(2, '0')}
                </div>
                <div className="w-full h-1 bg-white/20 rounded-full mt-2 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-blue-400 to-purple-400" style={{ width: `${Math.min((recordingState.recordingDuration / MAX_TURN_DURATION) * 100, 100)}%`, transition: 'width 1s linear' }}></div>
                </div>
              </div>
            )}
          </div>
          {currentConversationId && (
            <div className="h-16 mt-24 flex flex-col items-center">
              <button
                onClick={handleFinishSession}
                disabled={isSummarizing}
                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-6 py-2 text-sm font-medium text-white/80 hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {isSummarizing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Finish Session'
                )}
              </button>
              <p className="text-xs text-white/40 mt-2 text-center">
                Saves conversation and generates summary
              </p>
            </div>
          )}
        </div>

        {/* Bloque 3: Texto de Estado */}
        <div className="text-center h-10">
          <p className="text-white/70 text-lg transition-opacity duration-300">{recordingState.status}</p>
          {recordingState.error && <p className="text-red-400 mt-2">{recordingState.error}</p>}
        </div>
      </div>

      <BoltBadge />

      {/* Memory Lane Modal */}
      {showMemoryLane && (
        <MemoryLane
          onClose={() => setShowMemoryLane(false)}
        />
      )}

      {/* Profile Modal */}
      {showProfile && (
        <ModalPanel title="Edit Your Profile" onClose={() => setShowProfile(false)}>
          <ProfileForm profile={profile} onSave={updateProfile} loading={profileLoading} />
        </ModalPanel>
      )}

      {/* Conversation Bottom Sheet - Enhanced Glassmorphism */}
      <div
        className={`
          fixed bottom-4 left-4 right-4 z-30 transform transition-transform duration-500 ease-in-out
          ${showConversation ? 'translate-y-0' : 'translate-y-[calc(100%+2rem)]'}
        `}
      >
        <div className="h-auto max-h-[45vh] max-w-4xl mx-auto bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl shadow-black/20 flex flex-col p-6">
          {/* Drag Handle */}
          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-white/20 mb-6 cursor-grab hover:bg-white/30 transition-colors" onPointerDown={() => setShowConversation(false)}></div>
          
          {/* Header */}
          <div className="flex items-center justify-between pb-4 flex-shrink-0 border-b border-white/10">
            <h2 className="text-xl font-semibold text-white/95">Conversation</h2>
            <button 
              onClick={() => setShowConversation(false)} 
              className="text-white/60 hover:text-white p-2 rounded-full hover:bg-white/10 transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Messages Container */}
          <div className="flex-grow overflow-y-auto pr-2 space-y-4 mt-4">
            {conversationHistory.length === 0 && (
              <div className="flex items-center justify-center h-full py-8">
                <p className="text-white/50 text-center">Your reflections will appear here.</p>
              </div>
            )}
            {conversationHistory.map((message: ConversationMessage) => (
              <div key={message.id} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                {message.role === 'model' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex-shrink-0 flex items-center justify-center shadow-lg">
                    <Brain size={16} className="text-white" />
                  </div>
                )}
                <div className={`
                  p-4 rounded-2xl max-w-md break-words backdrop-blur-sm border shadow-lg
                  ${message.role === 'user' 
                    ? 'bg-gradient-to-br from-blue-500/80 to-blue-600/80 border-blue-400/30 text-white ml-auto shadow-blue-500/20' 
                    : 'bg-white/10 border-white/20 text-white/95 shadow-black/10'
                  }
                `}>
                  <p className="leading-relaxed">{message.parts.map(p => p.text).join('')}</p>
                  <p className="text-xs opacity-60 mt-3 text-right">
                    {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainApp;