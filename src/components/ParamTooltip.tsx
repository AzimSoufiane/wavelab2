import React, { useState, useRef, useEffect } from 'react';
import { Glass } from 'glisse';
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
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const isOpen = hovered || pinned;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPinned(false);
        setHovered(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false);
        setHovered(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center ml-1 align-middle"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-label={`Informations sur ${title}`}
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setPinned((prev) => !prev);
        }}
        className="min-w-[26px] min-h-[26px] inline-flex items-center justify-center rounded-full bg-white/[0.06] border border-white/15 text-[var(--probe-s1)] hover:text-[var(--text-primary)] hover:bg-white/[0.12] focus-ring transition-colors duration-150"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <Glass
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 w-72 p-3.5 lg-popover-glass text-[var(--text-primary)] rounded-xl pointer-events-auto"
        >
          <div className="font-semibold text-xs text-[var(--text-primary)] mb-1.5 border-b border-[var(--hairline-subtle)] pb-1.5 flex items-center justify-between gap-2">
            <span className="text-[var(--probe-s1)]">{title}</span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">Mod-M115</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-normal">
            {explanation}
          </p>
          {formula && (
            <div className="mt-2.5 pt-2 border-t border-[var(--hairline-subtle)] font-mono text-[11px] text-[var(--probe-s2)] text-center font-medium tabular-nums">
              {formula}
            </div>
          )}
        </Glass>
      )}
    </div>
  );
};
