import api from "./axios";

// Get meetings hosted by the logged-in user.
export async function getMeetings() {
  const response = await api.get("/meetings");
  return response.data;
}

// Get scheduled meetings.
export async function getScheduledMeetings() {
  const response = await api.get("/meetings/schedules");
  return response.data;
}

// Create a new meeting.
export async function createMeeting(meetingData = {}) {
  const response = await api.post("/meetings", meetingData);
  return response.data;
}

// Join an existing meeting using its code.
export async function joinMeeting(meetingCode) {
  const response = await api.post("/meetings/join", {
    meetingCode: meetingCode.trim().toLowerCase(),
  });

  return response.data;
}

// Get details of a particular meeting.
export async function getMeetingById(meetingId) {
  const response = await api.get(`/meetings/${encodeURIComponent(meetingId)}`);

  return response.data;
}

// Start a scheduled meeting.
export async function startMeeting(meetingId) {
  const response = await api.patch(
    `/meetings/${encodeURIComponent(meetingId)}/start`,
  );

  return response.data;
}

// End a meeting.
export async function endMeeting(meetingId) {
  const response = await api.patch(
    `/meetings/${encodeURIComponent(meetingId)}/end`,
  );

  return response.data;
}

// Cancel a meeting.
export async function cancelMeeting(meetingId) {
  const response = await api.patch(
    `/meetings/${encodeURIComponent(meetingId)}/cancel`,
  );

  return response.data;
}

// Leave a meeting.
export async function leaveMeeting(meetingId) {
  const response = await api.post(
    `/meetings/${encodeURIComponent(meetingId)}/leave`,
  );

  return response.data;
}
