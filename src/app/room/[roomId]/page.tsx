'use client';
import { Suspense, useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWebRTC } from '@/hooks/useWebRTC';
import VideoGrid from '@/app/components/VideoGrid';
import ControlBar from '@/app/components/ControlBar';
import Sidebar from '@/app/components/Sidebar';
import { Copy, Check, BookOpen, AlertCircle } from 'lucide-react';

function RoomContent() {
  const params = useParams();
  const roomId = (params?.roomId as string) || '';
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [initialGoal, setInitialGoal] = useState('');
  const [bgTheme, setBgTheme] = useState('bg-theme-cozy');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinInputName, setJoinInputName] = useState('');
  const [joinInputGoal, setJoinInputGoal] = useState('');

  // Check stored name on mount
  useEffect(() => {
    let restoreFrame: number;
    const savedName = sessionStorage.getItem('studyroom_name');
    const savedGoal = sessionStorage.getItem('studyroom_goal') || '';

    if (savedName) {
      restoreFrame = requestAnimationFrame(() => {
        setDisplayName(savedName);
        setInitialGoal(savedGoal);
      });
    } else {
      // User entered via direct link without visiting lobby
      restoreFrame = requestAnimationFrame(() => setShowJoinModal(true));
    }

    return () => cancelAnimationFrame(restoreFrame);
  }, []);

  const handleJoinFromModal = (e: React.FormEvent) => {
    e.preventDefault();
    const name = joinInputName.trim();
    if (!name) return;

    sessionStorage.setItem('studyroom_name', name);
    if (joinInputGoal.trim()) {
      sessionStorage.setItem('studyroom_goal', joinInputGoal.trim());
    } else {
      sessionStorage.removeItem('studyroom_goal');
    }

    setDisplayName(name);
    setInitialGoal(joinInputGoal.trim());
    setShowJoinModal(false);
  };

  const {
    localStream,
    participants,
    myPeerId,
    isMuted,
    isCameraOff,
    isScreenSharing,
    mediaError,
    roomSyncError,
    isRequestingMedia,
    retryMedia,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    leaveRoom,
    setGoal,
    myGoal,
  } = useWebRTC(roomId, displayName, initialGoal);

  const handleLeave = useCallback(() => {
    leaveRoom();
    router.push('/');
  }, [leaveRoom, router]);

  const copyInvite = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  // Direct Join Modal for invited friends
  if (showJoinModal) {
    return (
      <div className="min-h-screen bg-theme-cozy flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full p-6 sm:p-8 rounded-3xl border border-white/15 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 flex items-center justify-center text-white">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Join Study Room</h2>
              <p className="text-xs text-slate-400">Room Code: <span className="font-mono text-purple-300">{roomId}</span></p>
            </div>
          </div>

          <form onSubmit={handleJoinFromModal} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Your Display Name
              </label>
              <input
                type="text"
                value={joinInputName}
                onChange={(e) => setJoinInputName(e.target.value)}
                placeholder="e.g. Liam 📖"
                maxLength={24}
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Your Study Goal (Optional)
              </label>
              <input
                type="text"
                value={joinInputGoal}
                onChange={(e) => setJoinInputGoal(e.target.value)}
                placeholder="e.g. 50 Flashcards"
                maxLength={40}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={!joinInputName.trim()}
              className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 transition-all shadow-lg shadow-purple-600/30"
            >
              Enter Study Room
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden transition-colors duration-500 ${bgTheme}`}>
      {/* Media Permission Warning Banner if any */}
      {(mediaError || isRequestingMedia) && (
        <div role="alert" className="bg-amber-500/20 border-b border-amber-500/30 text-amber-200 px-4 py-2 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 z-30">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="leading-relaxed">
              {isRequestingMedia ? 'Requesting camera and microphone access…' : mediaError}
            </span>
          </div>
          <button
            onClick={() => void retryMedia()}
            disabled={isRequestingMedia}
            className="underline font-medium hover:text-white disabled:opacity-60 disabled:cursor-wait self-start sm:self-auto flex-shrink-0"
          >
            {isRequestingMedia ? 'Requesting access…' : 'Try again'}
          </button>
        </div>
      )}
      {roomSyncError && (
        <div role="alert" className="bg-red-500/20 border-b border-red-500/30 text-red-100 px-4 py-2 text-xs flex items-center gap-2 z-30">
          <AlertCircle className="w-4 h-4 text-red-300 flex-shrink-0" />
          <span className="leading-relaxed">{roomSyncError}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="h-14 px-4 flex items-center justify-between glass border-b border-white/5 flex-shrink-0 z-20">
        {/* Brand & Room Indicator */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 group"
            title="Return to StudyRoom Lobby"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-sm">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-white tracking-tight hidden sm:inline">
              Study<span className="text-purple-400">Room</span>
            </span>
          </button>

          <div className="h-4 w-px bg-white/10 hidden sm:block" />

          {/* Room Code Badge */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-400">Room:</span>
            <span className="text-xs font-mono font-bold text-purple-300">{roomId}</span>
            <button
              onClick={copyInvite}
              className="p-1 text-slate-400 hover:text-purple-300 transition-colors ml-1"
              title="Copy shareable link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Center / Right: Status info & User Profile */}
        <div className="flex items-center gap-3">
          <button
            onClick={copyInvite}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-medium transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Link Copied!' : 'Share Room Link'}</span>
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="font-medium truncate max-w-[120px]">{displayName}</span>
          </div>
        </div>
      </header>

      {/* Main Workspace: Video Canvas + Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Stage */}
        <main className="flex-1 h-full overflow-hidden relative">
          <VideoGrid
            localStream={localStream}
            participants={participants}
            localName={displayName}
            localMuted={isMuted}
            localCameraOff={isCameraOff}
            localGoal={myGoal}
            roomId={roomId}
          />
        </main>

        {/* Collapsible Productivity Sidebar */}
        <Sidebar
          roomId={roomId}
          displayName={displayName}
          myPeerId={myPeerId}
          onSetGoal={setGoal}
          currentGoal={myGoal}
          bgTheme={bgTheme}
          onBgChange={setBgTheme}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Bottom Sticky Control Bar */}
      <ControlBar
        roomId={roomId}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isScreenSharing={isScreenSharing}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onToggleScreenShare={toggleScreenShare}
        onLeave={handleLeave}
        participantCount={participants.size + 1}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      />
    </div>
  );
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-theme-cozy flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
            <span className="text-xs text-slate-400">Loading StudyRoom...</span>
          </div>
        </div>
      }
    >
      <RoomContent />
    </Suspense>
  );
}
