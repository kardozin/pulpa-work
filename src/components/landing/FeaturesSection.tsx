import React from 'react';
import { MessageCircle, Database, Search, Brain } from 'lucide-react';

const features = [
  {
    icon: MessageCircle,
    title: 'Conversational AI Flow',
    description: 'Voice-guided reflection sessions with an empathetic AI interviewer that helps you explore your thoughts through natural conversation.',
    details: ['Voice recording & transcription', 'Contextual AI responses', 'Natural speech synthesis']
  },
  {
    icon: Database,
    title: 'Knowledge Base & Memory',
    description: 'Build a searchable, long-term repository of your insights with automatic summarization and persistent storage.',
    details: ['Conversation history', 'AI-generated summaries', 'Personal memory lane']
  },
  {
    icon: Search,
    title: 'Semantic Search',
    description: 'Find relevant thoughts and patterns using advanced vector search that understands meaning, not just keywords.',
    details: ['Vector embeddings', 'Conceptual matching', 'Pattern discovery']
  }
];

const FeaturesSection: React.FC = () => {
  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-text-main mb-6">
            Powerful Features for Deep Reflection
          </h2>
          <p className="text-xl text-text-secondary max-w-3xl mx-auto">
            Discover insights about yourself through AI-guided conversations and build a personal knowledge base of your thoughts.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div 
                key={index}
                className="bg-surface/50 backdrop-blur-lg border border-slate-700 rounded-2xl p-8 hover:bg-surface/70 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-primary/10"
              >
                <div className="flex items-center justify-center w-16 h-16 bg-primary/20 rounded-full mb-6 mx-auto">
                  <IconComponent className="w-8 h-8 text-primary" />
                </div>
                
                <h3 className="text-2xl font-bold text-text-main mb-4 text-center">
                  {feature.title}
                </h3>
                
                <p className="text-text-secondary mb-6 leading-relaxed">
                  {feature.description}
                </p>

                <ul className="space-y-2">
                  {feature.details.map((detail, detailIndex) => (
                    <li key={detailIndex} className="flex items-center gap-2 text-text-secondary/80">
                      <Brain className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-sm">{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;