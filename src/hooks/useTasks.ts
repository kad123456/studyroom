'use client';
import { useEffect, useState, useCallback } from 'react';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { ref, push, onValue, update, remove } from 'firebase/database';

export interface Task {
  id: string;
  text: string;
  done: boolean;
  ownerId: string;
  ownerName: string;
  timestamp: number;
}

export function useTasks(roomId: string, myPeerId: string, displayName: string) {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!roomId) return;

    if (!isFirebaseConfigured || !db) {
      // Local initial tasks in preview mode
      const saved = sessionStorage.getItem(`tasks_${roomId}`);
      if (saved) {
        try {
          setTasks(JSON.parse(saved));
        } catch {
          // ignore
        }
      } else {
        setTasks([
          {
            id: 'task-1',
            text: 'Finish chapter 3 revision 📖',
            done: false,
            ownerId: myPeerId || 'local',
            ownerName: displayName || 'You',
            timestamp: Date.now() - 360000,
          },
          {
            id: 'task-2',
            text: 'Write notes for tomorrow\'s test ✍️',
            done: true,
            ownerId: myPeerId || 'local',
            ownerName: displayName || 'You',
            timestamp: Date.now() - 720000,
          },
        ]);
      }
      return;
    }

    const tasksRef = ref(db, `rooms/${roomId}/tasks`);
    const unsubscribe = onValue(tasksRef, (snapshot) => {
      const data = snapshot.val() || {};
      const list: Task[] = Object.entries(data).map(([id, val]: [string, any]) => ({
        id,
        text: val.text || '',
        done: Boolean(val.done),
        ownerId: val.ownerId || '',
        ownerName: val.ownerName || 'Participant',
        timestamp: val.timestamp || Date.now(),
      })).sort((a, b) => a.timestamp - b.timestamp);

      setTasks(list);
    });

    return () => unsubscribe();
  }, [roomId, myPeerId, displayName]);

  const saveLocal = (updated: Task[]) => {
    setTasks(updated);
    if (!isFirebaseConfigured) {
      sessionStorage.setItem(`tasks_${roomId}`, JSON.stringify(updated));
    }
  };

  const addTask = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (isFirebaseConfigured && db && roomId) {
      push(ref(db, `rooms/${roomId}/tasks`), {
        text: trimmed,
        done: false,
        ownerId: myPeerId || 'anonymous',
        ownerName: displayName || 'Anonymous',
        timestamp: Date.now(),
      }).catch((err) => {
        console.warn('Firebase task add error:', err);
      });
    } else {
      const newTask: Task = {
        id: 'task-' + Date.now(),
        text: trimmed,
        done: false,
        ownerId: myPeerId || 'local',
        ownerName: displayName || 'You',
        timestamp: Date.now(),
      };
      saveLocal([...tasks, newTask]);
    }
  }, [roomId, myPeerId, displayName, tasks]);

  const toggleTask = useCallback((taskId: string, currentDone: boolean) => {
    if (isFirebaseConfigured && db && roomId) {
      update(ref(db, `rooms/${roomId}/tasks/${taskId}`), { done: !currentDone }).catch((err) => {
        console.warn('Firebase task toggle error:', err);
      });
    } else {
      const updated = tasks.map((t) => (t.id === taskId ? { ...t, done: !currentDone } : t));
      saveLocal(updated);
    }
  }, [roomId, tasks]);

  const deleteTask = useCallback((taskId: string) => {
    if (isFirebaseConfigured && db && roomId) {
      remove(ref(db, `rooms/${roomId}/tasks/${taskId}`)).catch((err) => {
        console.warn('Firebase task delete error:', err);
      });
    } else {
      const updated = tasks.filter((t) => t.id !== taskId);
      saveLocal(updated);
    }
  }, [roomId, tasks]);

  return { tasks, addTask, toggleTask, deleteTask };
}
