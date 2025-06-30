import React from 'react';
import { Brain, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const HeroSection: React.FC = () => {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="max-w-4xl mx-auto">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Brain className="w-16 h-16 text-primary" />
          <h1 className="text-5xl md:text-6xl font-light text-text-main tracking-wide">
            pulpa.work
          </h1>
        </div>

        {/* Main Headline */}
        <h2 className="text-4xl md:text-5xl font-bold text-text-main mb-6 leading-tight">
          Extract the essence of your thoughts
        </h2>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-text-secondary mb-12 max-w-3xl mx-auto leading-relaxed">
          The AI-guided journal that helps you find the 'pulpa' of your daily reflections through conversation.
        </p>

        {/* CTA Button */}
        <Link 
          to="/app"
          className="inline-flex items-center gap-3 bg-primary hover:bg-primary-focus text-white font-bold text-lg px-8 py-4 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg shadow-primary/30"
        >
          Start Reflecting
          <ArrowRight className="w-6 h-6" />
        </Link>

        {/* Additional tagline */}
        <p className="text-text-secondary/70 mt-8 text-lg">
          Voice-guided • AI-powered • Deeply personal
        </p>
      </div>
    </section>
  );
};

export default HeroSection;