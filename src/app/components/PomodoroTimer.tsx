'use client';
import { Play, Pause, RotateCcw, SkipForward, Flame, Coffee, Moon, Bell } from 'lucide-react';
import { usePomodoro, PomodoroPhase } from '@/hooks/usePomodoro';
import { formatTime } from '@/lib/utils';
import { isFirebaseConfigured } from '@/lib/firebase';

interface PomodoroTimerProps {
  roomId: string;
  userName?: string;
}

export default function PomodoroTimer({ roomId, userName }: PomodoroTimerProps) {
  const {
    state,
    timeLeft,
    progress,
    start,
    pause,
    reset,
    setPhase,
    setDuration,
    nextPhase,
  } = usePomodoro(roomId, userName);

  const phaseConfig: Record<
    PomodoroPhase,
    { label: string; icon: typeof Flame; color: string; ringColor: string; bg: string }
  > = {
    focus: {
      label: 'Focus Time',
      icon: Flame,
      color: 'text-purple-400',
      ringColor: '#a855f7',
      bg: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
    },
    short: {
      label: 'Short Break',
      icon: Coffee,
      color: 'text-emerald-400',
      ringColor: '#10b981',
      bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    },
    long: {
      label: 'Long Rest',
      icon: Moon,
      color: 'text-sky-400',
      ringColor: '#38bdf8',
      bg: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
    },
  };

  const currentConfig = phaseConfig[state.phase];
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="p-4 flex flex-col items-center">
      {/* Header */}
      <div className="w-full flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Pomodoro Focus
        </span>
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full border ${
            isFirebaseConfigured
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}
        >
          {isFirebaseConfigured ? '🟢 Live Room Sync' : '🟡 Local Mode'}
        </span>
      </div>

      {/* Phase Selector Pills */}
      <div className="w-full grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10 mb-4">
        {(['focus', 'short', 'long'] as PomodoroPhase[]).map((phase) => {
          const cfg = phaseConfig[phase];
          const Icon = cfg.icon;
          const isActive = state.phase === phase;

          return (
            <button
              key={phase}
              onClick={() => setPhase(phase)}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive ? cfg.bg + ' shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{phase === 'focus' ? 'Focus' : phase === 'short' ? 'Short' : 'Long'}</span>
            </button>
          );
        })}
      </div>

      {/* Circular Progress Ring */}
      <div className="relative flex items-center justify-center my-2">
        <svg width="170" height="170" className="-rotate-90">
          {/* Background Ring */}
          <circle
            cx="85"
            cy="85"
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="9"
          />
          {/* Animated Progress Ring */}
          <circle
            cx="85"
            cy="85"
            r={radius}
            fill="none"
            stroke={currentConfig.ringColor}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: 'stroke-dashoffset 0.6s ease',
              filter: `drop-shadow(0 0 10px ${currentConfig.ringColor}60)`,
            }}
          />
        </svg>

        {/* Center Countdown Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-mono font-bold tracking-tight text-white drop-shadow">
            {formatTime(Math.ceil(timeLeft))}
          </span>
          <span className={`text-xs font-medium mt-1 ${currentConfig.color}`}>
            {currentConfig.label}
          </span>
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex items-center gap-3 mt-3 mb-4">
        <button
          onClick={reset}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all"
          title="Reset Timer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={state.running ? pause : start}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white transition-all shadow-lg ${
            state.running
              ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
              : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
          }`}
        >
          {state.running ? (
            <>
              <Pause className="w-4 h-4 fill-white" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Start</span>
            </>
          )}
        </button>

        <button
          onClick={nextPhase}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all"
          title="Skip to Next Phase"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Session Cycle indicator */}
      <div className="w-full flex items-center justify-between px-2 pt-2 border-t border-white/10 text-xs text-slate-400">
        <span>Session {((state.cycle || 0) % 4) + 1} of 4</span>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                idx < ((state.cycle || 0) % 4) + 1
                  ? 'bg-purple-500 shadow-sm shadow-purple-500/50'
                  : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
