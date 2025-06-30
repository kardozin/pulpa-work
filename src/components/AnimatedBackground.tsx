import React from 'react';

const AnimatedBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/50 to-transparent -translate-x-1/4 -translate-y-1/4 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-0 right-0 w-full h-full bg-gradient-to-tl from-purple-500/50 to-transparent translate-x-1/4 translate-y-1/4 rounded-full blur-3xl animate-pulse-slower" />
    </div>
  );
};

export default AnimatedBackground;
