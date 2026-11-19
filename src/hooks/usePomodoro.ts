'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { ref, onValue, set } from 'firebase/database';

export type PomodoroPhase = 'focus' | 'short' | 'long';

export interface PomodoroState {
  phase: PomodoroPhase;
  running: boolean;
  startTime: number | null;
  elapsed: number;
  focusDuration: number;
  shortDuration: number;
  longDuration: number;
  cycle: number;
  lastUpdatedBy?: string;
}

const DEFAULTS: PomodoroState = {
  phase: 'focus',
  running: false,
  startTime: null,
  elapsed: 0,
  focusDuration: 25 * 60,
  shortDuration: 5 * 60,
  longDuration: 15 * 60,
  cycle: 0,
};

function getDuration(state: PomodoroState): number {
  if (state.phase === 'focus') return state.focusDuration;
  if (state.phase === 'short') return state.shortDuration;
  return state.longDuration;
}

export function playChime(type: 'start' | 'pause' | 'complete') {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'start') {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'pause') {
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.exponentialRampToValueAtTime(523.25, ctx.currentTime + 0.15); // C5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      // Complete chime chord
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // C Major
      freqs.forEach((freq, idx) => {
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.connect(subGain);
        subGain.connect(ctx.destination);
        subOsc.frequency.value = freq;
        const start = ctx.currentTime + idx * 0.08;
        subGain.gain.setValueAtTime(0.15, start);
        subGain.gain.exponentialRampToValueAtTime(0.001, start + 1.2);
        subOsc.start(start);
        subOsc.stop(start + 1.2);
      });
    }
  } catch (err) {
    console.debug('Web Audio chime not supported or allowed yet', err);
  }
}

export function usePomodoro(roomId: string, userName?: string) {
  const [state, setState] = useState<PomodoroState>(DEFAULTS);
  const [timeLeft, setTimeLeft] = useState(DEFAULTS.focusDuration);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<PomodoroState>(DEFAULTS);
  const hasChimedRef = useRef(false);

  // Sync state with Firebase Realtime Database
  useEffect(() => {
    if (!roomId || !isFirebaseConfigured || !db) return;

    const pomodoroRef = ref(db, `rooms/${roomId}/pomodoro`);
    const unsubscribe = onValue(pomodoroRef, (snapshot) => {
      const data: PomodoroState = snapshot.val();
      if (data) {
        stateRef.current = data;
        setState(data);
        const duration = getDuration(data);
        if (data.running && data.startTime) {
          const currentElapsed = data.elapsed + (Date.now() - data.startTime) / 1000;
          setTimeLeft(Math.max(0, duration - currentElapsed));
        } else {
          setTimeLeft(Math.max(0, duration - (data.elapsed || 0)));
        }
      }
    });

    return () => unsubscribe();
  }, [roomId]);

  // Local ticker for smooth countdown
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (state.running && state.startTime) {
      intervalRef.current = setInterval(() => {
        const current = stateRef.current;
        const duration = getDuration(current);
        const currentElapsed = current.elapsed + (Date.now() - (current.startTime || Date.now())) / 1000;
        const remaining = Math.max(0, duration - currentElapsed);
        setTimeLeft(remaining);

        if (remaining <= 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (!hasChimedRef.current) {
            playChime('complete');
            hasChimedRef.current = true;
          }
        } else {
          hasChimedRef.current = false;
        }
      }, 500);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.running, state.startTime]);

  const updateState = useCallback((updates: Partial<PomodoroState>) => {
    const nextState = {
      ...stateRef.current,
      ...updates,
      lastUpdatedBy: userName || 'Someone',
    };
    stateRef.current = nextState;
    setState(nextState);

    // Sync to Firebase if available
    if (isFirebaseConfigured && db && roomId) {
      set(ref(db, `rooms/${roomId}/pomodoro`), nextState).catch((err) => {
        console.warn('Firebase sync notice:', err.message);
      });
    }
  }, [roomId, userName]);

  const start = useCallback(() => {
    playChime('start');
    updateState({ running: true, startTime: Date.now() });
  }, [updateState]);

  const pause = useCallback(() => {
    playChime('pause');
    const current = stateRef.current;
    const additionalElapsed = current.startTime ? (Date.now() - current.startTime) / 1000 : 0;
    updateState({
      running: false,
      startTime: null,
      elapsed: current.elapsed + additionalElapsed,
    });
  }, [updateState]);

  const reset = useCallback(() => {
    updateState({
      running: false,
      startTime: null,
      elapsed: 0,
    });
    setTimeLeft(getDuration(stateRef.current));
  }, [updateState]);

  const setPhase = useCallback((phase: PomodoroPhase) => {
    const next = { ...stateRef.current, phase, running: false, startTime: null, elapsed: 0 };
    updateState(next);
    setTimeLeft(getDuration(next));
  }, [updateState]);

  const setDuration = useCallback((key: 'focusDuration' | 'shortDuration' | 'longDuration', minutes: number) => {
    const next = { ...stateRef.current, [key]: minutes * 60, running: false, startTime: null, elapsed: 0 };
    updateState(next);
    setTimeLeft(getDuration(next));
  }, [updateState]);

  const nextPhase = useCallback(() => {
    const current = stateRef.current;
    let nextP: PomodoroPhase = 'focus';
    let nextCycle = current.cycle;

    if (current.phase === 'focus') {
      nextCycle += 1;
      nextP = nextCycle % 4 === 0 ? 'long' : 'short';
    } else {
      nextP = 'focus';
    }

    const next = {
      ...current,
      phase: nextP,
      running: false,
      startTime: null,
      elapsed: 0,
      cycle: nextCycle,
    };
    updateState(next);
    setTimeLeft(getDuration(next));
  }, [updateState]);

  const totalDuration = getDuration(state);
  const progress = totalDuration > 0 ? Math.min(1, Math.max(0, 1 - timeLeft / totalDuration)) : 0;

  return {
    state,
    timeLeft,
    progress,
    start,
    pause,
    reset,
    setPhase,
    setDuration,
    nextPhase,
  };
}
