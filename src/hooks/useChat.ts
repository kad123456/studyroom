'use client';
import { useEffect, useState, useCallback } from 'react';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { ref, push, onValue, query, limitToLast } from 'firebase/database';

export interface ChatMessage {
  id: string;
  name: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export function useChat(roomId: string, displayName: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!roomId) return;

    if (!isFirebaseConfigured || !db) {
      // Local welcome message in offline/preview mode
      const timeout = window.setTimeout(() => {
        setMessages([
          {
            id: 'welcome',
            name: 'StudyRoom Bot',
            text: 'Welcome to your study room! Chat with peers here. Add your Firebase keys in .env.local to enable real-time cloud sync across browsers.',
            timestamp: Date.now(),
            isSystem: true,
          },
        ]);
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    const chatQuery = query(ref(db, `rooms/${roomId}/chat`), limitToLast(100));
    const unsubscribe = onValue(chatQuery, (snapshot) => {
      const data = snapshot.val() || {};
      const parsed: ChatMessage[] = Object.entries(data).map(([id, value]) => {
        const val = value as Partial<ChatMessage>;
        return {
          id,
          name: val.name || 'Anonymous',
          text: val.text || '',
          timestamp: val.timestamp || Date.now(),
          isSystem: val.isSystem || false,
        };
      }).sort((a, b) => a.timestamp - b.timestamp);

      setMessages(parsed);
    });

    return () => unsubscribe();
  }, [roomId]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const newMsg: ChatMessage = {
      id: 'local-' + Date.now(),
      name: displayName || 'Me',
      text: trimmed,
      timestamp: Date.now(),
    };

    if (isFirebaseConfigured && db && roomId) {
      push(ref(db, `rooms/${roomId}/chat`), {
        name: displayName || 'Anonymous',
        text: trimmed,
        timestamp: Date.now(),
      }).catch((err) => {
        console.warn('Chat push error:', err);
        setMessages((prev) => [...prev, newMsg]);
      });
    } else {
      // Local state fallback
      setMessages((prev) => [...prev, newMsg]);
    }
  }, [roomId, displayName]);

  return { messages, sendMessage };
}
