import React from 'react';
import { X } from 'lucide-react';

interface ModalPanelProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const ModalPanel: React.FC<ModalPanelProps> = ({ title, onClose, children }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl shadow-black/20 w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white/95">{title}</h2>
          <button 
            onClick={onClose} 
            className="text-white/60 hover:text-white p-2 rounded-full hover:bg-white/10 transition-all duration-200"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ModalPanel;