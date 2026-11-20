'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { ref, set, update, onValue, remove, onDisconnect } from 'firebase/database';

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
  roomSyncError: string | null;
  isRequestingMedia: boolean;
  retryMedia: () => Promise<MediaStream | null>;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => Promise<void>;
  leaveRoom: () => void;
  setGoal: (goal: string) => void;
  myGoal: string;
}

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280, max: 1920 },
  height: { ideal: 720, max: 1080 },
  facingMode: 'user',
};

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
};

function describeMediaError(errors: unknown[]): string {
  const names = errors
    .map((error) => (error as { name?: string } | null)?.name)
    .filter((name): name is string => Boolean(name));

  if (names.includes('NotAllowedError') || names.includes('SecurityError')) {
    return 'Camera or microphone access is blocked. Click the site controls icon beside the address bar, allow Camera and Microphone, then try again. If they are already allowed, check your device privacy settings.';
  }
  if (names.includes('NotFoundError')) {
    return 'No camera or microphone was found. Connect a device, then try again.';
  }
  if (names.includes('NotReadableError') || names.includes('TrackStartError')) {
    return 'The camera or microphone is busy in another app. Close other apps using it, then try again.';
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Camera and microphone access needs a secure HTTPS page. Open the room using its HTTPS link.';
  }
  return 'Could not start the camera or microphone. Check site permissions and close other apps using the device, then try again.';
}

