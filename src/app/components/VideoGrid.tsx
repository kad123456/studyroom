'use client';
import { useState } from 'react';
import { Participant } from '@/hooks/useWebRTC';
import VideoTile from './VideoTile';
import { Users, Link2, Copy, Check } from 'lucide-react';

interface VideoGridProps {
  localStream: MediaStream | null;
  participants: Map<string, Participant>;
  localName: string;
  localMuted: boolean;
  localCameraOff: boolean;
  localGoal: string;
  roomId: string;
}

export default function VideoGrid({
  localStream,
  participants,
  localName,
  localMuted,
  localCameraOff,
  localGoal,
  roomId,
}: VideoGridProps) {
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const participantList = Array.from(participants.values());
  const totalCount = participantList.length + 1; // including local

  const copyInvite = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  // If a tile is pinned
  if (pinnedId) {
    const isLocalPinned = pinnedId === 'local';
    const pinnedParticipant = participantList.find((p) => p.id === pinnedId);

    return (
      <div className="flex flex-col md:flex-row h-full w-full gap-3 p-2 overflow-hidden">
        {/* Main Pinned View */}
        <div className="flex-1 h-full min-h-0">
          {isLocalPinned ? (
            <VideoTile
              stream={localStream}
              name={localName}
              muted={localMuted}
              cameraOff={localCameraOff}
              goal={localGoal}
              isLocal
              isPinned
              onTogglePin={() => setPinnedId(null)}
            />
          ) : pinnedParticipant ? (
            <VideoTile
              stream={pinnedParticipant.stream}
              name={pinnedParticipant.name}
              muted={pinnedParticipant.muted}
              cameraOff={pinnedParticipant.cameraOff}
              goal={pinnedParticipant.goal}
              isPinned
              onTogglePin={() => setPinnedId(null)}
            />
          ) : null}
        </div>

        {/* Side thumbnail strip */}
        <div className="w-full md:w-64 flex md:flex-col gap-2.5 overflow-x-auto md:overflow-y-auto flex-shrink-0">
          {!isLocalPinned && (
            <div className="w-56 md:w-full h-36 md:h-40 flex-shrink-0">
              <VideoTile
                stream={localStream}
                name={localName}
                muted={localMuted}
                cameraOff={localCameraOff}
                goal={localGoal}
                isLocal
                onTogglePin={() => setPinnedId('local')}
              />
            </div>
          )}
          {participantList
            .filter((p) => p.id !== pinnedId)
            .map((p) => (
              <div key={p.id} className="w-56 md:w-full h-36 md:h-40 flex-shrink-0">
                <VideoTile
                  stream={p.stream}
                  name={p.name}
                  muted={p.muted}
                  cameraOff={p.cameraOff}
                  goal={p.goal}
                  onTogglePin={() => setPinnedId(p.id)}
                />
              </div>
            ))}
        </div>
      </div>
    );
  }

  // Dynamic grid configuration
  const getGridClasses = () => {
    if (totalCount === 1) {
      return 'grid-cols-1 max-w-3xl mx-auto';
    }
    if (totalCount === 2) {
      return 'grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto';
    }
    if (totalCount <= 4) {
      return 'grid-cols-1 sm:grid-cols-2 max-w-6xl mx-auto';
    }
    if (totalCount <= 6) {
      return 'grid-cols-2 sm:grid-cols-3';
    }
    return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  };

  return (
    <div className="h-full w-full flex flex-col justify-center p-3 relative overflow-hidden">
      <div className={`grid gap-3.5 h-full w-full auto-rows-fr ${getGridClasses()}`}>
        {/* Local Participant Tile */}
        <VideoTile
          stream={localStream}
          name={localName}
          muted={localMuted}
          cameraOff={localCameraOff}
          goal={localGoal}
          isLocal
          onTogglePin={() => setPinnedId('local')}
        />

        {/* Remote Participant Tiles */}
        {participantList.map((p) => (
          <VideoTile
            key={p.id}
            stream={p.stream}
            name={p.name}
            muted={p.muted}
            cameraOff={p.cameraOff}
            goal={p.goal}
            onTogglePin={() => setPinnedId(p.id)}
          />
        ))}

        {/* Solo study helper card if only 1 person in room */}
        {totalCount === 1 && (
          <div className="col-span-full mt-3 flex justify-center pointer-events-auto">
            <div className="glass px-4 py-2.5 rounded-2xl flex items-center gap-3 text-xs text-slate-300 max-w-md shadow-lg border border-purple-500/20">
              <Users className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span>You&apos;re the only one here right now. Invite friends to focus with you!</span>
              <button
                onClick={copyInvite}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-all shadow-sm flex-shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Invite'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
