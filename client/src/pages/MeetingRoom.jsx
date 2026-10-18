import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  Check,
  Copy,
  LoaderCircle,
  Mic,
  MicOff,
  PhoneOff,
  ShieldCheck,
  Users,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
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

  const [meeting, setMeeting] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteTiles, setRemoteTiles] = useState([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [copied, setCopied] = useState(false);

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
      pc.onconnectionstatechange = null;
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
    setSocketConnected(false);
  }, []);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
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

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "Camera and microphone require HTTPS or localhost in a supported browser.",
          );
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

        function updateRemoteTiles() {
          if (!disposed) {
            setRemoteTiles(Array.from(remoteUsersRef.current.values()));
          }
        }

        function getPeerConnection(socketId, user = {}) {
          if (!socketId || socketId === socket.id) {
            return null;
          }

          if (peerConnectionsRef.current.has(socketId)) {
            const existing = remoteUsersRef.current.get(socketId);

            if (existing && user?.username) {
              remoteUsersRef.current.set(socketId, {
                ...existing,
                user,
              });
            }

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
            stream: null,
            connectionState: "new",
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

            remoteUsersRef.current.set(socketId, {
              ...existing,
              user: existing.user?.username ? existing.user : user,
              stream: remoteStream,
            });

            updateRemoteTiles();
          };

          pc.onconnectionstatechange = () => {
            const current = remoteUsersRef.current.get(socketId);

            if (current) {
              remoteUsersRef.current.set(socketId, {
                ...current,
                connectionState: pc.connectionState,
              });

              updateRemoteTiles();
            }

            if (
              pc.connectionState === "failed" ||
              pc.connectionState === "closed"
            ) {
              peerConnectionsRef.current.delete(socketId);
              iceQueuesRef.current.delete(socketId);

              if (pc.connectionState === "failed") {
                console.warn(
                  "WebRTC connection failed for participant:",
                  socketId,
                );
              }
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

        async function createOfferFor(socketId, user = {}) {
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

        socket.on("connect", () => {
          if (!disposed) {
            setSocketConnected(true);
            setError("");
          }
        });

        socket.on("disconnect", () => {
          if (!disposed) {
            setSocketConnected(false);
          }
        });

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
            updateRemoteTiles();
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
              connectionState: "new",
            });

            await createOfferFor(participant.socketId, participant);
          }
        }

        updateRemoteTiles();
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

  async function copyMeetingId() {
    try {
      await navigator.clipboard.writeText(meetingId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Unable to copy the meeting ID in this browser.");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080D18] px-4 text-white">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] px-10 py-12 shadow-2xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300">
            <LoaderCircle className="animate-spin" size={30} />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold">Joining your meeting</h2>
            <p className="mt-2 text-sm text-slate-400">
              Preparing your camera and connection...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080D18] pb-36 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/3 h-96 w-96 rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute bottom-20 right-0 h-80 w-80 rounded-full bg-blue-600/[0.07] blur-[110px]" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
              <Video size={23} />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                {meeting?.title || meeting?.name || "Meeting Room"}
              </h1>

              <button
                type="button"
                onClick={copyMeetingId}
                className="mt-1 flex max-w-full items-center gap-2 text-left text-xs text-slate-400 transition hover:text-indigo-300 sm:text-sm"
                title="Copy meeting ID"
              >
                <span className="truncate">Meeting ID: {meetingId}</span>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium sm:px-4 sm:text-sm ${
                socketConnected
                  ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300"
                  : "border-amber-400/20 bg-amber-400/[0.08] text-amber-300"
              }`}
            >
              {socketConnected ? <Wifi size={15} /> : <WifiOff size={15} />}
              {socketConnected ? "Connected" : "Connecting"}
            </div>

            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 sm:px-4 sm:text-sm">
              <Users size={16} className="text-indigo-300" />
              <span>{remoteTiles.length + 1}</span>
              <span className="hidden sm:inline">participants</span>
            </div>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.07] p-4 text-sm text-red-200"
          >
            <AlertCircle className="mt-0.5 shrink-0" size={19} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Connection notice</p>
              <p className="mt-1 break-words text-red-100/80">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              className="rounded-lg px-2 py-1 text-red-200 hover:bg-red-300/10"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200 sm:text-base">
              Live meeting
            </h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Your conversation, in one place.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span>Private meeting</span>
          </div>
        </div>

        <section
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
            remoteTiles.length > 1 ? "xl:grid-cols-3" : "xl:grid-cols-2"
          }`}
        >
          <div className="group relative aspect-video min-w-0 overflow-hidden rounded-2xl border border-indigo-400/20 bg-[#111827] shadow-[0_18px_60px_rgba(0,0,0,0.25)]">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`h-full w-full object-cover ${
                cameraEnabled ? "" : "invisible"
              }`}
            />

            {!cameraEnabled && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#182238] to-[#0C1220]">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-slate-300">
                  <VideoOff size={32} />
                </div>
                <span className="text-sm font-medium text-slate-300">
                  Camera is off
                </span>
              </div>
            )}

            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent" />

            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              You
            </div>

            <div className="absolute right-3 top-3 flex items-center gap-2">
              {!micEnabled && (
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/80 text-white backdrop-blur-md">
                  <MicOff size={16} />
                </span>
              )}
            </div>

            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-4 pt-12">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">You</p>
                <p className="mt-1 text-xs text-slate-300">
                  {micEnabled ? "Microphone on" : "Microphone muted"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-xs text-slate-200 backdrop-blur-md">
                <span
                  className={`h-2 w-2 rounded-full ${
                    socketConnected ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                {socketConnected ? "Online" : "Reconnecting"}
              </div>
            </div>
          </div>

          {remoteTiles.map((peer) => (
            <RemoteVideoTile key={peer.socketId} peer={peer} />
          ))}
        </section>

        {remoteTiles.length === 0 && (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400">
              <Users size={25} />
            </div>
            <h3 className="mt-4 font-semibold text-slate-200">
              Waiting for participants
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Share the meeting ID with your participants. Their video will
              appear here after they join and connect.
            </p>
          </div>
        )}
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-[#0A0F1B]/90 px-3 py-4 backdrop-blur-2xl sm:px-6 sm:py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-2.5 sm:gap-4">
          <ControlButton
            onClick={toggleMicrophone}
            disabled={!localStream?.getAudioTracks().length || leaving}
            active={micEnabled}
            label={micEnabled ? "Mute" : "Unmute"}
            icon={micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          />

          <ControlButton
            onClick={toggleCamera}
            disabled={!localStream?.getVideoTracks().length || leaving}
            active={cameraEnabled}
            label={cameraEnabled ? "Camera" : "Camera off"}
            icon={cameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          />

          <button
            type="button"
            onClick={handleLeave}
            disabled={leaving}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 text-sm font-semibold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F1B] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-14 sm:px-6"
          >
            {leaving ? (
              <LoaderCircle className="animate-spin" size={20} />
            ) : (
              <PhoneOff size={20} />
            )}
            <span className="hidden sm:inline">
              {leaving ? "Leaving..." : "Leave meeting"}
            </span>
            <span className="sm:hidden">Leave</span>
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-slate-500">
          MeetCBNK · Real-time video meeting
        </p>
      </footer>
    </main>
  );
}

function ControlButton({ onClick, disabled, active, label, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F1B] disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-14 sm:min-w-32 sm:px-5 ${
        active
          ? "border-white/10 bg-white/[0.06] text-slate-100 hover:bg-white/[0.11]"
          : "border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/20"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function RemoteVideoTile({ peer }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = peer.stream || null;

    if (peer.stream) {
      video.play().catch(() => {
        // Browser autoplay policies can block playback in some situations.
      });
    }

    return () => {
      video.srcObject = null;
    };
  }, [peer.stream]);

  const participantName =
    peer.user?.fullName || peer.user?.username || "Participant";

  const isConnected = peer.connectionState === "connected";

  return (
    <div className="group relative aspect-video min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#111827] shadow-[0_18px_60px_rgba(0,0,0,0.22)] transition hover:border-indigo-400/30">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`h-full w-full object-cover ${
          peer.stream ? "" : "invisible"
        }`}
      />

      {!peer.stream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#182238] to-[#0C1220]">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-300">
            <Users size={30} />
          </div>
          <span className="text-sm text-slate-400">Connecting video...</span>
        </div>
      )}

      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent" />

      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
        <span
          className={`h-2 w-2 rounded-full ${
            isConnected ? "bg-emerald-400" : "bg-amber-400"
          }`}
        />
        {isConnected ? "Connected" : "Connecting"}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-4 pt-12">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {participantName}
          </p>
          <p className="mt-1 text-xs text-slate-300">
            {peer.stream ? "In the meeting" : "Establishing connection"}
          </p>
        </div>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-slate-200 backdrop-blur-md">
          {isConnected ? (
            <Wifi size={16} />
          ) : (
            <LoaderCircle className="animate-spin" size={16} />
          )}
        </div>
      </div>
    </div>
  );
}
