import { useState, useRef, useCallback, useEffect } from 'react';
import { UseAuthReturn } from './useAuth';

import { AUDIO_CONFIG, MAX_TURN_DURATION, SILENCE_DURATION, SILENCE_THRESHOLD, TRANSCRIPTION_CONFIG } from '../config/audio';

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
  finishSessionError: string | null;
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
  const [finishSessionError, setFinishSessionError] = useState<string | null>(null);
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
  const lastAudioLevelRef = useRef<number>(0);
  const speechDetectionCountRef = useRef<number>(0);

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
      error: '', // Clear any existing errors
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
      setRecordingState(prev => ({ 
        ...prev, 
        error: 'Received empty audio from server.',
        isGeneratingAudio: false,
      }));
      // Auto-reset after showing error briefly
      setTimeout(() => resetToReadyState(), 2000);
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
      setRecordingState(prev => ({ 
        ...prev, 
        error: 'Failed to play audio response.',
        isGeneratingAudio: false,
        isPlayingAudio: false,
      }));
      // Auto-reset after showing error briefly
      setTimeout(() => resetToReadyState(), 2000);
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
      setRecordingState(prev => ({ 
        ...prev, 
        error: 'Could not play audio.',
        isGeneratingAudio: false,
        isPlayingAudio: false,
      }));
      // Auto-reset after showing error briefly
      setTimeout(() => resetToReadyState(), 2000);
    }
  }, [cleanupAudio, resetToReadyState]);

  const processAudio = useCallback(async (audioBlob: Blob) => {
    if (!profile) {
      console.error("Cannot process audio without a user profile.");
      setRecordingState(prev => ({ 
        ...prev, 
        error: 'Profile not loaded.',
        isProcessing: false,
      }));
      // Auto-reset after showing error briefly
      setTimeout(() => resetToReadyState(), 2000);
      return;
    }

    // Step 1: Start transcription
    setRecordingState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      isAiThinking: false,
      isGeneratingAudio: false,
      status: 'Transcribing your thoughts...' 
    }));

    try {
      // Step 1: Transcribe Audio with improved speed
      const transcription = await invokeTranscribe(audioBlob, profile.preferred_language || 'es-AR');
      if (!transcription.trim()) {
        console.log('Transcription is empty, skipping AI chat.');
        setRecordingState(prev => ({ 
          ...prev, 
          isProcessing: false, 
          status: 'Could not hear anything clearly. Try again.',
        }));
        // Auto-reset after showing message briefly
        setTimeout(() => resetToReadyState(), 2000);
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
          }));
          // Auto-reset after showing error briefly
          setTimeout(() => resetToReadyState(), 2000);
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
        }));
        // Auto-reset after showing error briefly
        setTimeout(() => resetToReadyState(), 2000);
        return;
      }

      // Step 2: AI thinking
      setRecordingState(prev => ({ 
        ...prev, 
        isAiThinking: true, 
        isProcessing: false, 
        status: 'AI is thinking...' 
      }));

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

      // Step 3: Generate audio
      setRecordingState(prev => ({ 
        ...prev, 
        isAiThinking: false, 
        isGeneratingAudio: true, 
        status: 'Generating audio...' 
      }));

      if (!profile) {
        console.error("Cannot play audio without user profile.");
        setRecordingState(prev => ({ 
          ...prev, 
          error: 'Error: Profile not found.',
          isGeneratingAudio: false,
        }));
        // Auto-reset after showing error briefly
        setTimeout(() => resetToReadyState(), 2000);
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
      }));
      // Auto-reset after showing error briefly
      setTimeout(() => resetToReadyState(), 3000);
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
    speechDetectionCountRef.current = 0;
  }, [processAudio, resetToReadyState]);

  const monitorAudioLevel = useCallback(() => {
    if (!audioContextRef.current || !analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const checkAudio = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average and apply smoothing
      const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
      const normalizedLevel = average / 255; // Normalize to 0-1
      
      // Apply smoothing to reduce noise
      const smoothedLevel = (normalizedLevel + lastAudioLevelRef.current) / 2;
      lastAudioLevelRef.current = smoothedLevel;
      
      setRecordingState(prev => ({ ...prev, audioLevel: smoothedLevel }));

      // Improved speech detection with consecutive samples
      if (smoothedLevel > SILENCE_THRESHOLD) {
        speechDetectionCountRef.current++;
        
        // Require multiple consecutive samples above threshold to confirm speech
        if (speechDetectionCountRef.current >= 3) {
          if (!hasDetectedSpeechRef.current) {
            console.log('🎤 Speech detected, starting silence detection timer');
            hasDetectedSpeechRef.current = true;
          }
          
          // Clear any existing silence timer
          if (silenceDetectionTimerRef.current) {
            clearTimeout(silenceDetectionTimerRef.current);
            silenceDetectionTimerRef.current = null;
          }
        }
      } else {
        speechDetectionCountRef.current = Math.max(0, speechDetectionCountRef.current - 1);
        
        // Only start silence timer if we've detected speech and no timer is running
        if (hasDetectedSpeechRef.current && !silenceDetectionTimerRef.current && speechDetectionCountRef.current === 0) {
          console.log(`🔇 Starting silence timer (${SILENCE_DURATION}ms)`);
          silenceDetectionTimerRef.current = setTimeout(() => {
            console.log('🛑 Silence detected, stopping recording.');
            stopStreamingRecording(true);
          }, SILENCE_DURATION);
        }
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
    hasDetectedSpeechRef.current = false;
    speechDetectionCountRef.current = 0;
    lastAudioLevelRef.current = 0;

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

      // Setup audio context for analysis with improved settings
      const context = new AudioContext({ sampleRate: AUDIO_CONFIG.sampleRate });
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      
      // Improved analyser settings for better speech detection
      analyser.fftSize = 512; // Increased from 256 for better frequency resolution
      analyser.smoothingTimeConstant = 0.3; // Reduced from 0.8 for more responsive detection
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      
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
        }));
        // Auto-reset after showing error briefly
        setTimeout(() => resetToReadyState(), 2000);
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

      // Start recording with faster time slices for improved responsiveness
      mediaRecorder.start(TRANSCRIPTION_CONFIG.timeSlice);

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
  }, [recordingState.isRecording, recordingState.isProcessing, handleInterruptAudio, monitorAudioLevel, stopStreamingRecording, resetToReadyState]);

  const handleMainButtonClick = useCallback(() => {
    console.log('🔘 Main button clicked. Current state:', {
      isRecording: recordingState.isRecording,
      isPlayingAudio: recordingState.isPlayingAudio,
      isProcessing: recordingState.isProcessing,
      isAiThinking: recordingState.isAiThinking,
      isGeneratingAudio: recordingState.isGeneratingAudio,
      hasPermission: recordingState.hasPermission,
      error: recordingState.error
    });

    // If there's an error, clear it and reset to ready state
    if (recordingState.error) {
      console.log('🔄 Clearing error and resetting to ready state');
      resetToReadyState();
      return;
    }

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
  }, [recordingState, stopStreamingRecording, startRecording, handleInterruptAudio, resetToReadyState]);

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
    setFinishSessionError(null);
    
    try {
      console.log(`🔄 Finishing session, summarizing conversation: ${currentConversationIdRef.current}`);
      const result = await summarizeConversation(currentConversationIdRef.current);
      
      console.log(`✅ Session finished successfully. Summary: "${result.summary}"`);
      
      // Reset for the next conversation
      setCurrentConversationId(null);
      setConversationHistory([]);
      
      // Show success message briefly
      setRecordingState(prev => ({ 
        ...prev, 
        status: 'Session finished and summary generated!' 
      }));
      
      // Reset to ready state after a brief delay
      setTimeout(() => {
        resetToReadyState();
      }, 2000);
      
    } catch (error) {
      console.error("❌ Failed to summarize and finish session:", error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to finish session';
      setFinishSessionError(errorMessage);
      
      // Still reset the conversation even if summary fails
      setCurrentConversationId(null);
      setConversationHistory([]);
      
      // Show error briefly then reset
      setTimeout(() => {
        setFinishSessionError(null);
        resetToReadyState();
      }, 3000);
    } finally {
      setIsSummarizing(false);
    }
  }, [profile, resetToReadyState]);

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
    finishSessionError,
  };
};