export function useWebRTC(roomId: string, displayName: string, initialGoal: string = ''): UseWebRTCReturn {
  const localStreamRef = useRef<MediaStream | null>(null);
  const originalCamTrackRef = useRef<MediaStreamTrack | null>(null);
  const peerRef = useRef<any>(null);
  const myPeerIdRef = useRef('');
  const displayNameRef = useRef(displayName);
  const initialGoalRef = useRef(initialGoal);
  const mediaRequestRef = useRef<Promise<{ stream: MediaStream | null; changed: boolean }> | null>(null);
  const peerRestartRef = useRef<Promise<void> | null>(null);
  const participantUnsubscribeRef = useRef<(() => void) | null>(null);
  const connectionsRef = useRef<Map<string, any>>(new Map());
  const participantsRef = useRef<Map<string, Participant>>(new Map());

  displayNameRef.current = displayName;
  initialGoalRef.current = initialGoal;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [myPeerId, setMyPeerId] = useState('');
  const [isMuted, setIsMuted] = useState(true);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [roomSyncError, setRoomSyncError] = useState<string | null>(null);
  const [isRequestingMedia, setIsRequestingMedia] = useState(false);
  const [myGoal, setMyGoal] = useState(initialGoal);

  const updateParticipants = useCallback(() => {
    setParticipants(new Map(participantsRef.current));
  }, []);

  // Initialize camera and mic
  const initMedia = useCallback(async (): Promise<MediaStream | null> => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMediaError('Camera and microphone are not available in this browser. Open this room in a supported browser over HTTPS.');
      return null;
    }

    setMediaError(null);

    const useStream = (stream: MediaStream, errorMessage: string | null = null) => {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });

      const videoTrack = stream.getVideoTracks()[0] ?? null;
      localStreamRef.current = stream;
      originalCamTrackRef.current = videoTrack;
      setLocalStream(stream);
      setIsMuted(true);
      setIsCameraOff(!videoTrack);
      setMediaError(errorMessage);
      return stream;
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: VIDEO_CONSTRAINTS,
        audio: AUDIO_CONSTRAINTS,
      });
      return useStream(stream);
    } catch (err: any) {
      console.warn('getUserMedia error:', err);
      let videoError: unknown = null;
      try {
        const videoOnly = await navigator.mediaDevices.getUserMedia({ video: true });
        return useStream(videoOnly, 'Camera is available, but the microphone could not be opened. Allow microphone access and retry.');
      } catch (fallbackError) {
        videoError = fallbackError;
      }

      let audioError: unknown = null;
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
        return useStream(audioOnly, 'Microphone is available, but the camera could not be opened. Allow camera access and retry.');
      } catch (fallbackError) {
        audioError = fallbackError;
      }

      setMediaError(describeMediaError([err, videoError, audioError]));
      return null;
    }
  }, []);

  // Initialize PeerJS mesh
  const initPeer = useCallback(
    async () => {
      if (typeof window === 'undefined') return;

      try {
        const { Peer } = await import('peerjs');
        if (peerRef.current) return;

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
          myPeerIdRef.current = peerId;
          setMyPeerId(peerId);

          if (isFirebaseConfigured && db && roomId) {
            const myRef = ref(db, `rooms/${roomId}/participants/${peerId}`);
            const localStream = localStreamRef.current;
            set(myRef, {
              name: displayNameRef.current || 'Anonymous',
              muted: localStream?.getAudioTracks().every((track) => !track.enabled) ?? true,
              cameraOff: !localStream?.getVideoTracks().some((track) => track.readyState === 'live' && track.enabled),
              hasMedia: Boolean(localStream?.getTracks().some((track) => track.readyState === 'live')),
              goal: initialGoalRef.current || '',
              joinedAt: Date.now(),
            }).catch((error) => {
              console.warn('Could not register room participant:', error);
              setRoomSyncError('Firebase denied access to this room. Its Realtime Database rules must allow reads and writes under /rooms.');
            });

            // Clean up upon connection drop
            onDisconnect(myRef).remove().catch((error) => {
              console.warn('Could not register participant cleanup:', error);
            });

            // Listen for other room participants
            const participantsDbRef = ref(db, `rooms/${roomId}/participants`);
            participantUnsubscribeRef.current = onValue(participantsDbRef, (snapshot) => {
              setRoomSyncError(null);
              const data = snapshot.val() || {};
              const remoteIds = Object.keys(data).filter((id) => id !== peerId);
              const currentStream = localStreamRef.current;
              const localHasMedia = Boolean(currentStream?.getTracks().some((track) => track.readyState === 'live'));

              // Connect to any new peers
              remoteIds.forEach((remoteId) => {
                const remoteParticipant = data[remoteId] || {};
                const remoteHasMedia = remoteParticipant.hasMedia !== false;
                const shouldInitiate = localHasMedia && (!remoteHasMedia || peerId < remoteId);

                if (!participantsRef.current.has(remoteId)) {
                  participantsRef.current.set(remoteId, {
                    id: remoteId,
                    name: remoteParticipant.name || 'Study Buddy',
                    stream: null,
                    muted: remoteParticipant.muted ?? true,
                    cameraOff: remoteParticipant.cameraOff ?? !remoteHasMedia,
                    goal: remoteParticipant.goal || '',
                  });
                }

                if (!connectionsRef.current.has(remoteId) && currentStream && shouldInitiate) {
                  try {
                    const call = peer.call(remoteId, currentStream);
                    if (call) {
                      connectionsRef.current.set(remoteId, call);

                      call.on('stream', (remoteStream: MediaStream) => {
                        if (connectionsRef.current.get(remoteId) !== call) return;
                        participantsRef.current.set(remoteId, {
                          id: remoteId,
                          name: remoteParticipant.name || 'Study Buddy',
                          stream: remoteStream,
                          muted: remoteParticipant.muted ?? true,
                          cameraOff: remoteParticipant.cameraOff ?? false,
                          goal: remoteParticipant.goal || '',
                        });
                        updateParticipants();
                      });

                      call.on('close', () => {
                        if (connectionsRef.current.get(remoteId) !== call) return;
                        participantsRef.current.delete(remoteId);
                        connectionsRef.current.delete(remoteId);
                        updateParticipants();
                      });

                      call.on('error', (callErr: any) => {
                        console.warn('Call error with peer:', remoteId, callErr);
                        if (connectionsRef.current.get(remoteId) !== call) return;
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
                    name: remoteParticipant.name || existing.name,
                    muted: remoteParticipant.muted ?? existing.muted,
                    cameraOff: remoteParticipant.cameraOff ?? existing.cameraOff,
                    goal: remoteParticipant.goal ?? existing.goal,
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
            }, (error) => {
              console.warn('Room participant read failed:', error);
              setRoomSyncError('Firebase denied access to this room. Its Realtime Database rules must allow reads and writes under /rooms.');
            });
          }
        });

        // Answer incoming calls
        peer.on('call', (call: any) => {
          const remotePeerId = call.peer;
          const previousConnection = connectionsRef.current.get(remotePeerId);
          if (previousConnection && previousConnection !== call) {
            call.close();
            return;
          }
          connectionsRef.current.set(remotePeerId, call);

          call.on('stream', (remoteStream: MediaStream) => {
            if (connectionsRef.current.get(remotePeerId) !== call) return;
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
            if (connectionsRef.current.get(remotePeerId) !== call) return;
            participantsRef.current.delete(remotePeerId);
            connectionsRef.current.delete(remotePeerId);
            updateParticipants();
          });

          call.on('error', (callError: any) => {
            console.warn('Incoming call failed:', remotePeerId, callError);
            if (connectionsRef.current.get(remotePeerId) !== call) return;
            participantsRef.current.delete(remotePeerId);
            connectionsRef.current.delete(remotePeerId);
            updateParticipants();
          });

          const currentStream = localStreamRef.current;
          if (currentStream) {
            call.answer(currentStream);
          } else {
            // Keep the room participant visible even when this device has no local media.
            call.answer();
          }
        });

        peer.on('error', (err: any) => {
          console.warn('PeerJS event:', err.type, err.message);
        });
      } catch (err) {
        console.error('Failed to load PeerJS:', err);
      }
    },
    [roomId, updateParticipants]
  );

  const restartPeerWithCurrentMedia = useCallback(async () => {
    let restart = peerRestartRef.current;
    if (!restart) {
      restart = (async () => {
        const oldPeerId = myPeerIdRef.current;
        const oldPeer = peerRef.current;

        participantUnsubscribeRef.current?.();
        participantUnsubscribeRef.current = null;

        if (oldPeerId && isFirebaseConfigured && db && roomId) {
          await remove(ref(db, `rooms/${roomId}/participants/${oldPeerId}`)).catch(console.warn);
        }

        peerRef.current = null;
        myPeerIdRef.current = '';
        setMyPeerId('');
        oldPeer?.destroy();

        connectionsRef.current.forEach((connection) => connection.close());
        connectionsRef.current.clear();
        participantsRef.current.clear();
        updateParticipants();

        await initPeer();
      })();
      peerRestartRef.current = restart;
    }

    try {
      await restart;
    } finally {
      if (peerRestartRef.current === restart) peerRestartRef.current = null;
    }
  }, [initPeer, roomId, updateParticipants]);

  const requestMedia = useCallback(async (unmuteAudio = false, restartPeerOnChange = false): Promise<MediaStream | null> => {
    let pending = mediaRequestRef.current;

    if (!pending) {
      setIsRequestingMedia(true);
      setMediaError(null);
      pending = (async () => {
        const existingStream = localStreamRef.current;
        if (!existingStream) {
          const stream = await initMedia();
          return { stream, changed: Boolean(stream) };
        }

        const needsVideo = !existingStream.getVideoTracks().some((track) => track.readyState === 'live');
        const needsAudio = !existingStream.getAudioTracks().some((track) => track.readyState === 'live');
        if (!needsVideo && !needsAudio) return { stream: existingStream, changed: false };

        if (!navigator.mediaDevices?.getUserMedia) {
          setMediaError(describeMediaError([]));
          return { stream: existingStream, changed: false };
        }

        try {
          const additionalStream = await navigator.mediaDevices.getUserMedia({
            video: needsVideo ? VIDEO_CONSTRAINTS : false,
            audio: needsAudio ? AUDIO_CONSTRAINTS : false,
          });

          const additionalTracks = additionalStream.getTracks();
          additionalTracks.forEach((track) => {
            if (track.kind === 'audio') track.enabled = false;
            if (track.kind === 'video') originalCamTrackRef.current = track;
            existingStream.addTrack(track);
          });

          localStreamRef.current = existingStream;
          setLocalStream(new MediaStream(existingStream.getTracks()));
          setIsCameraOff(!existingStream.getVideoTracks().some((track) => track.readyState === 'live'));
          setIsMuted(existingStream.getAudioTracks().every((track) => !track.enabled));
          setMediaError(null);
          return { stream: existingStream, changed: additionalTracks.length > 0 };
        } catch (error) {
          setMediaError(describeMediaError([error]));
          return { stream: existingStream, changed: false };
        }
      })();

      mediaRequestRef.current = pending;
    }

    try {
      const { stream, changed } = await pending;
      if (!stream) {
        if (!peerRef.current) await initPeer();
        return null;
      }

      const audioTracks = stream.getAudioTracks();
      if (unmuteAudio && audioTracks.length > 0) {
        audioTracks.forEach((track) => {
          track.enabled = true;
        });
        setIsMuted(false);
      }

      if (restartPeerOnChange && changed && peerRef.current) {
        await restartPeerWithCurrentMedia();
      } else if (!peerRef.current) {
        await initPeer();
      }

      return stream;
    } finally {
      if (mediaRequestRef.current === pending) {
        mediaRequestRef.current = null;
        setIsRequestingMedia(false);
      }
    }
  }, [initMedia, initPeer, restartPeerWithCurrentMedia]);

  const retryMedia = useCallback(() => requestMedia(false, true), [requestMedia]);

  useEffect(() => {
    if (!roomId || !displayName) return;
    void requestMedia();
  }, [roomId, displayName, requestMedia]);

  useEffect(() => {
    const peerId = myPeerIdRef.current;
    if (!peerId || !isFirebaseConfigured || !db || !roomId) return;

    update(ref(db, `rooms/${roomId}/participants/${peerId}`), {
      name: displayName || 'Anonymous',
      goal: initialGoal || '',
    }).catch(console.warn);
  }, [displayName, initialGoal, myPeerId, roomId]);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    const audioTracks = localStreamRef.current?.getAudioTracks().filter((track) => track.readyState === 'live') ?? [];
    if (audioTracks.length === 0) {
      void requestMedia(true, true);
      return;
    }
    const newMuted = !isMuted;
    audioTracks.forEach((track) => {
      track.enabled = !newMuted;
    });
    setIsMuted(newMuted);

    if (isFirebaseConfigured && db && roomId && myPeerId) {
      set(ref(db, `rooms/${roomId}/participants/${myPeerId}/muted`), newMuted).catch(console.warn);
    }
  }, [isMuted, roomId, myPeerId, requestMedia]);

  // Toggle Camera
  const toggleCamera = useCallback(() => {
    const videoTracks = localStreamRef.current?.getVideoTracks().filter((track) => track.readyState === 'live') ?? [];
    if (videoTracks.length === 0) {
      void requestMedia(false, true);
      return;
    }
    const newCameraOff = !isCameraOff;
    videoTracks.forEach((track) => {
      track.enabled = !newCameraOff;
    });
    setIsCameraOff(newCameraOff);

    if (isFirebaseConfigured && db && roomId && myPeerId) {
      set(ref(db, `rooms/${roomId}/participants/${myPeerId}/cameraOff`), newCameraOff).catch(console.warn);
    }
  }, [isCameraOff, roomId, myPeerId, requestMedia]);

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
      participantUnsubscribeRef.current?.();
      participantUnsubscribeRef.current = null;
      peerRef.current.destroy();
      peerRef.current = null;
    }
    myPeerIdRef.current = '';
    setMyPeerId('');

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
    roomSyncError,
    isRequestingMedia,
    retryMedia,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    leaveRoom,
    setGoal,
    myGoal,
  };
}
