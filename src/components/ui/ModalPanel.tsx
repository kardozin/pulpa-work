import React from 'react';
import { X } from 'lucide-react';

interface ModalPanelProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const ModalPanel: React.FC<ModalPanelProps> = ({ title, onClose, children }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative bg-surface/80 backdrop-blur-xl border border-slate-700 rounded-[2rem] shadow-2xl shadow-black/30 w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
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
