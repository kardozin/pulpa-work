export const AUDIO_CONFIG = {
  mimeType: 'audio/webm;codecs=opus',
  sampleRate: 48000,
  channels: 1,
};

// Improved silence detection thresholds
export const SILENCE_THRESHOLD = 0.025; // Increased from 0.01 for better noise filtering
export const SILENCE_DURATION = 4000; // Increased from 3000ms to 4000ms for natural pauses
export const MAX_TURN_DURATION = 50000; // Increased from 30000ms to 50000ms (50 seconds)

// New configuration for faster transcription
export const TRANSCRIPTION_CONFIG = {
  // Send audio in smaller chunks for faster processing
  timeSlice: 500, // Send data every 500ms instead of 1000ms
  enableEarlyResults: true, // Enable partial results if supported
  maxRetries: 3,
  retryDelay: 1000,
};