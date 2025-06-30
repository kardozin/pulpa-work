import { Brain } from 'lucide-react';

const Step1_Welcome = () => {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2 mb-8">
        <Brain className="w-10 h-10 text-primary" />
        <h1 className="text-3xl font-light tracking-wide text-text-main">pulpa.work</h1>
      </div>
      <h2 className="text-4xl font-bold text-text-main mb-4">Welcome to pulpa.work</h2>
      <p className="text-lg text-text-secondary max-w-md mx-auto">
        We'll guide you through a few quick steps to personalize your reflection experience.
      </p>
    </div>
  );
};

export default Step1_Welcome;
