import React from 'react';

interface MessageBubbleProps {
  message: string;
  timestamp?: string;
  isMine: boolean;
  showTail?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  timestamp,
  isMine,
  showTail = true,
}) => {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div
        className={`max-w-[72%] sm:max-w-[60%] px-4 py-2.5 text-sm leading-relaxed shadow-card ${
          isMine
            ? `bg-gradient-to-br from-[#4F8CFF] to-[#3a6fe0] text-white ${
                showTail ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl'
              }`
            : `bg-[#21252D] text-[#F2F4F8] border border-white/[0.07] ${
                showTail ? 'rounded-2xl rounded-bl-sm' : 'rounded-2xl'
              }`
        }`}
      >
        <p>{message}</p>
        {timestamp && (
          <p
            className={`text-[10px] mt-1.5 ${isMine ? 'text-white/50' : 'text-[#F2F4F8]/30'}`}
          >
            {formatTime(timestamp)}
          </p>
        )}
      </div>
    </div>
  );
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
