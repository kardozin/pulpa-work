import { create } from 'zustand';

// Definimos la forma del estado y sus acciones
export type LanguageCode = 'en-US' | 'es-AR';

// Definimos la forma del estado y sus acciones
interface OnboardingState {
  currentStep: number;
  profileData: {
    fullName: string;
    role: string;
    goals: string;
  };
  selectedLanguage: LanguageCode;
  selectedVoiceId: string;
  nextStep: () => void;
  prevStep: () => void;
  setProfileData: (data: Partial<OnboardingState['profileData']>) => void;
  setLanguage: (lang: LanguageCode) => void;
  setVoice: (voiceId: string) => void;
  resetOnboarding: () => void;
}

// Valores iniciales del estado
const initialState = {
  currentStep: 1,
  profileData: {
    fullName: '',
    role: '',
    goals: '',
  },
  selectedLanguage: 'es-AR' as LanguageCode,
  selectedVoiceId: 'Nln7vOQhlEPq2ntWRsrb', // ID por defecto (Voz 1 Español)
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,

  // Acciones para modificar el estado
  nextStep: () => set((state) => ({ currentStep: state.currentStep + 1 })),

  prevStep: () => set((state) => ({ currentStep: state.currentStep - 1 })),

  setProfileData: (data) => set((state) => ({
    profileData: { ...state.profileData, ...data }
  })),

  setLanguage: (lang: LanguageCode) => set({ selectedLanguage: lang }),

  setVoice: (voiceId) => set({ selectedVoiceId: voiceId }),

  resetOnboarding: () => set(initialState),
}));
