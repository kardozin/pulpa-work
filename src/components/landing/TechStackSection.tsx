import React from 'react';
import { Code, Cloud, Mic, Zap, Palette, Database } from 'lucide-react';

const technologies = [
  {
    icon: Code,
    name: 'React',
    description: 'Modern frontend framework',
    color: 'text-blue-400'
  },
  {
    icon: Database,
    name: 'Supabase',
    description: 'Backend & database platform',
    color: 'text-green-400'
  },
  {
    icon: Zap,
    name: 'Google Gemini',
    description: 'Advanced AI conversations',
    color: 'text-yellow-400'
  },
  {
    icon: Mic,
    name: 'ElevenLabs',
    description: 'Natural voice synthesis',
    color: 'text-purple-400'
  },
  {
    icon: Palette,
    name: 'TailwindCSS',
    description: 'Beautiful, responsive design',
    color: 'text-cyan-400'
  },
  {
    icon: Cloud,
    name: 'Google Cloud',
    description: 'Speech-to-text processing',
    color: 'text-orange-400'
  }
];

const TechStackSection: React.FC = () => {
  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-text-main mb-6">
            Built with Modern Technology
          </h2>
          <p className="text-xl text-text-secondary max-w-3xl mx-auto">
            Powered by cutting-edge AI and cloud technologies to deliver a seamless, intelligent reflection experience.
          </p>
        </div>

        {/* Tech Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {technologies.map((tech, index) => {
            const IconComponent = tech.icon;
            return (
              <div 
                key={index}
                className="bg-surface/30 backdrop-blur-lg border border-slate-700/50 rounded-xl p-6 hover:bg-surface/50 transition-all duration-300 hover:scale-105 group"
              >
                <div className="text-center">
                  <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4">
                    <IconComponent className={`w-8 h-8 ${tech.color} group-hover:scale-110 transition-transform duration-300`} />
                  </div>
                  
                  <h3 className="text-lg font-bold text-text-main mb-2">
                    {tech.name}
                  </h3>
                  
                  <p className="text-sm text-text-secondary">
                    {tech.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <div className="bg-surface/40 backdrop-blur-lg border border-slate-700 rounded-2xl p-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-text-main mb-4">
              Ready to start your reflection journey?
            </h3>
            <p className="text-text-secondary mb-6">
              Join thousands discovering deeper insights about themselves through AI-guided conversations.
            </p>
            <a 
              href="/app"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-focus text-white font-bold px-6 py-3 rounded-full transition-all duration-300 transform hover:scale-105"
            >
              Get Started Now
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TechStackSection;