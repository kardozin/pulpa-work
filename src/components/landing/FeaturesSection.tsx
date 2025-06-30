import React from 'react';
import { Mic, BrainCircuit, Search } from 'lucide-react';

const features = [
  {
    icon: Mic,
    title: 'Conversational Reflection',
    description: 'Go beyond typing. Engage in a natural, spoken dialogue with an empathetic AI guide that asks insightful questions to help you delve deeper into your thoughts.',
    highlights: ['Voice-first interface', 'Natural conversation flow', 'Empathetic AI responses', 'Deep questioning techniques']
  },
  {
    icon: BrainCircuit,
    title: 'Intelligent Knowledge Base',
    description: 'Every reflection is automatically saved, transcribed, and summarized, building a long-term, private archive of your mind. Revisit your insights anytime.',
    highlights: ['Automatic transcription', 'AI-generated summaries', 'Private & secure storage', 'Long-term memory building']
  },
  {
    icon: Search,
    title: 'Semantic Search',
    description: 'Ask questions in plain language, like "What have I learned about my creative process?". Our AI finds the most relevant thoughts based on meaning, not just keywords.',
    highlights: ['Natural language queries', 'Meaning-based search', 'Pattern recognition', 'Cross-reference insights']
  }
];

const FeaturesSection: React.FC = () => {
  return (
    <section className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-20">
          <h2 className="text-5xl md:text-6xl font-bold text-text-main mb-8 leading-tight">
            Powerful Features for
            <span className="block bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              Deep Self-Discovery
            </span>
          </h2>
          <p className="text-xl md:text-2xl text-text-secondary max-w-4xl mx-auto leading-relaxed">
            Transform scattered thoughts into structured insights through AI-guided conversations, 
            intelligent storage, and semantic exploration of your personal knowledge base.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div 
                key={index}
                className="group relative bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 lg:p-10 hover:bg-white/10 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-primary/20"
              >
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                <div className="relative z-10">
                  {/* Icon */}
                  <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-2xl mb-8 mx-auto group-hover:scale-110 transition-transform duration-300">
                    <IconComponent className="w-10 h-10 text-primary group-hover:text-white transition-colors duration-300" />
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-2xl lg:text-3xl font-bold text-text-main mb-6 text-center group-hover:text-white transition-colors duration-300">
                    {feature.title}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-text-secondary mb-8 leading-relaxed text-center lg:text-lg group-hover:text-white/90 transition-colors duration-300">
                    {feature.description}
                  </p>

                  {/* Highlights */}
                  <ul className="space-y-3">
                    {feature.highlights.map((highlight, highlightIndex) => (
                      <li key={highlightIndex} className="flex items-center gap-3 text-text-secondary/80 group-hover:text-white/80 transition-colors duration-300">
                        <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 group-hover:bg-white transition-colors duration-300"></div>
                        <span className="text-sm lg:text-base">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-20">
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-10 max-w-3xl mx-auto">
            <h3 className="text-3xl font-bold text-text-main mb-6">
              Ready to unlock deeper insights about yourself?
            </h3>
            <p className="text-text-secondary mb-8 text-lg leading-relaxed">
              Join thousands discovering patterns, growth, and clarity through AI-guided reflection.
            </p>
            <a 
              href="/app"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-primary to-purple-500 hover:from-primary-focus hover:to-purple-600 text-white font-bold text-lg px-10 py-4 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40"
            >
              Start Your Journey
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;