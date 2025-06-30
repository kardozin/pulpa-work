import React from 'react';
import AnimatedBackground from '../components/AnimatedBackground';
import HeroSection from '../components/landing/HeroSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import TechStackSection from '../components/landing/TechStackSection';

// Official Built with Bolt Badge Component (Hackathon Requirements)
const BoltBadge = () => (
  <div className="fixed bottom-4 right-4 z-50">
    <a 
      href="https://bolt.new" 
      target="_blank" 
      rel="noopener noreferrer"
      className="block transition-transform hover:scale-105"
    >
      <img 
        src="/logotext_poweredby_360w.png" 
        alt="Built with Bolt" 
        className="h-8 w-auto opacity-90 hover:opacity-100 transition-opacity"
        onError={(e) => {
          // Fallback if image fails to load
          e.currentTarget.style.display = 'none';
          const fallback = document.createElement('div');
          fallback.className = 'bg-black text-white px-3 py-1.5 rounded-lg shadow-lg border border-gray-700 text-xs font-medium';
          fallback.innerHTML = '⚡ Built with Bolt';
          e.currentTarget.parentNode?.appendChild(fallback);
        }}
      />
    </a>
  </div>
);

const LandingPage: React.FC = () => {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden">
      <AnimatedBackground />
      
      <div className="relative z-10">
        <HeroSection />
        <FeaturesSection />
        <TechStackSection />
      </div>

      <BoltBadge />
    </div>
  );
};

export default LandingPage;