import { useCallback, useEffect, useState } from "react";
import {
  Video,
  Plus,
  RefreshCw,
  CalendarDays,
  Copy,
  Play,
  Square,
  XCircle,
  ArrowRight,
  AlertCircle,
  Clock3,
  Users,
  CheckCircle2,
  X,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import {
  getMeetings,
  getScheduledMeetings,
  createMeeting,
  joinMeeting,
  startMeeting,
  endMeeting,
  cancelMeeting,
} from "../services/api/meetingService";

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}

function extractMeetings(response) {
  if (Array.isArray(response?.meetings)) return response.meetings;
  if (Array.isArray(response?.data?.meetings)) {
    return response.data.meetings;
  }
  if (Array.isArray(response?.schedules)) return response.schedules;
  if (Array.isArray(response?.data?.schedules)) {
    return response.data.schedules;
  }
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function getMeetingId(meeting) {
  return meeting?._id || meeting?.id;
}

function getScheduleMeeting(schedule) {
  if (schedule?.meeting && typeof schedule.meeting === "object") {
    return {
      ...schedule.meeting,
      title: schedule.meeting.title || schedule.title || "Scheduled meeting",
      scheduledAt: schedule.scheduledAt || schedule.meeting.scheduledAt || null,
      scheduleId: schedule.id || schedule._id,
    };
  }

  return schedule;
}

function formatDate(date) {
  if (!date) return "Not scheduled";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "Invalid date";

  return parsedDate.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [scheduled, setScheduled] = useState([]);

  const navigate = useNavigate();

  const [meetingCode, setMeetingCode] = useState("");
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("10");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [busyId, setBusyId] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createdMeeting, setCreatedMeeting] = useState(null);

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [meetingResponse, scheduledResponse] = await Promise.all([
        getMeetings(),
        getScheduledMeetings(),
      ]);

      setMeetings(extractMeetings(meetingResponse));
      setScheduled(extractMeetings(scheduledResponse).map(getScheduleMeeting));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setCreatedMeeting(null);

    const cleanTitle = title.trim();

    if (cleanTitle.length < 3) {
      setError("Meeting title must contain at least 3 characters.");
      return;
    }

    if (cleanTitle.length > 100) {
      setError("Meeting title cannot exceed 100 characters.");
      return;
    }

    const participantLimit = Number(maxParticipants);

    if (
      !Number.isInteger(participantLimit) ||
      participantLimit < 2 ||
      participantLimit > 10
    ) {
      setError("Participants limit must be between 2 and 10.");
      return;
    }

    let scheduleDate = null;

    if (scheduledAt) {
      const parsedDate = new Date(scheduledAt);

      if (Number.isNaN(parsedDate.getTime())) {
        setError("Please select a valid date and time.");
        return;
      }

      if (parsedDate.getTime() <= Date.now()) {
        setError("Scheduled date and time must be in the future.");
        return;
      }

      scheduleDate = parsedDate.toISOString();
    }

    setCreating(true);

    try {
      const payload = {
        title: cleanTitle,
        maxParticipants: participantLimit,
      };

      if (scheduleDate) {
        payload.scheduledAt = scheduleDate;
      }

      const response = await createMeeting(payload);
      const meeting =
        response?.meeting || response?.data?.meeting || response?.data;

      if (meeting?.meetingCode) {
        setCreatedMeeting(meeting);
        setNotice(response?.message || "Meeting created successfully.");
      } else {
        setNotice(response?.message || "Meeting created successfully.");
      }

      setTitle("");
      setScheduledAt("");
      setMaxParticipants("10");
      setShowCreateForm(false);

      await loadMeetings();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setCreatedMeeting(null);

    const code = meetingCode.trim().toLowerCase();

    if (!/^[a-f0-9]{12}$/.test(code)) {
      setError("Enter a valid 12-character meeting code.");
      return;
    }

    setJoining(true);

    const response = await joinMeeting(meetingCode);
    const meeting = response.meeting;

    if (!meeting?.id) {
      throw new Error("Meeting ID was not returned by the server.");
    }

    navigate(`/meetings/${meeting.id}/room`);

    try {
      const response = await joinMeeting(code);

      setNotice(
        response?.message || "Meeting join request accepted successfully.",
      );

      setMeetingCode("");
      await loadMeetings();

      // The join API does not create a video-call room UI.
      // Real-time meeting navigation can be added separately.
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setJoining(false);
    }
  }

  async function handleAction(meeting, action) {
    const id = getMeetingId(meeting);

    if (!id) {
      setError("This meeting does not have a valid ID.");
      return;
    }

    setBusyId(id);
    setError("");
    setNotice("");
    setCreatedMeeting(null);

    try {
      let response;

      if (action === "start") {
        response = await startMeeting(id);
      } else if (action === "end") {
        response = await endMeeting(id);
      } else if (action === "cancel") {
        response = await cancelMeeting(id);
      }

      setNotice(response?.message || `Meeting ${action} successful.`);

      await loadMeetings();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId("");
    }
  }

  async function copyCode(code) {
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      setError("");
      setNotice("Meeting code copied to clipboard.");
    } catch {
      setError(
        `Automatic copy failed. Please copy this code manually: ${code}`,
      );
    }
  }

  function renderMeetingCard(meeting, isScheduledCard = false) {
    const id = getMeetingId(meeting);
    const status = String(meeting?.status || "scheduled").toLowerCase();
    const code = meeting?.meetingCode;
    const isBusy = Boolean(id) && busyId === id;

    return (
      <article
        key={`${id || code || meeting?.scheduleId || meeting?.title}-${isScheduledCard ? "schedule" : "hosted"}`}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <Video size={21} />
            </span>

            <div className="min-w-0">
              <h3 className="break-words font-extrabold text-ink">
                {meeting?.title || meeting?.name || "Meeting"}
              </h3>

              <p className="mt-1 break-all text-xs text-slate-500">
                {code ? `Code: ${code}` : "Meeting code unavailable"}
              </p>
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold capitalize ${
              status === "live"
                ? "bg-green-100 text-green-700"
                : status === "ended"
                  ? "bg-slate-100 text-slate-600"
                  : status === "cancelled"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
            }`}
          >
            {status}
          </span>
        </div>

        {meeting?.scheduledAt && (
          <div className="mt-4 flex items-start gap-2 text-sm text-slate-600">
            <Clock3 size={16} className="mt-0.5 shrink-0 text-slate-400" />
            <span>{formatDate(meeting.scheduledAt)}</span>
          </div>
        )}

        {typeof meeting?.maxParticipants === "number" && (
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <Users size={16} />
            <span>Up to {meeting.maxParticipants} participants</span>
          </div>
        )}

        {code && (
          <button
            type="button"
            onClick={() => copyCode(code)}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            <Copy size={15} />
            Copy meeting code
          </button>
        )}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {status === "scheduled" && (
            <>
              <button
                type="button"
                disabled={isBusy || !id}
                onClick={() => handleAction(meeting, "start")}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play size={15} />
                Start
              </button>

              <button
                type="button"
                disabled={isBusy || !id}
                onClick={() => handleAction(meeting, "cancel")}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <XCircle size={15} />
                Cancel
              </button>
            </>
          )}

          {status === "live" && (
            <button
              type="button"
              disabled={isBusy || !id}
              onClick={() => handleAction(meeting, "end")}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Square size={15} />
              End meeting
            </button>
          )}

          {isBusy && (
            <span className="self-center text-xs text-slate-500">
              Updating meeting...
            </span>
          )}

          {isScheduledCard && !id && (
            <span className="text-xs text-slate-500">
              Meeting details are unavailable.
            </span>
          )}
        </div>
      </article>
    );
  }

  return (
    <section className="mx-auto max-w-6xl">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold tracking-wider text-brand-600">
            MEETING SPACE
          </p>

          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            My meetings
          </h1>

          <p className="mt-2 text-slate-500">
            Create meetings, share access codes, and manage your schedule.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowCreateForm((current) => !current);
            setError("");
            setNotice("");
            setCreatedMeeting(null);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 font-bold text-white transition hover:bg-brand-700"
        >
          {showCreateForm ? <X size={18} /> : <Plus size={18} />}
          {showCreateForm ? "Close form" : "Create meeting"}
        </button>
      </div>

      {/* Feedback */}
      {error && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="mt-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Newly created meeting */}
      {createdMeeting?.meetingCode && (
        <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50 p-5">
          <p className="text-sm font-bold text-brand-700">
            Your meeting is ready
          </p>

          <h2 className="mt-1 text-lg font-extrabold text-ink">
            {createdMeeting.title}
          </h2>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="break-all rounded-lg border border-brand-100 bg-white px-4 py-3 text-lg font-bold tracking-wider text-brand-700">
              {createdMeeting.meetingCode}
            </code>

            <button
              type="button"
              onClick={() => copyCode(createdMeeting.meetingCode)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-700"
            >
              <Copy size={16} />
              Copy code
            </button>
          </div>

          <p className="mt-3 text-sm text-slate-600">
            Share this code with the people you want to invite. They can use it
            to join when the meeting is live.
          </p>
        </div>
      )}

      {/* Create meeting form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-7"
        >
          <div className="mb-6">
            <p className="text-sm font-bold text-brand-600">NEW MEETING</p>
            <h2 className="mt-1 text-xl font-extrabold text-ink">
              Set up your meeting
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Give your meeting a title and choose its options.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="meeting-title"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Meeting title <span className="text-red-500">*</span>
              </label>

              <input
                id="meeting-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Project discussion"
                minLength={3}
                maxLength={100}
                required
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-50"
              />

              <p className="mt-1 text-xs text-slate-400">
                Minimum 3 characters, maximum 100.
              </p>
            </div>

            <div>
              <label
                htmlFor="meeting-scheduled-at"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Schedule date and time
              </label>

              <input
                id="meeting-scheduled-at"
                type="datetime-local"
                value={scheduledAt}
                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                onChange={(event) => setScheduledAt(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-50"
              />

              <p className="mt-1 text-xs text-slate-400">
                Optional. Leave empty to create without a scheduled time.
              </p>
            </div>

            <div>
              <label
                htmlFor="meeting-max-participants"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Maximum participants
              </label>

              <select
                id="meeting-max-participants"
                value={maxParticipants}
                onChange={(event) => setMaxParticipants(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-50"
              >
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((count) => (
                  <option key={count} value={String(count)}>
                    {count} participants
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              disabled={creating}
              className="rounded-xl border border-slate-200 px-5 py-3 font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Plus size={18} />
              )}
              {creating ? "Creating meeting..." : "Create meeting"}
            </button>
          </div>
        </form>
      )}

      {/* Join meeting */}
      <form
        onSubmit={handleJoin}
        className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
            <Video size={21} />
          </span>

          <div>
            <h2 className="font-extrabold text-ink">Join with a code</h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter the 12-character meeting code shared by the host.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={meetingCode}
            onChange={(event) => setMeetingCode(event.target.value)}
            placeholder="e.g. a1b2c3d4e5f6"
            minLength={12}
            maxLength={12}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-50"
          />

          <button
            type="submit"
            disabled={joining}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-bold text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {joining ? "Joining..." : "Join meeting"}
            {joining ? (
              <RefreshCw size={17} className="animate-spin" />
            ) : (
              <ArrowRight size={17} />
            )}
          </button>
        </div>
      </form>

      {/* Hosted meetings */}
      <div className="mt-10 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-ink">Hosted meetings</h2>
          <p className="mt-1 text-sm text-slate-500">
            Meetings associated with your account.
          </p>
        </div>

        <button
          type="button"
          onClick={loadMeetings}
          disabled={loading}
          aria-label="Refresh meetings"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">
          Loading meetings...
        </div>
      ) : meetings.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <Video size={30} className="mx-auto text-slate-400" />
          <h3 className="mt-4 font-bold text-ink">No hosted meetings yet</h3>
          <p className="mt-2 text-sm text-slate-500">
            Create your first meeting to get started.
          </p>

          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
          >
            <Plus size={16} />
            Create your first meeting
          </button>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {meetings.map((meeting) => renderMeetingCard(meeting))}
        </div>
      )}

      {/* Scheduled meetings */}
      <div className="mt-10">
        <div className="flex items-center gap-3">
          <CalendarDays size={21} className="text-brand-600" />
          <div>
            <h2 className="text-xl font-extrabold text-ink">
              Scheduled meetings
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Meetings with a scheduled date and time.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-slate-500">Loading schedule...</p>
        ) : scheduled.length === 0 ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-6">
            <CalendarDays size={25} className="text-slate-400" />
            <p className="mt-3 font-semibold text-slate-700">
              No scheduled meetings found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Choose a future date and time when creating a meeting to schedule
              it.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {scheduled.map((meeting) => renderMeetingCard(meeting, true))}
          </div>
        )}
      </div>
    </section>
  );
}
