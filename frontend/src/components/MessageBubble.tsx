import React from 'react';

interface MessageBubbleProps {
  message: string;
  timestamp?: string;
  isMine: boolean;
  showTail?: boolean;
  seen?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  timestamp,
  isMine,
  showTail = true,
  seen = false,
}) => {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} nn-fade-in`}>
      <div
        className={`max-w-[72%] sm:max-w-[60%] px-4 py-2.5 text-sm leading-relaxed shadow-card ${
          isMine
            ? `bg-gradient-to-br from-nn-copper to-nn-rust text-[#1A0E03] font-medium ${
                showTail ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl'
              }`
            : `bg-nn-elevated text-nn-text border border-nn-border ${
                showTail ? 'rounded-2xl rounded-bl-sm' : 'rounded-2xl'
              }`
        }`}
      >
        <p>{message}</p>
        {timestamp && (
          <p
            className={`text-[10px] mt-1.5 font-mono ${isMine ? 'text-[#1A0E03]/55' : 'text-nn-muted'}`}
          >
            {formatTime(timestamp)}
            {isMine && seen ? ' · seen' : ''}
          </p>
        )}
      </div>
    </div>
  );
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
