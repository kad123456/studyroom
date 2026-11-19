'use client';
import { useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  LogOut,
  Copy,
  Check,
  PanelRight,
  PanelRightClose,
  Sparkles,
} from 'lucide-react';

interface ControlBarProps {
  roomId: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onLeave: () => void;
  participantCount: number;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function ControlBar({
  roomId,
  isMuted,
  isCameraOff,
  isScreenSharing,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onLeave,
  participantCount,
  sidebarOpen,
  onToggleSidebar,
}: ControlBarProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  return (
    <footer className="w-full px-4 py-2.5 flex items-center justify-between glass border-t border-white/5 relative z-20">
      {/* Left: Room Info & Invite */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-400">Room:</span>
          <span className="font-mono font-medium text-slate-200">{roomId}</span>
        </div>

        <button
          onClick={copyLink}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-medium transition-all"
          title="Copy invite link to share with friends"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
        </button>

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
          <span>👥 {participantCount} {participantCount === 1 ? 'focusing' : 'focusing'}</span>
        </div>
      </div>

      {/* Center: Main Media Action Buttons */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Microphone Toggle */}
        <button
          onClick={onToggleMute}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200 ${
            isMuted
              ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40'
              : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
          }`}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-emerald-400" />}
          <span className="text-[10px] mt-0.5 font-medium">{isMuted ? 'Muted' : 'Mute'}</span>
        </button>

        {/* Camera Toggle */}
        <button
          onClick={onToggleCamera}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200 ${
            isCameraOff
              ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40'
              : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
          }`}
          title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
        >
          {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5 text-purple-400" />}
          <span className="text-[10px] mt-0.5 font-medium">{isCameraOff ? 'Cam Off' : 'Cam On'}</span>
        </button>

        {/* Screen Share Toggle */}
        <button
          onClick={onToggleScreenShare}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200 ${
            isScreenSharing
              ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30'
              : 'bg-white/10 hover:bg-white/20 text-slate-300 border border-white/15'
          }`}
          title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
        >
          {isScreenSharing ? <ScreenShareOff className="w-5 h-5" /> : <ScreenShare className="w-5 h-5" />}
          <span className="text-[10px] mt-0.5 font-medium">{isScreenSharing ? 'Sharing' : 'Share'}</span>
        </button>

        {/* Leave Room */}
        <button
          onClick={onLeave}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-red-600/80 hover:bg-red-500 text-white transition-all duration-200 shadow-md shadow-red-600/20"
          title="Leave Room"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 font-medium">Leave</span>
        </button>
      </div>

      {/* Right: Sidebar & Layout Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            sidebarOpen
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
              : 'bg-white/10 hover:bg-white/15 text-slate-300 border border-white/10'
          }`}
          title="Toggle Productivity Sidebar"
        >
          {sidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
          <span className="hidden sm:inline">Suite</span>
        </button>
      </div>
    </footer>
  );
}
