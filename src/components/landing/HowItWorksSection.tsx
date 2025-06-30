import React from 'react';
import { Mic, MessageCircle, Search, ArrowRight } from 'lucide-react';

const steps = [
  {
    number: '1',
    icon: Mic,
    title: 'Speak Your Mind',
    description: 'Press the pulse and talk freely. Our asynchronous transcription handles even long reflections without issue.',
    details: ['Natural voice recording', 'No time limits', 'High-quality transcription', 'Multiple languages supported']
  },
  {
    number: '2',
    icon: MessageCircle,
    title: 'Deepen Your Thought',
    description: 'Your AI guide listens and asks clarifying questions, helping you uncover the \'pulpa\' of your ideas.',
    details: ['Empathetic AI responses', 'Thoughtful follow-up questions', 'Cultural context awareness', 'Personalized guidance']
  },
  {
    number: '3',
    icon: Search,
    title: 'Explore Your Memory',
    description: 'Revisit, read, and search your entire reflection history. Discover patterns and connect ideas over time.',
    details: ['Semantic search capabilities', 'Pattern recognition', 'Historical insights', 'Cross-reference connections']
  }
];

const HowItWorksSection: React.FC = () => {
  return (
    <section className="py-24 px-4 bg-gradient-to-b from-transparent to-white/5">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-20">
          <h2 className="text-5xl md:text-6xl font-bold text-text-main mb-8 leading-tight">
            How It
            <span className="block bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              Works
            </span>
          </h2>
          <p className="text-xl md:text-2xl text-text-secondary max-w-4xl mx-auto leading-relaxed">
            Three simple steps to transform your thoughts into lasting insights and personal growth.
          </p>
        </div>

        {/* Steps Container */}
        <div className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/30 via-purple-400/50 to-primary/30 transform -translate-y-1/2 z-0"></div>
          
          {/* Steps Grid */}
          <div className="grid md:grid-cols-3 gap-8 lg:gap-16 relative z-10">
            {steps.map((step, index) => {
              const IconComponent = step.icon;
              return (
                <div key={index} className="relative group">
                  {/* Step Card */}
                  <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 lg:p-10 hover:bg-white/10 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-primary/20">
                    {/* Step Number */}
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                        {step.number}
                      </div>
                    </div>

                    {/* Icon */}
                    <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-2xl mb-8 mx-auto mt-6 group-hover:scale-110 transition-transform duration-300">
                      <IconComponent className="w-10 h-10 text-primary group-hover:text-white transition-colors duration-300" />
                    </div>

                    {/* Title */}
                    <h3 className="text-2xl lg:text-3xl font-bold text-text-main mb-6 text-center group-hover:text-white transition-colors duration-300">
                      {step.title}
                    </h3>

                    {/* Description */}
                    <p className="text-text-secondary mb-8 leading-relaxed text-center lg:text-lg group-hover:text-white/90 transition-colors duration-300">
                      {step.description}
                    </p>

                    {/* Details */}
                    <ul className="space-y-3">
                      {step.details.map((detail, detailIndex) => (
                        <li key={detailIndex} className="flex items-center gap-3 text-text-secondary/80 group-hover:text-white/80 transition-colors duration-300">
                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 group-hover:bg-white transition-colors duration-300"></div>
                          <span className="text-sm lg:text-base">{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Arrow (hidden on last step and mobile) */}
                  {index < steps.length - 1 && (
                    <div className="hidden lg:flex absolute top-1/2 -right-8 transform -translate-y-1/2 z-20">
                      <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
                        <ArrowRight className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="text-center mt-20">
          <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-10 max-w-4xl mx-auto">
            <h3 className="text-3xl font-bold text-text-main mb-6">
              Experience the power of structured self-reflection
            </h3>
            <p className="text-text-secondary mb-8 text-lg leading-relaxed">
              Each conversation builds upon the last, creating a rich tapestry of insights that evolve with you over time.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="/app"
                className="inline-flex items-center gap-3 bg-gradient-to-r from-primary to-purple-500 hover:from-primary-focus hover:to-purple-600 text-white font-bold text-lg px-8 py-4 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg shadow-primary/30"
              >
                Try It Now
              </a>
              <button className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium text-lg px-8 py-4 rounded-full transition-all duration-300 backdrop-blur-sm">
                Learn More
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;