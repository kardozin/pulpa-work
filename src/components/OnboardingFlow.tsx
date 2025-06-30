import React from 'react';
import { useOnboardingStore } from '../stores/onboardingStore';
import ModalPanel from './ui/ModalPanel';
import Step1_Welcome from './onboarding/Step1_Welcome';
import Step2_ProfileInfo from './onboarding/Step2_ProfileInfo';
import Step3_LanguageSelect from './onboarding/Step3_LanguageSelect';
import Step4_VoiceSelect from './onboarding/Step4_VoiceSelect';

interface OnboardingFlowProps {
  onOnboardingComplete: () => void;
}

// Built with Bolt Badge Component
const BoltBadge = () => (
  <div className="fixed bottom-4 right-4 z-50">
    <a 
      href="https://bolt.new" 
      target="_blank" 
      rel="noopener noreferrer"
      className="block transition-transform hover:scale-105"
    >
      <div className="bg-black text-white px-3 py-1.5 rounded-lg shadow-lg border border-gray-700 hover:border-gray-500 transition-colors">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor"/>
          </svg>
          <span className="text-xs font-medium">Built with Bolt</span>
        </div>
      </div>
    </a>
  </div>
);

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onOnboardingComplete }) => {
  const {
    currentStep,
    profileData,
    selectedLanguage,
    selectedVoiceId,
    nextStep,
    prevStep,
    setProfileData,
    setLanguage,
    setVoice,
  } = useOnboardingStore();

  const totalSteps = 4; // This can be dynamic if steps are added/removed

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <Step1_Welcome />;
      case 2:
        return <Step2_ProfileInfo profileData={profileData} onDataChange={(field, value) => setProfileData({ [field]: value })} />;
      case 3:
        return <Step3_LanguageSelect currentLanguage={selectedLanguage} onLanguageSelect={setLanguage} />;
      case 4:
        return <Step4_VoiceSelect selectedLanguage={selectedLanguage} currentVoiceId={selectedVoiceId} onVoiceSelect={setVoice} />;
      default:
        return null;
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center overflow-hidden">
      <ModalPanel title="Welcome to Pulpa" onClose={() => { /* Onboarding should not be closable from X */ }}>
        <div className="flex-grow min-h-[300px] flex flex-col justify-center items-center text-center">
          {renderStepContent()}
        </div>
        
        <div className="flex justify-center items-center my-6">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full mx-1.5 transition-all duration-300 ${currentStep >= i + 1 ? 'bg-primary' : 'bg-slate-600'}`}
            />
          ))}
        </div>

        <div className="flex justify-between mt-8">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="px-6 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-text-secondary hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Back
          </button>
          <button
            onClick={currentStep === totalSteps ? onOnboardingComplete : nextStep}
            className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-focus transition-colors"
          >
            {currentStep === totalSteps ? 'Finish' : 'Next'}
          </button>
        </div>
      </ModalPanel>

      <BoltBadge />
    </div>
  );
};

export default OnboardingFlow;