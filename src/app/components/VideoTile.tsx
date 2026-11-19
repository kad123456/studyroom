'use client';
import { useEffect, useRef } from 'react';
import { MicOff, VideoOff, Pin, PinOff } from 'lucide-react';
import { getInitials } from '@/lib/utils';

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  muted?: boolean;
  cameraOff?: boolean;
  goal?: string;
  isLocal?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

export default function VideoTile({
  stream,
  name,
  muted = true,
  cameraOff = false,
  goal,
  isLocal = false,
  isPinned = false,
  onTogglePin,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      className={`relative w-full h-full rounded-2xl overflow-hidden glass-card transition-all duration-300 group flex items-center justify-center ${
        isPinned ? 'ring-2 ring-purple-500 shadow-xl shadow-purple-500/20' : ''
      }`}
      style={{ minHeight: '200px' }}
    >
      {/* Video element */}
      {!cameraOff && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
          style={{ transform: isLocal ? 'scaleX(-1)' : 'none' }}
        />
      ) : (
        /* Camera Off Avatar */
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900/90 via-purple-950/40 to-slate-900/90 p-4">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold bg-gradient-to-tr from-purple-600 to-indigo-500 text-white shadow-lg shadow-purple-500/25 mb-2 transform transition-transform group-hover:scale-105">
            {getInitials(name)}
          </div>
          <span className="text-sm font-medium text-slate-300">{name}</span>
          <span className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <VideoOff className="w-3 h-3 text-slate-400" /> Camera off
          </span>
        </div>
      )}

      {/* Top action controls overlay */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10 opacity-90 transition-opacity">
        {onTogglePin && (
          <button
            onClick={onTogglePin}
            className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-md text-slate-300 hover:text-white transition-all opacity-0 group-hover:opacity-100"
            title={isPinned ? 'Unpin video' : 'Pin video'}
          >
            {isPinned ? <PinOff className="w-3.5 h-3.5 text-purple-400" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
        )}

        {muted && (
          <div
            className="p-1.5 rounded-lg bg-red-500/80 backdrop-blur-md text-white shadow-sm"
            title="Microphone muted"
          >
            <MicOff className="w-3.5 h-3.5" />
          </div>
        )}

        {cameraOff && !isLocal && (
          <div
            className="p-1.5 rounded-lg bg-slate-800/80 backdrop-blur-md text-slate-300"
            title="Camera off"
          >
            <VideoOff className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Bottom gradient overlay & info bar */}
      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex flex-col justify-end pointer-events-none">
        <div className="flex items-center gap-2">
          {isLocal && (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-600/90 text-white backdrop-blur-sm shadow-sm">
              YOU
            </span>
          )}
          <span className="text-sm font-medium text-white truncate drop-shadow-md">
            {name}
          </span>
        </div>

        {goal && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-purple-200/90 bg-purple-950/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-purple-500/20 max-w-full truncate">
            <span className="text-sm">🎯</span>
            <span className="truncate">{goal}</span>
          </div>
        )}
      </div>
    </div>
  );
}
