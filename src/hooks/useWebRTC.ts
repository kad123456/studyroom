'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { ref, set, onValue, remove, onDisconnect } from 'firebase/database';

export interface Participant {
  id: string;
  name: string;
  stream: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
  goal: string;
  isLocal?: boolean;
}

interface UseWebRTCReturn {
  localStream: MediaStream | null;
  participants: Map<string, Participant>;
  myPeerId: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  mediaError: string | null;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => Promise<void>;
  leaveRoom: () => void;
  setGoal: (goal: string) => void;
  myGoal: string;
}

export function useWebRTC(roomId: string, displayName: string, initialGoal: string = ''): UseWebRTCReturn {
  const localStreamRef = useRef<MediaStream | null>(null);
  const originalCamTrackRef = useRef<MediaStreamTrack | null>(null);
  const peerRef = useRef<any>(null);
  const connectionsRef = useRef<Map<string, any>>(new Map());
  const participantsRef = useRef<Map<string, Participant>>(new Map());

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [myPeerId, setMyPeerId] = useState('');
  const [isMuted, setIsMuted] = useState(true);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [myGoal, setMyGoal] = useState(initialGoal);

  const updateParticipants = useCallback(() => {
    setParticipants(new Map(participantsRef.current));
  }, []);

  // Initialize camera and mic
  const initMedia = useCallback(async (): Promise<MediaStream | null> => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMediaError('Camera/Microphone not supported on this device/browser.');
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Default: muted on join for quiet focus (as per StudyStream spec)
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });

      localStreamRef.current = stream;
      if (stream.getVideoTracks().length > 0) {
        originalCamTrackRef.current = stream.getVideoTracks()[0];
      }
      setLocalStream(stream);
      setIsMuted(true);
      return stream;
    } catch (err: any) {
      console.warn('getUserMedia error:', err);
      // If video+audio fails, try audio-only or video-only
      try {
        const videoOnly = await navigator.mediaDevices.getUserMedia({ video: true });
        localStreamRef.current = videoOnly;
        setLocalStream(videoOnly);
        return videoOnly;
      } catch (videoErr) {
        setMediaError(
          err.name === 'NotAllowedError'
            ? 'Camera/Mic permission was denied. You can still join the room!'
            : 'Unable to access camera or microphone.'
        );
        return null;
      }
    }
  }, []);

  // Initialize PeerJS mesh
  const initPeer = useCallback(
    async (stream: MediaStream | null) => {
      if (typeof window === 'undefined') return;

      try {
        const { Peer } = await import('peerjs');

        // STUN servers configuration
        const peer = new Peer({
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:stun3.l.google.com:19302' },
              { urls: 'stun:stun4.l.google.com:19302' },
            ],
          },
        });
        peerRef.current = peer;

        peer.on('open', (peerId: string) => {
          setMyPeerId(peerId);

          if (isFirebaseConfigured && db && roomId) {
            const myRef = ref(db, `rooms/${roomId}/participants/${peerId}`);
            set(myRef, {
              name: displayName || 'Anonymous',
              muted: true,
              cameraOff: false,
              goal: initialGoal || '',
              joinedAt: Date.now(),
            }).catch(console.warn);

            // Clean up upon connection drop
            onDisconnect(myRef).remove();

            // Listen for other room participants
            const participantsDbRef = ref(db, `rooms/${roomId}/participants`);
            onValue(participantsDbRef, (snapshot) => {
              const data = snapshot.val() || {};
              const remoteIds = Object.keys(data).filter((id) => id !== peerId);

              // Connect to any new peers
              remoteIds.forEach((remoteId) => {
                if (!connectionsRef.current.has(remoteId) && stream) {
                  try {
                    const call = peer.call(remoteId, stream);
                    if (call) {
                      connectionsRef.current.set(remoteId, call);

                      call.on('stream', (remoteStream: MediaStream) => {
                        participantsRef.current.set(remoteId, {
                          id: remoteId,
                          name: data[remoteId]?.name || 'Study Buddy',
                          stream: remoteStream,
                          muted: data[remoteId]?.muted ?? true,
                          cameraOff: data[remoteId]?.cameraOff ?? false,
                          goal: data[remoteId]?.goal || '',
                        });
                        updateParticipants();
                      });

                      call.on('close', () => {
                        participantsRef.current.delete(remoteId);
                        connectionsRef.current.delete(remoteId);
                        updateParticipants();
                      });

                      call.on('error', (callErr: any) => {
                        console.warn('Call error with peer:', remoteId, callErr);
                        participantsRef.current.delete(remoteId);
                        connectionsRef.current.delete(remoteId);
                        updateParticipants();
                      });
                    }
                  } catch (e) {
                    console.warn('Error calling peer:', e);
                  }
                } else if (participantsRef.current.has(remoteId)) {
                  // Update remote peer state (mute, camera, goal)
                  const existing = participantsRef.current.get(remoteId)!;
                  participantsRef.current.set(remoteId, {
                    ...existing,
                    name: data[remoteId]?.name || existing.name,
                    muted: data[remoteId]?.muted ?? existing.muted,
                    cameraOff: data[remoteId]?.cameraOff ?? existing.cameraOff,
                    goal: data[remoteId]?.goal ?? existing.goal,
                  });
                  updateParticipants();
                }
              });

              // Clean up peers that left
              for (const [id] of participantsRef.current) {
                if (!remoteIds.includes(id)) {
                  participantsRef.current.delete(id);
                  connectionsRef.current.get(id)?.close();
                  connectionsRef.current.delete(id);
                }
              }
              updateParticipants();
            });
          }
        });

        // Answer incoming calls
        peer.on('call', (call: any) => {
          if (stream) {
            call.answer(stream);
          } else {
            // Answer with empty audio/video if local media isn't available
            call.answer();
          }

          const remotePeerId = call.peer;

          call.on('stream', (remoteStream: MediaStream) => {
            if (isFirebaseConfigured && db && roomId) {
              const snapRef = ref(db, `rooms/${roomId}/participants/${remotePeerId}`);
              onValue(
                snapRef,
                (snap) => {
                  const data = snap.val();
                  participantsRef.current.set(remotePeerId, {
                    id: remotePeerId,
                    name: data?.name || 'Study Buddy',
                    stream: remoteStream,
                    muted: data?.muted ?? true,
                    cameraOff: data?.cameraOff ?? false,
                    goal: data?.goal || '',
                  });
                  updateParticipants();
                },
                { onlyOnce: true }
              );
            } else {
              participantsRef.current.set(remotePeerId, {
                id: remotePeerId,
                name: 'Study Buddy',
                stream: remoteStream,
                muted: true,
                cameraOff: false,
                goal: '',
              });
              updateParticipants();
            }

            connectionsRef.current.set(remotePeerId, call);
          });

          call.on('close', () => {
            participantsRef.current.delete(remotePeerId);
            connectionsRef.current.delete(remotePeerId);
            updateParticipants();
          });
        });

        peer.on('error', (err: any) => {
          console.warn('PeerJS event:', err.type, err.message);
        });
      } catch (err) {
        console.error('Failed to load PeerJS:', err);
      }
    },
    [roomId, displayName, initialGoal, updateParticipants]
  );

  useEffect(() => {
    if (!roomId) return;
    let active = true;

    initMedia().then((stream) => {
      if (!active) return;
      initPeer(stream);
    });

    return () => {
      active = false;
    };
  }, [roomId, initMedia, initPeer]);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const newMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !newMuted;
    });
    setIsMuted(newMuted);

    if (isFirebaseConfigured && db && roomId && myPeerId) {
      set(ref(db, `rooms/${roomId}/participants/${myPeerId}/muted`), newMuted).catch(console.warn);
    }
  }, [isMuted, roomId, myPeerId]);

  // Toggle Camera
  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const newCameraOff = !isCameraOff;
    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = !newCameraOff;
    });
    setIsCameraOff(newCameraOff);

    if (isFirebaseConfigured && db && roomId && myPeerId) {
      set(ref(db, `rooms/${roomId}/participants/${myPeerId}/cameraOff`), newCameraOff).catch(console.warn);
    }
  }, [isCameraOff, roomId, myPeerId]);

  // Toggle Screen Sharing
  const toggleScreenShare = useCallback(async () => {
    if (!isScreenSharing) {
      try {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          alert('Screen sharing is not supported by your browser.');
          return;
        }

        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        const screenVideoTrack = screenStream.getVideoTracks()[0];

        // Replace track across all peer connections
        for (const conn of connectionsRef.current.values()) {
          const pc = conn.peerConnection as RTCPeerConnection;
          if (pc) {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              await sender.replaceTrack(screenVideoTrack);
            }
          }
        }

        // Update local preview
        if (localStreamRef.current) {
          const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldVideoTrack) {
            localStreamRef.current.removeTrack(oldVideoTrack);
          }
          localStreamRef.current.addTrack(screenVideoTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }

        setIsScreenSharing(true);

        // When user stops screen sharing via browser native bar
        screenVideoTrack.onended = async () => {
          await revertToCamera();
        };
      } catch (err: any) {
        if (err.name !== 'NotAllowedError') {
          console.error('Screen sharing error:', err);
        }
      }
    } else {
      await revertToCamera();
    }
  }, [isScreenSharing]);

  const revertToCamera = async () => {
    try {
      let camTrack = originalCamTrackRef.current;
      if (!camTrack || camTrack.readyState === 'ended') {
        const freshStream = await navigator.mediaDevices.getUserMedia({ video: true });
        camTrack = freshStream.getVideoTracks()[0];
        originalCamTrackRef.current = camTrack;
      }

      // Replace track on all peer connections
      for (const conn of connectionsRef.current.values()) {
        const pc = conn.peerConnection as RTCPeerConnection;
        if (pc) {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender && camTrack) {
            await sender.replaceTrack(camTrack);
          }
        }
      }

      // Update local preview
      if (localStreamRef.current && camTrack) {
        const currentTracks = localStreamRef.current.getVideoTracks();
        currentTracks.forEach((t) => localStreamRef.current?.removeTrack(t));
        localStreamRef.current.addTrack(camTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }

      setIsScreenSharing(false);
    } catch (e) {
      console.warn('Reverting to camera stream error:', e);
      setIsScreenSharing(false);
    }
  };

  // Set active goal
  const setGoal = useCallback(
    (goalText: string) => {
      setMyGoal(goalText);
      if (isFirebaseConfigured && db && roomId && myPeerId) {
        set(ref(db, `rooms/${roomId}/participants/${myPeerId}/goal`), goalText).catch(console.warn);
      }
    },
    [roomId, myPeerId]
  );

  // Leave Room
  const leaveRoom = useCallback(() => {
    if (isFirebaseConfigured && db && roomId && myPeerId) {
      remove(ref(db, `rooms/${roomId}/participants/${myPeerId}`)).catch(console.warn);
    }

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    connectionsRef.current.forEach((conn) => conn.close());
    connectionsRef.current.clear();
    participantsRef.current.clear();
    setParticipants(new Map());
  }, [roomId, myPeerId]);

  return {
    localStream,
    participants,
    myPeerId,
    isMuted,
    isCameraOff,
    isScreenSharing,
    mediaError,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    leaveRoom,
    setGoal,
    myGoal,
  };
}
