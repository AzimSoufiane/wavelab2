import React, { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface ParamTooltipProps {
  title: string;
  explanation: string;
  formula?: string;
}

export const ParamTooltip: React.FC<ParamTooltipProps> = ({
  title,
  explanation,
  formula,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center ml-1.5 align-middle"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        aria-label={`Informations sur ${title}`}
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="p-0.5 rounded text-cyan-400 hover:text-cyan-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 w-72 p-3.5 bg-[#0c1324] border border-cyan-500/60 text-slate-100 rounded-xl shadow-2xl pointer-events-auto">
          <div className="font-semibold text-xs text-cyan-300 mb-1.5 border-b border-slate-700/80 pb-1 flex items-center justify-between">
            <span>{title}</span>
            <span className="text-[10px] text-slate-400 font-mono">Mod-M115</span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed font-normal">{explanation}</p>
          {formula && (
            <div className="mt-2 p-1.5 bg-[#070b14] rounded-lg font-mono text-[11px] text-amber-300 border border-amber-500/35 text-center font-semibold">
              {formula}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
