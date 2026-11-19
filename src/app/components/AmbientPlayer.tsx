'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Volume2, VolumeX, Play, Pause, Waves, Coffee, CloudRain, Music2 } from 'lucide-react';

interface SoundOption {
  id: string;
  name: string;
  emoji: string;
  icon: typeof CloudRain;
  url?: string;
  isSynthesized?: boolean;
}

const SOUNDS: SoundOption[] = [
  {
    id: 'rain',
    name: 'Rainy Atmosphere',
    emoji: '🌧️',
    icon: CloudRain,
    url: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_db6591201e.mp3?filename=soft-rain-ambient-111154.mp3',
  },
  {
    id: 'coffee',
    name: 'Cozy Coffee Shop',
    emoji: '☕',
    icon: Coffee,
    url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=coffee-shop-ambience-18873.mp3',
  },
  {
    id: 'whitenoise',
    name: 'Pure White Noise',
    emoji: '🌊',
    icon: Waves,
    isSynthesized: true,
  },
  {
    id: 'lofi',
    name: 'Lo-fi Study Beats',
    emoji: '🎵',
    icon: Music2,
    url: 'https://stream.laut.fm/lofi',
  },
];

export default function AmbientPlayer() {
  const [playing, setPlaying] = useState<Record<string, boolean>>({});
  const [volumes, setVolumes] = useState<Record<string, number>>({
    rain: 0.5,
    coffee: 0.4,
    whitenoise: 0.25,
    lofi: 0.45,
  });

  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const whiteNoiseCtx = useRef<{ ctx: AudioContext; gainNode: GainNode; source: AudioBufferSourceNode } | null>(null);

  // Web Audio pure white noise synthesizer (100% reliable anywhere, zero buffering)
  const startWhiteNoise = useCallback((vol: number) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Pink / White noise spectrum filter
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(vol, ctx.currentTime);

      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start();

      whiteNoiseCtx.current = { ctx, gainNode, source };
    } catch (e) {
      console.warn('White noise audio synthesis error:', e);
    }
  }, []);

  const stopWhiteNoise = useCallback(() => {
    if (whiteNoiseCtx.current) {
      try {
        whiteNoiseCtx.current.source.stop();
        whiteNoiseCtx.current.ctx.close();
      } catch {}
      whiteNoiseCtx.current = null;
    }
  }, []);

  const toggleTrack = (sound: SoundOption) => {
    const isCurrentlyPlaying = Boolean(playing[sound.id]);

    if (isCurrentlyPlaying) {
      // Pause
      setPlaying((prev) => ({ ...prev, [sound.id]: false }));
      if (sound.isSynthesized) {
        stopWhiteNoise();
      } else {
        const audio = audioRefs.current.get(sound.id);
        if (audio) {
          audio.pause();
        }
      }
    } else {
      // Play
      setPlaying((prev) => ({ ...prev, [sound.id]: true }));
      const vol = volumes[sound.id] ?? 0.5;

      if (sound.isSynthesized) {
        startWhiteNoise(vol);
      } else if (sound.url) {
        let audio = audioRefs.current.get(sound.id);
        if (!audio) {
          audio = new Audio(sound.url);
          audio.loop = true;
          audio.crossOrigin = 'anonymous';
          audioRefs.current.set(sound.id, audio);
        }
        audio.volume = vol;
        audio.play().catch((err) => {
          console.warn('Playback error for', sound.id, err);
          setPlaying((prev) => ({ ...prev, [sound.id]: false }));
        });
      }
    }
  };

  const handleVolumeChange = (soundId: string, val: number) => {
    setVolumes((prev) => ({ ...prev, [soundId]: val }));

    if (soundId === 'whitenoise' && whiteNoiseCtx.current) {
      whiteNoiseCtx.current.gainNode.gain.setValueAtTime(val, whiteNoiseCtx.current.ctx.currentTime);
    } else {
      const audio = audioRefs.current.get(soundId);
      if (audio) {
        audio.volume = val;
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWhiteNoise();
      audioRefs.current.forEach((audio) => {
        audio.pause();
      });
      audioRefs.current.clear();
    };
  }, [stopWhiteNoise]);

  return (
    <div className="p-3 flex flex-col h-full">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Ambient Soundscapes
        </span>
        <span className="text-[11px] text-slate-500">Focus Mix</span>
      </div>

      <div className="space-y-2.5 overflow-y-auto pr-1">
        {SOUNDS.map((sound) => {
          const isTrackPlaying = Boolean(playing[sound.id]);
          const currentVol = volumes[sound.id] ?? 0.5;
          const Icon = sound.icon;

          return (
            <div
              key={sound.id}
              className={`p-3 rounded-2xl border transition-all duration-200 ${
                isTrackPlaying
                  ? 'bg-purple-950/30 border-purple-500/40 shadow-sm'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{sound.emoji}</span>
                  <div>
                    <h4 className="text-xs font-medium text-slate-200">{sound.name}</h4>
                    <span className="text-[10px] text-slate-500">
                      {isTrackPlaying ? 'Playing' : 'Muted'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => toggleTrack(sound)}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                    isTrackPlaying
                      ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/40'
                      : 'bg-white/10 hover:bg-white/20 text-slate-300'
                  }`}
                  title={isTrackPlaying ? 'Pause sound' : 'Play sound'}
                >
                  {isTrackPlaying ? (
                    <Pause className="w-4 h-4 fill-white" />
                  ) : (
                    <Play className="w-4 h-4 fill-slate-300 ml-0.5" />
                  )}
                </button>
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-2 pt-1 px-1">
                <VolumeX className="w-3 h-3 text-slate-500 flex-shrink-0" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={currentVol}
                  onChange={(e) => handleVolumeChange(sound.id, parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/15 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <Volume2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
