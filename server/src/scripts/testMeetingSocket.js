import { io } from "socket.io-client";

const serverUrl = process.env.SOCKET_SERVER_URL || "http://localhost:5000";
const meetingId = process.env.TEST_MEETING_ID;
const hostCookie = process.env.HOST_ACCESS_COOKIE;
const participantCookie = process.env.PARTICIPANT_ACCESS_COOKIE;

if (!meetingId || !hostCookie || !participantCookie) {
  console.error(
    "Set TEST_MEETING_ID, HOST_ACCESS_COOKIE, and PARTICIPANT_ACCESS_COOKIE.",
  );
  process.exit(1);
}

function createSocket(cookie) {
  return io(serverUrl, {
    extraHeaders: {
      Cookie: `ms_access=${cookie}`,
    },
    transports: ["websocket"],
    reconnection: false,
    timeout: 5000,
  });
}

function waitForConnection(socket, label) {
  return new Promise((resolve, reject) => {
    socket.once("connect", () => {
      console.log(`${label}: connected`);
      resolve();
    });

    socket.once("connect_error", (error) => {
      reject(new Error(`${label}: ${error.message}`));
    });
  });
}

function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(5000).emit(event, payload, (error, response) => {
      if (error) {
        reject(new Error(`${event}: acknowledgement timeout`));
        return;
      }

      if (!response?.success) {
        reject(new Error(response?.message || `${event} failed`));
        return;
      }

      resolve(response);
    });
  });
}

const host = createSocket(hostCookie);
const participant = createSocket(participantCookie);

try {
  await Promise.all([
    waitForConnection(host, "Host"),
    waitForConnection(participant, "Participant"),
  ]);

  participant.once("meeting:participant-joined", (payload) => {
    console.log("Participant joined event received:", payload.user.username);
  });

  console.log(
    "Host room join:",
    await emitAck(host, "meeting:join", { meetingId }),
  );

  console.log(
    "Participant room join:",
    await emitAck(participant, "meeting:join", { meetingId }),
  );

  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log(
    "Participant room leave:",
    await emitAck(participant, "meeting:leave", { meetingId }),
  );
} catch (error) {
  console.error("Socket test failed:", error.message);
  process.exitCode = 1;
} finally {
  host.disconnect();
  participant.disconnect();
}

