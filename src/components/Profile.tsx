import React, { useState, useEffect } from 'react';
import { ProfileUpdate } from '../hooks/useProfile';
import { Play } from 'lucide-react';
import { Profile } from '../types';

interface ProfileProps {
  profile: Profile | null;
  onSave: (updates: ProfileUpdate) => Promise<void>;
  loading: boolean;
}

const languageOptions = [
  { value: 'en-US', label: 'English' },
  { value: 'es-AR', label: 'Español' },
];

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

const ProfileForm: React.FC<ProfileProps> = ({ profile, onSave, loading }) => {
  const [formData, setFormData] = useState<ProfileUpdate>({});
  const [nowPlaying, setNowPlaying] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name,
        role: profile.role,
        goals: profile.goals,
        timezone: profile.timezone,
        preferred_language: profile.preferred_language,
        preferred_voice_id: profile.preferred_voice_id,
      });
    }
  }, [profile]);

  useEffect(() => {
    return () => {
      if (nowPlaying) nowPlaying.pause();
    };
  }, [nowPlaying]);

  useEffect(() => {
    if (formData.preferred_language) {
      const currentVoices = availableVoices[formData.preferred_language as keyof typeof availableVoices] || [];
      const currentVoiceIsValid = currentVoices.some(v => v.id === formData.preferred_voice_id);
      if (!currentVoiceIsValid) {
        setFormData(prev => ({ ...prev, preferred_voice_id: '' }));
      }
    }
  }, [formData.preferred_language]);

  const handlePreview = (sampleUrl: string) => {
    if (nowPlaying) {
      nowPlaying.pause();
    }
    const audio = new Audio(sampleUrl);
    audio.play();
    setNowPlaying(audio);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleLanguageSelect = (langCode: 'en-US' | 'es-AR') => {
    setFormData(prev => ({ ...prev, preferred_language: langCode, preferred_voice_id: '' }));
  };

  const handleVoiceSelect = (voiceId: string) => {
    setFormData(prev => ({ ...prev, preferred_voice_id: voiceId }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
    alert('Profile saved successfully!');
  };

  return (
      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-white/70 mb-2">Full Name</label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            value={formData.full_name || ''}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-full text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary backdrop-blur-sm"
            placeholder="Your full name"
          />
        </div>
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-white/70 mb-2">Role / Profession</label>
          <input
            id="role"
            name="role"
            type="text"
            value={formData.role || ''}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-full text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary backdrop-blur-sm"
            placeholder="e.g., Software Developer"
          />
        </div>
        <div>
          <label htmlFor="timezone" className="block text-sm font-medium text-white/70 mb-2">Timezone</label>
          <input
            id="timezone"
            name="timezone"
            type="text"
            value={formData.timezone || ''}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-full text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary backdrop-blur-sm"
            placeholder="e.g., America/New_York"
          />
        </div>
        <div>
          <label htmlFor="goals" className="block text-sm font-medium text-white/70 mb-2">My Goals</label>
          <textarea
            id="goals"
            name="goals"
            value={formData.goals || ''}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary backdrop-blur-sm resize-none"
            placeholder="What are your goals for using this app?"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">Language</label>
            <div className="flex items-center gap-3">
              {languageOptions.map((option) => {
                const isSelected = formData.preferred_language === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleLanguageSelect(option.value as 'en-US' | 'es-AR')}
                    className={`px-4 py-2 rounded-full border-2 transition-all duration-200 w-full backdrop-blur-sm ${
                      isSelected 
                        ? 'bg-primary/20 border-primary text-white' 
                        : 'bg-white/10 border-white/20 text-white/80 hover:border-white/40'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">Voice</label>
            <div className="grid grid-cols-2 gap-2">
              {(formData.preferred_language ? availableVoices[formData.preferred_language as keyof typeof availableVoices] : []).map((voice) => {
                const isSelected = formData.preferred_voice_id === voice.id;
                return (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => handleVoiceSelect(voice.id)}
                    className={`px-3 py-2 rounded-full border-2 w-full flex justify-between items-center transition-all duration-200 text-left backdrop-blur-sm ${
                      isSelected 
                        ? 'bg-primary/20 border-primary text-white' 
                        : 'bg-white/10 border-white/20 text-white/80 hover:border-white/40'
                    }`}
                  >
                    <span className="text-sm">{voice.name}</span>
                    <div
                      role="button"
                      aria-label={`Play sample for ${voice.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreview(voice.sampleUrl);
                      }}
                      className="p-1 rounded-full hover:bg-white/20 transition-colors"
                    >
                      <Play className="w-4 h-4" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-3 px-6 border border-white/20 rounded-full shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-focus transition-all duration-200 disabled:bg-primary/50 disabled:cursor-wait backdrop-blur-sm"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
  );
};

export default ProfileForm;