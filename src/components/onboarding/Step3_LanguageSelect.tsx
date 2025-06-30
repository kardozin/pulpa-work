import React from 'react';

interface LanguageOption {
  code: 'en-US' | 'es-AR';
  name: string;
}

const languages: LanguageOption[] = [
  { code: 'en-US', name: 'English' },
  { code: 'es-AR', name: 'Español' },
];

interface Step3LanguageSelectProps {
  currentLanguage: string;
  onLanguageSelect: (languageCode: 'en-US' | 'es-AR') => void;
}

const Step3_LanguageSelect: React.FC<Step3LanguageSelectProps> = ({ currentLanguage, onLanguageSelect }) => {
  return (
    <div className="w-full text-center">
      <h2 className="text-3xl font-light text-text-main mb-8">Select your preferred language</h2>
      
      <div className="flex flex-col items-center w-full space-y-4">
        {languages.map((lang) => {
          const isSelected = currentLanguage === lang.code;
          return (
            <button
              key={lang.code}
              onClick={() => onLanguageSelect(lang.code)}
              className={`
                w-full max-w-xs text-lg font-semibold px-8 py-4 rounded-full 
                transition-all duration-300 ease-in-out transform focus:outline-none 
                focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-primary
                ${isSelected
                  ? 'bg-primary text-white shadow-lg shadow-primary/40 scale-105'
                  : 'bg-surface/50 hover:bg-surface/70 border border-slate-600'
                }
              `}
            >
              {lang.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Step3_LanguageSelect;
