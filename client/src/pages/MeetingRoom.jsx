import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  LoaderCircle,
  Mic,
  MicOff,
  PhoneOff,
  Users,
  Video,
  VideoOff,
} from "lucide-react";

import { createMeetingSocket } from "../services/socket";
import { getMeetingById, leaveMeeting } from "../services/api/meetingService";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

function emitWithAck(socket, eventName, payload) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error("Socket is not connected."));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error(`${eventName} timed out. Please try again.`));
    }, 10000);

    socket.emit(eventName, payload, (response) => {
      clearTimeout(timeout);

      if (!response) {
        reject(new Error("The server did not return a response."));
        return;
      }

      if (response.success === false) {
        reject(new Error(response.message || "Request failed."));
        return;
      }

      resolve(response);
    });
  });
}

export default function MeetingRoom() {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  const localVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const iceQueuesRef = useRef(new Map());
  const remoteUsersRef = useRef(new Map());
  const mountedRef = useRef(false);

  const [meeting, setMeeting] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteTiles, setRemoteTiles] = useState([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");

  const cleanupResources = useCallback(() => {
    const socket = socketRef.current;

    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    }

    for (const pc of peerConnectionsRef.current.values()) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.close();
    }

    peerConnectionsRef.current.clear();
    iceQueuesRef.current.clear();
    remoteUsersRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteTiles([]);
  }, []);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    mountedRef.current = true;
    let disposed = false;

    async function initializeMeeting() {
      try {
        setLoading(true);
        setError("");

        const response = await getMeetingById(meetingId);
        const meetingData =
          response?.data?.meeting ??
          response?.meeting ??
          response?.data ??
          null;

        if (!meetingData) {
          throw new Error("Meeting details could not be loaded.");
        }

        if (!disposed) {
          setMeeting(meetingData);
        }

        let stream;

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });
          } catch {
            throw new Error(
              "Camera/microphone access failed. Allow browser permissions and try again.",
            );
          }
        }

        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);
        setMicEnabled(stream.getAudioTracks().some((track) => track.enabled));
        setCameraEnabled(
          stream.getVideoTracks().some((track) => track.enabled),
        );

        const socket = createMeetingSocket();
        socketRef.current = socket;

        function getPeerConnection(socketId, user = {}) {
          if (!socketId || socketId === socket.id) {
            return null;
          }

          if (peerConnectionsRef.current.has(socketId)) {
            return peerConnectionsRef.current.get(socketId);
          }

          const pc = new RTCPeerConnection(ICE_SERVERS);

          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
              pc.addTrack(track, localStreamRef.current);
            });
          }

          remoteUsersRef.current.set(socketId, {
            socketId,
            user,
            stream: remoteUsersRef.current.get(socketId)?.stream ?? null,
          });

          pc.onicecandidate = (event) => {
            if (event.candidate && socket.connected) {
              socket.emit("webrtc:ice-candidate", {
                meetingId,
                targetSocketId: socketId,
                candidate: event.candidate,
              });
            }
          };

          pc.ontrack = (event) => {
            const existing = remoteUsersRef.current.get(socketId) || {
              socketId,
              user,
              stream: null,
            };

            let remoteStream = event.streams?.[0];

            if (!remoteStream) {
              remoteStream = existing.stream || new MediaStream();
              const alreadyAdded = remoteStream
                .getTracks()
                .some((track) => track.id === event.track.id);

              if (!alreadyAdded) {
                remoteStream.addTrack(event.track);
              }
            }

            const updated = {
              ...existing,
              user: existing.user?.username ? existing.user : user,
              stream: remoteStream,
            };

            remoteUsersRef.current.set(socketId, updated);

            if (!disposed) {
              setRemoteTiles(Array.from(remoteUsersRef.current.values()));
            }
          };

          pc.onconnectionstatechange = () => {
            if (
              pc.connectionState === "failed" ||
              pc.connectionState === "closed"
            ) {
              pc.close();
              peerConnectionsRef.current.delete(socketId);
              iceQueuesRef.current.delete(socketId);
            }
          };

          peerConnectionsRef.current.set(socketId, pc);
          return pc;
        }

        async function flushIceQueue(socketId, pc) {
          const queue = iceQueuesRef.current.get(socketId) || [];

          for (const candidate of queue) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (iceError) {
              console.error("Unable to add queued ICE candidate:", iceError);
            }
          }

          iceQueuesRef.current.delete(socketId);
        }

        async function createOfferFor(socketId, user) {
          if (!socket.id || socket.id.localeCompare(socketId) >= 0) {
            return;
          }

          const pc = getPeerConnection(socketId, user);
          if (!pc || pc.signalingState !== "stable") return;

          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            socket.emit("webrtc:offer", {
              meetingId,
              targetSocketId: socketId,
              offer: pc.localDescription,
            });
          } catch (offerError) {
            console.error("Unable to create WebRTC offer:", offerError);
          }
        }

        socket.on("connect_error", (socketError) => {
          if (!disposed) {
            setError(
              socketError.message || "Unable to connect to the meeting server.",
            );
          }
        });

        socket.on("meeting:error", (payload) => {
          if (!disposed) {
            setError(payload?.message || "A meeting error occurred.");
          }
        });

        socket.on("meeting:participant-joined", (payload) => {
          const socketId = payload?.socketId;
          const user = payload?.user || {};

          if (socketId && socketId !== socket.id) {
            void createOfferFor(socketId, user);
          }
        });

        socket.on("meeting:participant-left", (payload) => {
          const socketId = payload?.socketId ?? payload?.leftSocketId ?? null;

          if (socketId) {
            peerConnectionsRef.current.get(socketId)?.close();
            peerConnectionsRef.current.delete(socketId);
            iceQueuesRef.current.delete(socketId);
            remoteUsersRef.current.delete(socketId);

            if (!disposed) {
              setRemoteTiles(Array.from(remoteUsersRef.current.values()));
            }
          }
        });

        socket.on("webrtc:offer", async (payload) => {
          const { fromSocketId, fromUser, offer } = payload || {};
          if (!fromSocketId || !offer || disposed) return;

          try {
            const pc = getPeerConnection(fromSocketId, fromUser);

            if (!pc) return;

            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            await flushIceQueue(fromSocketId, pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.emit("webrtc:answer", {
              meetingId,
              targetSocketId: fromSocketId,
              answer: pc.localDescription,
            });
          } catch (offerError) {
            console.error("Unable to process WebRTC offer:", offerError);
          }
        });

        socket.on("webrtc:answer", async (payload) => {
          const { fromSocketId, answer } = payload || {};
          const pc = peerConnectionsRef.current.get(fromSocketId);

          if (!pc || !answer || disposed) return;

          try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            await flushIceQueue(fromSocketId, pc);
          } catch (answerError) {
            console.error("Unable to process WebRTC answer:", answerError);
          }
        });

        socket.on("webrtc:ice-candidate", async (payload) => {
          const { fromSocketId, candidate } = payload || {};
          if (!fromSocketId || !candidate || disposed) return;

          const pc = peerConnectionsRef.current.get(fromSocketId);

          if (!pc || !pc.remoteDescription) {
            const queue = iceQueuesRef.current.get(fromSocketId) || [];
            queue.push(candidate);
            iceQueuesRef.current.set(fromSocketId, queue);
            return;
          }

          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (iceError) {
            console.error("Unable to add ICE candidate:", iceError);
          }
        });

        socket.connect();

        await new Promise((resolve, reject) => {
          if (socket.connected) {
            resolve();
            return;
          }

          const timeout = setTimeout(() => {
            reject(new Error("Connection timed out. Please try again."));
          }, 10000);

          socket.once("connect", () => {
            clearTimeout(timeout);
            resolve();
          });

          socket.once("connect_error", (socketError) => {
            clearTimeout(timeout);
            reject(socketError);
          });
        });

        if (disposed) return;

        await emitWithAck(socket, "meeting:join", { meetingId });

        const participantsResponse = await emitWithAck(
          socket,
          "meeting:participants:list",
          { meetingId },
        );

        const connections =
          participantsResponse?.data?.connections ||
          participantsResponse?.connections ||
          [];

        for (const participant of connections) {
          if (participant.socketId && participant.socketId !== socket.id) {
            remoteUsersRef.current.set(participant.socketId, {
              socketId: participant.socketId,
              user: participant,
              stream: null,
            });

            await createOfferFor(participant.socketId, participant);
          }
        }

        if (!disposed) {
          setRemoteTiles(Array.from(remoteUsersRef.current.values()));
        }
      } catch (initializeError) {
        if (!disposed) {
          setError(
            initializeError.response?.data?.message ||
              initializeError.message ||
              "Unable to enter the meeting room.",
          );
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    if (!meetingId) {
      setError("Meeting ID is missing.");
      setLoading(false);
    } else {
      void initializeMeeting();
    }

    return () => {
      disposed = true;
      mountedRef.current = false;
      cleanupResources();
    };
  }, [meetingId, cleanupResources]);

  async function handleLeave() {
    if (leaving) return;

    setLeaving(true);

    try {
      if (socketRef.current?.connected) {
        socketRef.current.emit("meeting:leave", { meetingId });
      }

      await leaveMeeting(meetingId);
    } catch (leaveError) {
      console.error("Unable to register meeting leave:", leaveError);
    } finally {
      cleanupResources();
      navigate("/meetings");
    }
  }

  function toggleMicrophone() {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    if (!tracks.length) return;

    const nextEnabled = !tracks[0].enabled;
    tracks.forEach((track) => {
      track.enabled = nextEnabled;
    });
    setMicEnabled(nextEnabled);

    socketRef.current?.emit("meeting:media:status", {
      meetingId,
      micEnabled: nextEnabled,
      cameraEnabled,
    });
  }

  function toggleCamera() {
    const tracks = localStreamRef.current?.getVideoTracks() || [];
    if (!tracks.length) return;

    const nextEnabled = !tracks[0].enabled;
    tracks.forEach((track) => {
      track.enabled = nextEnabled;
    });
    setCameraEnabled(nextEnabled);

    socketRef.current?.emit("meeting:media:status", {
      meetingId,
      micEnabled,
      cameraEnabled: nextEnabled,
    });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3">
          <LoaderCircle className="animate-spin" size={24} />
          <span>Connecting to meeting...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {meeting?.title || meeting?.name || "Meeting Room"}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Meeting ID: {meetingId}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-sm">
            <Users size={17} />
            <span>{remoteTiles.length + 1} participant(s)</span>
          </div>
        </header>

        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <span>{error}</span>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />

            {!cameraEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-slate-300">
                <VideoOff size={42} />
              </div>
            )}

            <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-3 py-1.5 text-sm">
              You
            </div>
          </div>

          {remoteTiles.map((peer) => (
            <RemoteVideoTile key={peer.socketId} peer={peer} />
          ))}
        </section>

        {remoteTiles.length === 0 && (
          <p className="mt-5 text-center text-sm text-slate-400">
            Waiting for other participants to connect...
          </p>
        )}

        <footer className="fixed inset-x-0 bottom-0 flex justify-center gap-3 border-t border-slate-800 bg-slate-950/95 px-4 py-5">
          <button
            type="button"
            onClick={toggleMicrophone}
            disabled={!localStream?.getAudioTracks().length}
            className={`flex items-center gap-2 rounded-full px-5 py-3 font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              micEnabled
                ? "bg-slate-800 hover:bg-slate-700"
                : "bg-red-600 hover:bg-red-500"
            }`}
          >
            {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            <span className="hidden sm:inline">
              {micEnabled ? "Mute" : "Unmute"}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleCamera}
            disabled={!localStream?.getVideoTracks().length}
            className={`flex items-center gap-2 rounded-full px-5 py-3 font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              cameraEnabled
                ? "bg-slate-800 hover:bg-slate-700"
                : "bg-red-600 hover:bg-red-500"
            }`}
          >
            {cameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
            <span className="hidden sm:inline">
              {cameraEnabled ? "Turn camera off" : "Turn camera on"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleLeave}
            disabled={leaving}
            className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 font-semibold transition hover:bg-red-500 disabled:opacity-50"
          >
            {leaving ? (
              <LoaderCircle className="animate-spin" size={20} />
            ) : (
              <PhoneOff size={20} />
            )}
            <span>Leave</span>
          </button>
        </footer>

        <div className="h-24" />
      </div>
    </main>
  );
}

function RemoteVideoTile({ peer }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = peer.stream || null;
    }
  }, [peer.stream]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="h-full w-full object-cover"
      />

      {!peer.stream && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          <Users size={38} />
        </div>
      )}

      <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-3 py-1.5 text-sm">
        {peer.user?.fullName || peer.user?.username || "Participant"}
      </div>
    </div>
  );
}
