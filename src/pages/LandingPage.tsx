import React from 'react';
import AnimatedBackground from '../components/AnimatedBackground';
import HeroSection from '../components/landing/HeroSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import TechStackSection from '../components/landing/TechStackSection';
import { ArrowRight } from 'lucide-react';

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

// SUPER VISIBLE TEST SECTION
const TestSection: React.FC = () => {
  return (
    <section className="py-24 px-4 bg-red-600 border-8 border-yellow-400" style={{ minHeight: '300px' }}>
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-6xl font-bold text-white mb-8 animate-bounce">
          🔥 TEST SECTION VISIBLE! 🔥
        </h2>
        <p className="text-3xl text-yellow-300 font-bold">
          Time: {new Date().toLocaleTimeString()}
        </p>
        <p className="text-2xl text-white mt-4">
          If you see this, the page IS updating correctly!
        </p>
      </div>
    </section>
  );
};

// Final Call to Action Section
const FinalCTASection: React.FC = () => {
  return (
    <section className="py-24 px-4 bg-green-600" style={{ minHeight: '400px' }}>
      <div className="max-w-4xl mx-auto text-center">
        <div className="bg-gradient-to-br from-primary/20 to-purple-500/20 backdrop-blur-2xl border border-white/20 rounded-3xl p-12 lg:p-16 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-3xl"></div>
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-transparent via-white/5 to-transparent rounded-3xl"></div>
          
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-text-main mb-8 leading-tight">
              Your Journey to
              <span className="block bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                Self-Discovery
              </span>
              Starts Now
            </h2>
            
            <p className="text-xl md:text-2xl text-text-secondary mb-12 leading-relaxed max-w-3xl mx-auto">
              Join thousands who have transformed their inner dialogue into actionable insights. 
              Your thoughts deserve more than just being forgotten.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <a 
                href="/app"
                className="group inline-flex items-center gap-4 bg-gradient-to-r from-primary to-purple-500 hover:from-primary-focus hover:to-purple-600 text-white font-bold text-xl px-12 py-5 rounded-full transition-all duration-300 transform hover:scale-105 shadow-xl shadow-primary/40 hover:shadow-2xl hover:shadow-primary/50"
              >
                Begin Your Reflection
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" />
              </a>
              
              <p className="text-text-secondary/70 text-sm">
                Free to start • No credit card required
              </p>
            </div>

            {/* Trust indicators */}
            <div className="mt-12 pt-8 border-t border-white/10">
              <div className="flex flex-wrap justify-center items-center gap-8 text-text-secondary/60 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>End-to-end encrypted</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span>Your data stays private</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span>AI-powered insights</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const LandingPage: React.FC = () => {
  console.log('🚀 LandingPage component is rendering at:', new Date().toLocaleTimeString());
  
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-x-hidden">
      <AnimatedBackground />
      
      <div className="relative z-10">
        <HeroSection />
        <TestSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TechStackSection />
        <FinalCTASection />
      </div>

      <BoltBadge />
    </div>
  );
};

export default LandingPage;