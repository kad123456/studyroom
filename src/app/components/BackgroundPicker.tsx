'use client';
import { Check } from 'lucide-react';

export interface ThemeOption {
  id: string;
  name: string;
  emoji: string;
  className: string;
  previewBg: string;
}

export const THEMES: ThemeOption[] = [
  {
    id: 'cozy',
    name: 'Cozy Night',
    emoji: '🌙',
    className: 'bg-theme-cozy',
    previewBg: 'from-purple-900/60 to-slate-950',
  },
  {
    id: 'rainy',
    name: 'Rainy Window',
    emoji: '🌧️',
    className: 'bg-theme-rainy',
    previewBg: 'from-sky-950/70 to-slate-950',
  },
  {
    id: 'minimal',
    name: 'Minimal Dark',
    emoji: '◾',
    className: 'bg-theme-minimal',
    previewBg: 'from-slate-900 to-black',
  },
  {
    id: 'lofi',
    name: 'Lo-fi Library',
    emoji: '📚',
    className: 'bg-theme-lofi',
    previewBg: 'from-pink-950/60 to-slate-950',
  },
  {
    id: 'forest',
    name: 'Forest Sanctuary',
    emoji: '🌲',
    className: 'bg-theme-forest',
    previewBg: 'from-emerald-950/60 to-slate-950',
  },
];

interface BackgroundPickerProps {
  currentTheme: string;
  onSelectTheme: (themeClass: string) => void;
}

export default function BackgroundPicker({
  currentTheme,
  onSelectTheme,
}: BackgroundPickerProps) {
  return (
    <div className="p-3 flex flex-col h-full">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Aesthetic Themes
        </span>
        <span className="text-[11px] text-slate-500">StudyStream Mood</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto pr-1">
        {THEMES.map((theme) => {
          const isSelected = currentTheme === theme.className;

          return (
            <button
              key={theme.id}
              onClick={() => onSelectTheme(theme.className)}
              className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all group bg-gradient-to-br ${
                theme.previewBg
              } ${
                isSelected
                  ? 'border-purple-500 ring-2 ring-purple-500/30 shadow-md shadow-purple-500/20'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl transform group-hover:scale-110 transition-transform">
                  {theme.emoji}
                </span>
                <div>
                  <h4 className="text-xs font-medium text-white">{theme.name}</h4>
                  <span className="text-[10px] text-slate-400">Atmosphere</span>
                </div>
              </div>

              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
