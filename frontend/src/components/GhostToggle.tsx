import React from 'react';

interface GhostToggleProps {
  isGhost: boolean;
  onToggle: (next: boolean) => void | Promise<void>;
  premium?: boolean;
}

export const GhostToggle: React.FC<GhostToggleProps> = ({ isGhost, onToggle, premium = false }) => (
  <div className="bg-[#1E1508] border border-[#3D2B0E] rounded-2xl p-5 shadow-card">
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-[#F0E0C0]/80 text-sm font-semibold">Ghost mode</p>
          {premium && (
            <span className="rounded-full border border-[#C4832A]/30 bg-[#C4832A]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#C4832A]">
              Premium
            </span>
          )}
        </div>
        <p className="text-[#A89070] text-xs mt-1">
          Browse quietly. When enabled, you stay off nearby discovery until you switch it back on.
        </p>
      </div>
      <button
        type="button"
        onClick={() => void onToggle(!isGhost)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
          isGhost ? 'bg-[#C4832A]' : 'bg-[#3D2B0E]'
        }`}
        aria-pressed={isGhost}
        aria-label="Toggle ghost mode"
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            isGhost ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  </div>
);
