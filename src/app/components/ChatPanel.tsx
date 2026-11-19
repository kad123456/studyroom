'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Smile } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { getInitials } from '@/lib/utils';
import { isFirebaseConfigured } from '@/lib/firebase';

interface ChatPanelProps {
  roomId: string;
  displayName: string;
}

export default function ChatPanel({ roomId, displayName }: ChatPanelProps) {
  const { messages, sendMessage } = useChat(roomId, displayName);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(text);
    setText('');
  };

  const sendQuickEmoji = (emoji: string) => {
    sendMessage(emoji);
  };

  return (
    <div className="flex flex-col h-full min-h-[380px] p-3">
      {/* Header status */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Room Chat
        </span>
        <span className="text-[11px] text-slate-500">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </span>
      </div>

      {/* Messages stream */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500">
            <span className="text-2xl mb-1">💬</span>
            <p className="text-xs">Quiet focus room. Share thoughts, links, or notes!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.name === displayName;
            if (msg.isSystem) {
              return (
                <div
                  key={msg.id}
                  className="px-3 py-2 rounded-xl bg-purple-950/40 border border-purple-500/20 text-xs text-purple-200 text-center"
                >
                  {msg.text}
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex gap-2 items-start ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 text-white ${
                    isMe
                      ? 'bg-gradient-to-tr from-purple-600 to-indigo-600'
                      : 'bg-gradient-to-tr from-slate-700 to-slate-600'
                  }`}
                >
                  {getInitials(msg.name)}
                </div>

                {/* Message Bubble */}
                <div className={`max-w-[80%] ${isMe ? 'text-right' : 'text-left'}`}>
                  <div className="flex items-baseline gap-1.5 mb-0.5">
                    <span className="text-[11px] font-medium text-slate-300 truncate">
                      {isMe ? 'You' : msg.name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div
                    className={`inline-block px-3 py-2 rounded-2xl text-xs leading-relaxed break-words text-left ${
                      isMe
                        ? 'bg-purple-600 text-white rounded-tr-none'
                        : 'bg-white/10 text-slate-100 rounded-tl-none border border-white/5'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick reaction stickers */}
      <div className="flex items-center gap-1.5 py-1.5 overflow-x-auto text-sm">
        {['☕ Break?', '🔥 Focus on!', '👍 Got it', '👏 Great work', '💡 Question'].map((item) => (
          <button
            key={item}
            onClick={() => sendQuickEmoji(item)}
            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] border border-white/10 flex-shrink-0 transition-all"
          >
            {item}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Send a quiet message..."
          maxLength={300}
          className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white transition-all flex-shrink-0 shadow-sm"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
