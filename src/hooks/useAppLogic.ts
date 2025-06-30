import { useState, useRef, useCallback, useEffect } from 'react';
import { UseAuthReturn } from './useAuth';

import { AUDIO_CONFIG, MAX_TURN_DURATION, SILENCE_DURATION, SILENCE_THRESHOLD } from '../config/audio';

import { generateUniqueId } from '../utils/misc';
import { Profile, ConversationMessage, RecordingState } from '../types';
import { useSearchStore } from '../stores/searchStore';
import { invokeTextToSpeech, invokeChatAi, invokeTranscribe, createConversation, saveMessage, summarizeConversation } from '../services/api';

// --- Interfaces and Types ---


export interface UseAppLogicReturn {
  recordingState: RecordingState;
  conversationHistory: ConversationMessage[];
  showConversation: boolean;
  setShowConversation: React.Dispatch<React.SetStateAction<boolean>>;
  handleMainButtonClick: () => void;
  handleInterruptAudio: () => void;
  handleFinishSession: () => Promise<void>;
  isSummarizing: boolean;
  currentConversationId: string | null;
  MAX_TURN_DURATION: number;

}

export const useAppLogic = (profile: Profile | null, auth: UseAuthReturn): UseAppLogicReturn => {
  // --- STATE MANAGEMENT ---
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isProcessing: false,
    isAiThinking: false,
    isGeneratingAudio: false,
    isPlayingAudio: false,
    hasPermission: false,
    permissionDenied: false,
    error: '',
    status: 'Tap the pulse to begin your reflection',
    recordingDuration: 0,
    audioLevel: 0,
  });
  const audioInstanceRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [showConversation, setShowConversation] = useState<boolean>(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const { 
    metaReflectionRequest, 
    setMetaReflectionRequest, 
    startAnalysis, 
    setAnalysisSuccess, 
    setAnalysisError 
  } = useSearchStore();


  // --- REFS ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const allAudioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceDetectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const conversationHistoryRef = useRef(conversationHistory);
  const currentConversationIdRef = useRef(currentConversationId);
  const animationFrameRef = useRef<number | null>(null);
  const hasDetectedSpeechRef = useRef(false);

  useEffect(() => {
    conversationHistoryRef.current = conversationHistory;
  }, [conversationHistory]);

  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

  // Auto-show conversation when first message appears
  useEffect(() => {
    if (conversationHistory.length === 1 && !showConversation) {
      setShowConversation(true);
    }
  }, [conversationHistory.length, showConversation]);

  // --- LOGIC FUNCTIONS (defined before usage in hooks) ---
  const cleanupAudio = useCallback(() => {
    if (audioInstanceRef.current) {
      audioInstanceRef.current.pause();
      audioInstanceRef.current.onended = null;
      audioInstanceRef.current.onerror = null;
      audioInstanceRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const resetToReadyState = useCallback(() => {
    console.log('🔄 Resetting to ready state...');
    setRecordingState(prev => ({
      ...prev,
      isRecording: false,
      isProcessing: false,
      isAiThinking: false,
      isGeneratingAudio: false,
      isPlayingAudio: false,
      audioLevel: 0,
      recordingDuration: 0,
      error: '',
      status: prev.hasPermission ? 'Ready for your next thought' : 'Microphone access needed',
    }));
  }, []);

  const handleInterruptAudio = useCallback(() => {
    console.log('🛑 Interrupting audio and resetting states...');
    cleanupAudio();
    resetToReadyState();
  }, [cleanupAudio, resetToReadyState]);

  const playAudio = useCallback(async (audioBlob: Blob) => {
    console.log('🔊 Attempting to play audio blob:', audioBlob);
    if (audioBlob.size === 0) {
      console.error('Received an empty audio blob. Skipping playback.');
      resetToReadyState();
      return;
    }

    cleanupAudio();

    const url = URL.createObjectURL(audioBlob);
    audioUrlRef.current = url;
    const audio = new Audio(url);
    audioInstanceRef.current = audio;

    audio.onended = () => {
      console.log('🎵 Audio finished playing - resetting to ready state');
      cleanupAudio();
      resetToReadyState();
    };

    audio.onerror = () => {
      console.error('❌ Error playing audio.');
      cleanupAudio();
      resetToReadyState();
    };

    try {
      await audio.play();
      setRecordingState(prev => ({ 
        ...prev, 
        isPlayingAudio: true, 
        isGeneratingAudio: false,
        status: 'Playing response... (tap to pause)' 
      }));
    } catch (error) {
      console.error('❌ Error trying to play audio:', error);
      cleanupAudio();
      resetToReadyState();
    }
  }, [cleanupAudio, resetToReadyState]);

  const processAudio = useCallback(async (audioBlob: Blob) => {
    if (!profile) {
      console.error("Cannot process audio without a user profile.");
      setRecordingState(prev => ({ 
        ...prev, 
        error: 'Profile not loaded.',
        isProcessing: false,
        status: prev.hasPermission ? 'Ready for your next thought' : 'Microphone access needed'
      }));
      return;
    }

    setRecordingState(prev => ({ ...prev, isProcessing: true, status: 'Transcribing your thoughts...' }));

    try {
      // Step 1: Transcribe Audio
      const transcription = await invokeTranscribe(audioBlob, profile.preferred_language || 'es-AR');
      if (!transcription.trim()) {
        console.log('Transcription is empty, skipping AI chat.');
        setRecordingState(prev => ({ 
          ...prev, 
          isProcessing: false, 
          status: prev.hasPermission ? 'Could not hear anything clearly. Try again.' : 'Microphone access needed'
        }));
        return;
      }

      let convId = currentConversationIdRef.current;

      if (!convId) {
        console.log("No active conversation, creating a new one...");
        try {
          const newConvId = await createConversation();
          if (newConvId) {
            convId = newConvId;
            setCurrentConversationId(newConvId);
          }
        } catch (error) {
          console.error("Failed to create conversation", error);
          setRecordingState(prev => ({ 
            ...prev, 
            isProcessing: false, 
            error: 'Could not start a new conversation.',
            status: prev.hasPermission ? 'Ready for your next thought' : 'Microphone access needed'
          }));
          return;
        }
      }

      const userMessage: ConversationMessage = { 
        id: generateUniqueId(), 
        role: 'user', 
        parts: [{ text: transcription }],
        timestamp: new Date().toISOString()
      };
      setConversationHistory(prev => [...prev, userMessage]);

      if (convId) {
        await saveMessage({
          conversation_id: convId,
          role: 'user',
          parts: [{ text: transcription }],
        });
      } else {
        console.error("Cannot save user message without a conversation ID.");
        setRecordingState(prev => ({ 
          ...prev, 
          isProcessing: false, 
          error: 'Failed to save message.',
          status: prev.hasPermission ? 'Ready for your next thought' : 'Microphone access needed'
        }));
        return;
      }

      setRecordingState(prev => ({ ...prev, isAiThinking: true, isProcessing: false, status: 'AI is thinking...' }));

      // Enhanced AI call with better user context
      const aiResponseText = await invokeChatAi({ 
        userMessage: transcription, 
        conversationHistory: conversationHistoryRef.current, 
        languageCode: profile.preferred_language || 'es-AR', 
        profile: {
          fullName: profile.full_name || 'Usuario',
          role: profile.role || 'Persona reflexiva',
          goals: profile.goals || 'Crecimiento personal y autoconocimiento'
        }
      });

      const aiMessage: ConversationMessage = { 
        id: generateUniqueId(), 
        role: 'model', 
        parts: [{ text: aiResponseText }],
        timestamp: new Date().toISOString()
      };
      setConversationHistory(prev => [...prev, aiMessage]);

      if (currentConversationIdRef.current) {
        await saveMessage({ conversation_id: currentConversationIdRef.current, role: 'model', parts: [{ text: aiResponseText }] });
      } else {
        console.error("Cannot save AI message without a conversation ID.");
      }

      setRecordingState(prev => ({ ...prev, isAiThinking: false, isGeneratingAudio: true, status: 'Generating audio...' }));

      if (!profile) {
        console.error("Cannot play audio without user profile.");
        resetToReadyState();
        return;
      }
      const languageCode = profile.preferred_language || 'es-AR';
      const voiceId = profile.preferred_voice_id || (languageCode === 'es-AR' ? 'Nln7vOQhlEPq2ntWRsrb' : 'INV8b5mw32tMbdlGeZ5E');
      const audioResponseBlob = await invokeTextToSpeech(aiResponseText, languageCode, voiceId);

      await playAudio(audioResponseBlob);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      console.error('❌ Error processing audio:', errorMessage);
      setRecordingState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        isAiThinking: false, 
        isGeneratingAudio: false, 
        error: `Error: ${errorMessage}`,
        status: prev.hasPermission ? 'Ready for your next thought' : 'Microphone access needed'
      }));
    }
  }, [profile, playAudio, resetToReadyState]);

  const stopStreamingRecording = useCallback(async (processAudioData: boolean) => {
    console.log(`🟡 Stopping recording. Process audio: ${processAudioData}`);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.onstop = () => {
        console.log('🎬 MediaRecorder.onstop triggered.');
        if (processAudioData && allAudioChunksRef.current.length > 0) {
          const finalAudioBlob = new Blob(allAudioChunksRef.current, { type: AUDIO_CONFIG.mimeType });
          processAudio(finalAudioBlob);
        } else {
          // If we're not processing audio, reset to ready state
          resetToReadyState();
        }
        // Clean up chunks for the next recording
        allAudioChunksRef.current = [];
      };
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    if (silenceDetectionTimerRef.current) clearTimeout(silenceDetectionTimerRef.current);
    silenceDetectionTimerRef.current = null;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    hasDetectedSpeechRef.current = false;
  }, [processAudio, resetToReadyState]);

  const monitorAudioLevel = useCallback(() => {
    if (!audioContextRef.current || !analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const checkAudio = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
      const normalizedLevel = average / 255; // Normalize to 0-1
      setRecordingState(prev => ({ ...prev, audioLevel: normalizedLevel }));

      if (normalizedLevel > SILENCE_THRESHOLD) {
        hasDetectedSpeechRef.current = true;
        if (silenceDetectionTimerRef.current) {
          clearTimeout(silenceDetectionTimerRef.current);
          silenceDetectionTimerRef.current = null;
        }
      } else if (hasDetectedSpeechRef.current && !silenceDetectionTimerRef.current) {
        silenceDetectionTimerRef.current = setTimeout(() => {
          console.log('Silence detected, stopping recording.');
          stopStreamingRecording(true);
        }, SILENCE_DURATION);
      }

      animationFrameRef.current = requestAnimationFrame(checkAudio);
    };

    animationFrameRef.current = requestAnimationFrame(checkAudio);
  }, [stopStreamingRecording]);

  const startRecording = useCallback(async () => {
    if (recordingState.isRecording || recordingState.isProcessing) {
      console.log('Already recording or processing, ignoring start request.');
      return;
    }

    handleInterruptAudio();
    allAudioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: AUDIO_CONFIG.sampleRate
        } 
      });
      streamRef.current = stream;
      setRecordingState(prev => ({ 
        ...prev, 
        hasPermission: true, 
        permissionDenied: false, 
        error: '',
        status: 'Microphone ready'
      }));

      // Setup audio context for analysis
      const context = new AudioContext({ sampleRate: AUDIO_CONFIG.sampleRate });
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: AUDIO_CONFIG.mimeType,
        audioBitsPerSecond: 128000
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          allAudioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onerror = (event: Event) => {
        const error = (event as any).error || new Error('Unknown MediaRecorder error');
        console.error('MediaRecorder error:', error);
        setRecordingState(prev => ({ 
          ...prev, 
          error: `Recording failed: ${error.message}`,
          status: prev.hasPermission ? 'Ready for your next thought' : 'Microphone access needed'
        }));
      };

      mediaRecorder.onstart = () => {
        console.log('🎙️ Recording started.');
        recordingStartTimeRef.current = Date.now();
        setRecordingState(prev => ({
          ...prev,
          isRecording: true,
          status: 'Listening...',
          recordingDuration: 0,
          error: ''
        }));

        // Clear any existing timer
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        
        // Start the recording timer
        recordingTimerRef.current = setInterval(() => {
          const elapsed = Date.now() - recordingStartTimeRef.current;
          setRecordingState(prev => ({ ...prev, recordingDuration: elapsed }));
          
          // Auto-stop at max duration
          if (elapsed >= MAX_TURN_DURATION) {
            console.log('Max recording duration reached, stopping...');
            stopStreamingRecording(true);
          }
        }, 100); // Update every 100ms for smooth timer

        monitorAudioLevel();
      };

      // Start recording with time slices for better data handling
      mediaRecorder.start(1000);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Error starting recording:', errorMessage);
      setRecordingState(prev => ({ 
        ...prev, 
        hasPermission: false, 
        permissionDenied: true, 
        error: 'Microphone permission denied.', 
        status: 'Microphone access denied.' 
      }));
    }
  }, [recordingState.isRecording, recordingState.isProcessing, handleInterruptAudio, monitorAudioLevel, stopStreamingRecording]);

  const handleMainButtonClick = useCallback(() => {
    console.log('🔘 Main button clicked. Current state:', {
      isRecording: recordingState.isRecording,
      isPlayingAudio: recordingState.isPlayingAudio,
      isProcessing: recordingState.isProcessing,
      isAiThinking: recordingState.isAiThinking,
      isGeneratingAudio: recordingState.isGeneratingAudio,
      hasPermission: recordingState.hasPermission
    });

    if (recordingState.isPlayingAudio) {
      console.log('🛑 Interrupting audio playback and enabling microphone');
      handleInterruptAudio();
      // After interrupting, immediately start recording if we have permission
      if (recordingState.hasPermission) {
        setTimeout(() => startRecording(), 100); // Small delay to ensure state is clean
      }
      return;
    }

    if (recordingState.isRecording) {
      console.log('🛑 Stopping recording');
      stopStreamingRecording(true);
    } else if (recordingState.hasPermission && !recordingState.isProcessing && !recordingState.isAiThinking && !recordingState.isGeneratingAudio) {
      console.log('🎙️ Starting recording');
      startRecording();
    } else if (!recordingState.hasPermission) {
      console.log('🎙️ Requesting microphone permission');
      startRecording();
    } else {
      console.log('⏳ Cannot start recording - system is busy');
    }
  }, [recordingState, stopStreamingRecording, startRecording, handleInterruptAudio]);

  // --- LIFECYCLE HOOKS ---
  useEffect(() => {
    // Request microphone permission on initial load to streamline user experience
    const requestPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setRecordingState(prev => ({ 
          ...prev, 
          hasPermission: true, 
          permissionDenied: false,
          status: 'Tap the microphone to begin your reflection'
        }));
        // Stop the tracks immediately, we only wanted the permission grant
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error('Initial microphone permission request failed:', err);
        setRecordingState(prev => ({ 
          ...prev, 
          hasPermission: false, 
          permissionDenied: true, 
          status: 'Microphone access denied. Please enable microphone permissions.' 
        }));
      }
    };
    requestPermission();
  }, []); // Run only once on mount

  useEffect(() => {
    // Clear conversation when user logs out
    if (auth.user === null) {
      setConversationHistory([]);
      setCurrentConversationId(null);
      handleInterruptAudio();
    }
  }, [auth.user, handleInterruptAudio]);

  // This effect triggers the meta-reflection analysis when a request is set.
  useEffect(() => {
    const handleMetaReflection = async () => {
      if (!metaReflectionRequest || !profile) return;

      startAnalysis(); // 1. Set loading state in the store

      try {
        // 2. Invoke chat AI with only the meta context for a clean analysis request
        const aiResponseText = await invokeChatAi({
          languageCode: profile.preferred_language || 'es-AR',
          profile: {
            fullName: profile.full_name || 'Usuario',
            role: profile.role || 'Persona reflexiva',
            goals: profile.goals || 'Crecimiento personal y autoconocimiento'
          },
          metaContext: {
            userQuery: metaReflectionRequest.userQuery,
            relevantMemories: metaReflectionRequest.relevantMemories.map(mem => ({ content: mem.content })),
          },
        });

        // 3. Set success state in the store with the result
        setAnalysisSuccess(aiResponseText);

      } catch (error) {
        console.error("Error during meta-reflection AI call:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        // 4. Set error state in the store
        setAnalysisError(errorMessage);
      } finally {
        // 5. Clear the request from the store, but not the result.
        // The component will be responsible for clearing the result when it's done.
        setMetaReflectionRequest(null);
      }
    };

    handleMetaReflection();
  }, [metaReflectionRequest, profile, startAnalysis, setAnalysisSuccess, setAnalysisError, setMetaReflectionRequest]);

  // This effect is crucial for resetting state when the user logs out.
  useEffect(() => {
    return () => {
      cleanupAudio();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (silenceDetectionTimerRef.current) clearTimeout(silenceDetectionTimerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [cleanupAudio]);

  useEffect(() => {
    return () => {
      handleInterruptAudio();
      stopStreamingRecording(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [handleInterruptAudio, stopStreamingRecording]);



  const handleFinishSession = useCallback(async () => {
    if (!currentConversationIdRef.current || !profile) {
      console.log("No active session to finish.");
      return;
    }

    setIsSummarizing(true);
    try {
      console.log(`Finishing session, summarizing conversation: ${currentConversationIdRef.current}`);
      await summarizeConversation(currentConversationIdRef.current);
      // Reset for the next conversation
      setCurrentConversationId(null);
      setConversationHistory([]);
    } catch (error) {
      console.error("Failed to summarize and finish session:", error);
      // Decide if you want to reset even if summary fails. For now, we will.
      setCurrentConversationId(null);
      setConversationHistory([]);
    } finally {
      setIsSummarizing(false);
    }
  }, []);

  return {
    recordingState,
    conversationHistory,
    showConversation,
    setShowConversation,
    handleMainButtonClick,
    handleInterruptAudio,
    handleFinishSession,
    isSummarizing,
    currentConversationId,
    MAX_TURN_DURATION,

  };
};