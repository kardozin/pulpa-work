export const AUDIO_CONFIG = {
  mimeType: 'audio/webm;codecs=opus',
  sampleRate: 48000,
  channels: 1,
};
export const SILENCE_THRESHOLD = 0.01; // Reduced threshold for better sensitivity
export const SILENCE_DURATION = 3000; // Reduced to 3 seconds
export const MAX_TURN_DURATION = 30000;