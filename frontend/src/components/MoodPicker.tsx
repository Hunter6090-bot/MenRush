import React from 'react';
import { MOOD_LABELS, Mood } from '../api/client';

const MOOD_META: Array<{ value: Mood; accent: string }> = [
  { value: 'roaming', accent: '#C4832A' },
  { value: 'looking', accent: '#E8B04B' },
  { value: 'down_to_chat', accent: '#D49A3A' },
  { value: 'dont_talk_just_watch', accent: '#A45E18' },
  { value: 'at_a_bar', accent: '#B96E25' },
  { value: 'hosting', accent: '#D28A2D' },
  { value: 'travelling', accent: '#A2672C' },
];

interface MoodPickerProps {
  current: Mood | null;
  onSelect: (mood: Mood | null) => void | Promise<void>;
}

export const MoodPicker: React.FC<MoodPickerProps> = ({ current, onSelect }) => (
  <div className="flex flex-wrap gap-2">
    {MOOD_META.map((item) => {
      const active = current === item.value;
      return (
        <button
          key={item.value}
          type="button"
          onClick={() => void onSelect(active ? null : item.value)}
          className="rounded-full border px-3 py-2 text-xs font-semibold transition-all"
          style={{
            borderColor: active ? item.accent : '#3D2B0E',
            background: active ? `${item.accent}22` : '#0D0A06',
            color: active ? '#F0E0C0' : '#C4A878',
          }}
        >
          {MOOD_LABELS[item.value]}
        </button>
      );
    })}
  </div>
);

export const MoodBadge: React.FC<{ mood: Mood | null | undefined; small?: boolean }> = ({
  mood,
  small = false,
}) => {
  if (!mood) return null;
  const meta = MOOD_META.find((item) => item.value === mood);
  return (
    <span
      className="inline-flex items-center rounded-full border font-semibold"
      style={{
        borderColor: meta?.accent || '#C4832A',
        background: `${meta?.accent || '#C4832A'}22`,
        color: '#F0E0C0',
        fontSize: small ? 10 : 12,
        padding: small ? '0.2rem 0.45rem' : '0.3rem 0.65rem',
      }}
    >
      {MOOD_LABELS[mood]}
    </span>
  );
};
