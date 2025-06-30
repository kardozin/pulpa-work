import React, { useState, useEffect } from 'react';
import { Play } from 'lucide-react';

interface Voice {
  id: string;
  name: string;
  sampleUrl: string;
}

const availableVoices: Record<'es-AR' | 'en-US', Voice[]> = {
  'es-AR': [
    { id: 'Nln7vOQhlEPq2ntWRsrb', name: 'Voz 1', sampleUrl: 'https://awqkjxprdocadfmnjjrz.supabase.co/storage/v1/object/public/voice-samples/pulpa_voice_fem_esp.mp3' },
    { id: 'nvf3N3bKkHQ1uvlP30k6', name: 'Voz 2', sampleUrl: 'https://awqkjxprdocadfmnjjrz.supabase.co/storage/v1/object/public/voice-samples/pulpa_voice_male_esp.mp3' }
  ],
  'en-US': [
    { id: 'INV8b5mw32tMbdlGeZ5E', name: 'Voice 1', sampleUrl: 'https://awqkjxprdocadfmnjjrz.supabase.co/storage/v1/object/public/voice-samples/pulpa_voice_fem_eng.mp3' },
    { id: 'lTimmjJNJowBJVyx0vH5', name: 'Voice 2', sampleUrl: 'https://awqkjxprdocadfmnjjrz.supabase.co/storage/v1/object/public/voice-samples/pulpa_voice_male_eng.mp3' }
  ]
};

interface Step4VoiceSelectProps {
  selectedLanguage: 'es-AR' | 'en-US';
  currentVoiceId: string;
  onVoiceSelect: (voiceId: string) => void;
}

const Step4_VoiceSelect: React.FC<Step4VoiceSelectProps> = ({ selectedLanguage, currentVoiceId, onVoiceSelect }) => {
  const [nowPlaying, setNowPlaying] = useState<HTMLAudioElement | null>(null);

  const handlePreview = (sampleUrl: string) => {
    if (nowPlaying) {
      nowPlaying.pause();
    }
    const audio = new Audio(sampleUrl);
    audio.play();
    setNowPlaying(audio);
  };

  useEffect(() => {
    // Cleanup function to stop audio when the component unmounts or language changes
    return () => {
      if (nowPlaying) {
        nowPlaying.pause();
      }
    };
  }, [nowPlaying, selectedLanguage]);

  const voices = availableVoices[selectedLanguage] || [];

  return (
    <div className="w-full text-center">
      <h2 className="text-3xl font-light text-text-main mb-12">Choose the voice you'd like to hear</h2>
      
      <div className="flex items-center justify-center gap-8">
        {voices.map((voice) => {
          const isSelected = currentVoiceId === voice.id;
          return (
            <div
              key={voice.id}
              onClick={() => onVoiceSelect(voice.id)}
              className={`
                w-48 h-48 rounded-full 
                flex flex-col items-center justify-center 
                bg-surface/50 border-2 backdrop-blur-lg 
                cursor-pointer transition-all duration-300 ease-in-out
                ${isSelected 
                  ? 'border-primary shadow-lg shadow-primary/50 scale-105' 
                  : 'border-slate-600 hover:border-slate-400 hover:scale-105'
                }
              `}
            >
              <span className="text-2xl font-semibold text-text-main">{voice.name}</span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview(voice.sampleUrl);
                }}
                className="mt-4 p-3 rounded-full bg-slate-700/80 hover:bg-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={`Play sample for ${voice.name}`}
              >
                <Play className="w-6 h-6 text-text-main" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Step4_VoiceSelect;
