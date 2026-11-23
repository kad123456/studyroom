'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomId } from '@/lib/utils';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { onValue, ref } from 'firebase/database';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  ArrowRight,
  BookOpen,
  Sparkles,
  Users,
  Timer,
  Music,
  ShieldCheck,
} from 'lucide-react';

const defaultRooms = [
  { id: 'quiet-focus', name: 'Quiet Focus', description: 'Settle in for a calm, distraction-free study session.', icon: '🌙' },
  { id: 'exam-prep', name: 'Exam Prep', description: 'Work through revision alongside other learners.', icon: '📚' },
  { id: 'study-together', name: 'Study Together', description: 'Bring any subject and make progress together.', icon: '✨' },
];

export default function LobbyPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [studyGoal, setStudyGoal] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [liveRooms, setLiveRooms] = useState<Record<string, number>>({});
  const [roomDirectoryStatus, setRoomDirectoryStatus] = useState<'loading' | 'ready' | 'unavailable'>(
    isFirebaseConfigured && db ? 'loading' : 'unavailable',
  );

  // Media preview states
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(false); // default muted on join
  const [hasMediaPermission, setHasMediaPermission] = useState<boolean | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      return;
    }

    const unsubscribe = onValue(
      ref(db, 'publicRooms'),
      (snapshot) => {
        const directory = snapshot.val() as Record<string, Record<string, unknown>> | null;
        const counts: Record<string, number> = {};
        for (const [roomId, participants] of Object.entries(directory ?? {})) {
          counts[roomId] = Object.keys(participants ?? {}).length;
        }
        setLiveRooms(counts);
        setRoomDirectoryStatus('ready');
      },
      (error) => {
        console.warn('Live room directory is unavailable:', error);
        setRoomDirectoryStatus('unavailable');
      },
    );

    return () => unsubscribe();
  }, []);

  // Setup initial camera preview
  useEffect(() => {
    let streamInstance: MediaStream | null = null;
    let animId: number;
    let restoreNameFrame: number | undefined;

    async function startPreview() {
      if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true,
        });
        streamInstance = stream;
        setPreviewStream(stream);
        setHasMediaPermission(true);

        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }

        // Default mic muted
        stream.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });

        // Setup simple audio level meter for microphone test
        try {
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateAudioLevel = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animId = requestAnimationFrame(updateAudioLevel);
          };
          updateAudioLevel();
        } catch {}
      } catch (err) {
        console.warn('Lobby camera preview not permitted or unavailable:', err);
        setHasMediaPermission(false);
      }
    }

    startPreview();

    // Load any remembered name from sessionStorage
    const savedName = sessionStorage.getItem('studyroom_name');
    if (savedName) {
      restoreNameFrame = requestAnimationFrame(() => setDisplayName(savedName));
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (restoreNameFrame) cancelAnimationFrame(restoreNameFrame);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (streamInstance) {
        streamInstance.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const togglePreviewCamera = () => {
    if (!previewStream) return;
    const next = !cameraEnabled;
    previewStream.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setCameraEnabled(next);
  };

  const togglePreviewMic = () => {
    if (!previewStream) return;
    const next = !micEnabled;
    previewStream.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    setMicEnabled(next);
  };

  const enterRoom = (targetRoomId: string) => {
    const cleanName = displayName.trim();
    if (!cleanName) {
      setMode('join');
      setRoomCode(targetRoomId);
      requestAnimationFrame(() => nameInputRef.current?.focus());
      return;
    }

    setLoading(true);

    // Persist details for the room session
    sessionStorage.setItem('studyroom_name', cleanName);
    if (studyGoal.trim()) {
      sessionStorage.setItem('studyroom_goal', studyGoal.trim());
    } else {
      sessionStorage.removeItem('studyroom_goal');
    }

    // Stop lobby stream so room page can claim media cleanly
    if (previewStream) {
      previewStream.getTracks().forEach((t) => t.stop());
    }

    router.push(`/room/${targetRoomId}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const targetRoomId = mode === 'create' ? generateRoomId() : roomCode.trim().toLowerCase();

    if (!targetRoomId) {
      setFormError('Enter a room code to join.');
      return;
    }
    if (!/^[a-z0-9-]{1,30}$/.test(targetRoomId)) {
      setFormError('Room codes can use lowercase letters, numbers, and hyphens.');
      return;
    }

    enterRoom(targetRoomId);
  };

  const otherRooms = Object.entries(liveRooms)
    .filter(([roomId, count]) => count > 0 && !defaultRooms.some((room) => room.id === roomId) && /^[a-z0-9-]{1,30}$/.test(roomId))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-theme-cozy text-slate-100 flex flex-col justify-between relative overflow-hidden">
      {/* Background ambient aesthetic lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-purple-600/15 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-indigo-600/15 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-purple-900/10 blur-[150px]" />
      </div>

      {/* Top Navbar */}
      <header className="w-full px-6 py-4 flex items-center justify-between relative z-10 glass border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-600/30">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white">
              Study<span className="text-purple-400">Room</span>
            </span>
            <span className="hidden sm:inline text-xs text-slate-400 ml-2">
              Virtual Co-Working Space
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-950/40 px-3 py-1.5 rounded-full border border-purple-500/20">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Peer-to-Peer & Free</span>
        </div>
      </header>

      {/* Main Hero & Lobby Grid */}
      <main className="w-full max-w-6xl mx-auto px-4 py-8 md:py-12 flex-1 flex flex-col justify-center relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Heading & Cam Preview */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Inspired by StudyStream • Study with friends via camera</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
              A free virtual study room. <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-pink-400 bg-clip-text text-transparent">
                Study online with friends.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-400 max-w-xl">
              StudyRoom is a free online study room where classmates and friends focus together on camera. Create or join with a link, use a shared Pomodoro timer, track study goals, chat, and play ambient sounds. No account required.
            </p>

            {/* Webcam & Mic Live Preview Card */}
            <div className="w-full max-w-md glass-card rounded-3xl p-3 border border-white/10 shadow-2xl relative">
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center">
                {cameraEnabled && hasMediaPermission && previewStream ? (
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover -scale-x-100"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 text-xs gap-2 p-4 text-center">
                    <VideoOff className="w-8 h-8 text-slate-600" />
                    <span>
                      {hasMediaPermission === false
                        ? 'Camera permission denied or camera unavailable'
                        : 'Camera is currently off'}
                    </span>
                  </div>
                )}

                {/* Cam / Mic toggle overlay */}
                <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={togglePreviewMic}
                    className={`p-2.5 rounded-xl backdrop-blur-md transition-all ${
                      micEnabled
                        ? 'bg-emerald-500/80 text-white shadow-lg shadow-emerald-500/30'
                        : 'bg-red-500/80 text-white shadow-lg shadow-red-500/30'
                    }`}
                    title={micEnabled ? 'Mute Mic' : 'Unmute Mic'}
                  >
                    {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={togglePreviewCamera}
                    className={`p-2.5 rounded-xl backdrop-blur-md transition-all ${
                      cameraEnabled
                        ? 'bg-purple-600/80 text-white shadow-lg shadow-purple-600/30'
                        : 'bg-red-500/80 text-white shadow-lg shadow-red-500/30'
                    }`}
                    title={cameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
                  >
                    {cameraEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Audio level meter feedback */}
              <div className="mt-2.5 px-2 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${micEnabled ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  {micEnabled ? 'Mic Active' : 'Default Muted (Quiet Mode)'}
                </span>
                {micEnabled && (
                  <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-75"
                      style={{ width: `${audioLevel}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Join / Create Form Card */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto">
            <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/15 shadow-2xl relative">
              {/* Mode Toggle (Create vs Join) */}
              <div className="flex p-1 bg-black/40 rounded-2xl mb-6 border border-white/10">
                <button
                  type="button"
                  onClick={() => setMode('create')}
                  className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    mode === 'create'
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ✨ Create Room
                </button>
                <button
                  type="button"
                  onClick={() => setMode('join')}
                  className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    mode === 'join'
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🔗 Join Room
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Display Name */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Your Name
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Maya 📚"
                    maxLength={24}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 text-sm transition-all"
                  />
                </div>

                {/* Session Goal */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Session Goal <span className="text-[10px] text-slate-500 font-normal">(Shows on your video tile)</span>
                  </label>
                  <input
                    type="text"
                    value={studyGoal}
                    onChange={(e) => setStudyGoal(e.target.value)}
                    placeholder="e.g. Finish Calculus Chapter 4"
                    maxLength={40}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 text-sm transition-all"
                  />
                </div>

                {/* Room Code if Join Mode */}
                {mode === 'join' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Room Code
                    </label>
                    <input
                      type="text"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value)}
                      placeholder="e.g. 8-letter room code"
                      maxLength={30}
                      required
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 text-sm font-mono transition-all"
                    />
                  </div>
                )}

                {formError && <p role="alert" className="text-xs text-rose-300">{formError}</p>}

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={loading || !displayName.trim()}
                  className="w-full mt-2 py-3.5 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-xl shadow-purple-600/30"
                >
                  <span>{loading ? 'Entering Room...' : mode === 'create' ? 'Create Study Room' : 'Join Room'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Instant Link Note */}
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-[11px] text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>No sign-up required. Share the link with friends to join via webcam.</span>
              </div>
            </div>
          </div>
        </div>

        <section aria-labelledby="open-study-rooms" className="mt-12 w-full">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">Drop in and focus</p>
              <h2 id="open-study-rooms" className="mt-1 text-2xl font-bold text-white">Open study rooms</h2>
              <p className="mt-1 text-sm text-slate-400">Choose a room and see how many people are studying there now.</p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs text-slate-400">
              <span className={`h-2 w-2 rounded-full ${roomDirectoryStatus === 'ready' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {roomDirectoryStatus === 'loading' ? 'Checking live rooms' : roomDirectoryStatus === 'ready' ? 'Live people count' : 'Live counts unavailable'}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {defaultRooms.map((room) => (
              <article key={room.id} className="glass-card rounded-2xl border border-white/10 p-4 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="text-2xl">{room.icon}</span>
                    <div>
                      <h3 className="font-semibold text-white">{room.name}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">{room.description}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                    {roomDirectoryStatus === 'ready' ? `${liveRooms[room.id] ?? 0} ${liveRooms[room.id] === 1 ? 'person' : 'people'}` : '—'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => enterRoom(room.id)}
                  disabled={loading}
                  className="mt-4 w-full rounded-xl border border-purple-400/20 bg-purple-500/10 px-3 py-2 text-sm font-semibold text-purple-100 transition hover:bg-purple-500/20 disabled:opacity-50"
                >
                  Join room
                </button>
              </article>
            ))}
          </div>

          {roomDirectoryStatus === 'unavailable' && (
            <p className="mt-3 text-xs text-amber-200/80">The public room count could not load. You can still create a room or join with a code.</p>
          )}

          {otherRooms.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">Other active rooms</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {otherRooms.map(([roomId, count]) => (
                      <button
                        key={roomId}
                        type="button"
                        onClick={() => enterRoom(roomId)}
                        disabled={loading}
                        className="glass rounded-2xl border border-white/10 p-4 text-left transition hover:border-purple-400/40 disabled:opacity-50"
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-white">Room {roomId}</span>
                          <span className="text-xs text-emerald-200">{count} {count === 1 ? 'person' : 'people'}</span>
                        </span>
                        <span className="mt-1 block text-xs text-slate-400">Join a live room by code</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
        </section>

        {/* Feature Pills Footer Row */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[
            { icon: Video, title: 'Multi-User Video Grid', desc: 'Direct WebRTC mesh' },
            { icon: Timer, title: 'Synced Pomodoro', desc: 'Shared timer & chimes' },
            { icon: Music, title: 'Lofi & Ambient Soundscapes', desc: 'Rain, Coffee, Noise' },
            { icon: Users, title: 'Task Accountability', desc: 'Active goal badges' },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="glass p-3.5 rounded-2xl flex items-center gap-3 border border-white/5"
              >
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-200">{item.title}</h4>
                  <p className="text-[11px] text-slate-400">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <section aria-labelledby="study-room-guide" className="mt-12 w-full max-w-4xl mx-auto glass-card rounded-3xl p-6 md:p-8 border border-white/10">
          <h2 id="study-room-guide" className="text-xl md:text-2xl font-bold text-white text-center">
            A simple online study room for focused sessions
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300 text-center max-w-3xl mx-auto">
            Study with friends from anywhere without coordinating a video call. Share one room link, keep cameras on for accountability, and stay in sync with a group focus timer, goals, chat, and relaxing background sounds.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <h3 className="font-semibold text-purple-200">How do I join?</h3>
              <p className="mt-1 text-slate-400">Create a study room and send its invite link, or enter a friend’s room code.</p>
            </div>
            <div>
              <h3 className="font-semibold text-purple-200">Is StudyRoom free?</h3>
              <p className="mt-1 text-slate-400">Yes. Join a virtual study session without creating an account.</p>
            </div>
            <div>
              <h3 className="font-semibold text-purple-200">Can we use Pomodoro?</h3>
              <p className="mt-1 text-slate-400">Yes. Start shared focus and break sessions while everyone’s timer stays in sync.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-500 relative z-10 border-t border-white/5">
        StudyRoom • Virtual Co-Working Space • Built with Next.js, PeerJS & Firebase
      </footer>
    </div>
  );
}
