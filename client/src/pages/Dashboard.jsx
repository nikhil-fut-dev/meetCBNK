import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Video,
  Plus,
  RefreshCw,
  Clock3,
  AlertCircle,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import {
  getMeetings,
  getScheduledMeetings,
  createMeeting,
} from "../services/api/meetingService";

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Unable to load meetings. Please try again."
  );
}

function getMeetingList(response) {
  // Supports common API response shapes.
  if (Array.isArray(response?.meetings)) return response.meetings;
  if (Array.isArray(response?.data?.meetings)) {
    return response.data.meetings;
  }
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

export default function Dashboard() {
  const { user } = useAuth();

  const [meetings, setMeetings] = useState([]);
  const [scheduledMeetings, setScheduledMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [meetingsResult, schedulesResult] = await Promise.all([
        getMeetings(),
        getScheduledMeetings(),
      ]);

      setMeetings(getMeetingList(meetingsResult));
      setScheduledMeetings(getMeetingList(schedulesResult));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function handleCreateMeeting() {
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const response = await createMeeting({});
      const meeting =
        response?.meeting || response?.data?.meeting || response?.data || null;

      setSuccess(
        meeting?.meetingCode
          ? `Meeting created! Code: ${meeting.meetingCode}`
          : response?.message || "Meeting created successfully.",
      );

      await loadDashboard();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  const displayName =
    user?.fullName || user?.username || user?.email || "there";

  return (
    <div className="min-h-screen bg-surface">
      <section className="container-width py-8 sm:py-12">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold text-brand-600">YOUR WORKSPACE</p>

            <h1 className="mt-3 font-[Manrope] text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Welcome back, {displayName}
            </h1>

            <p className="mt-3 max-w-xl text-slate-500">
              Create a meeting, catch up on your schedule, and manage your
              meetings from one place.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCreateMeeting}
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <Plus size={19} />
            )}
            {creating ? "Creating..." : "Create meeting"}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <div className="flex-1">{error}</div>

            <button
              type="button"
              onClick={loadDashboard}
              className="font-bold underline"
            >
              Retry
            </button>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800"
          >
            {success}
          </div>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="flex items-center justify-between">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-brand-600">
                <Video size={23} />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Hosted
              </span>
            </div>

            <p className="mt-5 text-sm font-medium text-slate-500">
              My meetings
            </p>

            <p className="mt-1 text-3xl font-extrabold text-ink">
              {loading ? "—" : meetings.length}
            </p>

            <Link
              to="/meetings"
              className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-600 hover:text-brand-700"
            >
              Open meetings <ArrowRight size={16} />
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="flex items-center justify-between">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-violet-50 text-violet-600">
                <CalendarDays size={23} />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Upcoming
              </span>
            </div>

            <p className="mt-5 text-sm font-medium text-slate-500">
              Scheduled meetings
            </p>

            <p className="mt-1 text-3xl font-extrabold text-ink">
              {loading ? "—" : scheduledMeetings.length}
            </p>

            <Link
              to="/meetings"
              className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-600 hover:text-brand-700"
            >
              View schedule <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-extrabold text-ink">
                Recent meetings
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Meetings returned by your account's API.
              </p>
            </div>

            <button
              type="button"
              onClick={loadDashboard}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:self-auto"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Loading your meetings...
            </div>
          ) : meetings.length === 0 ? (
            <div className="py-12 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-50 text-slate-400">
                <Clock3 size={25} />
              </span>

              <h3 className="mt-4 font-bold text-ink">
                No meetings to show yet
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Create your first meeting to get started.
              </p>

              <button
                type="button"
                onClick={handleCreateMeeting}
                disabled={creating}
                className="mt-5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {creating ? "Creating..." : "Create your first meeting"}
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {meetings.slice(0, 5).map((meeting, index) => (
                <div
                  key={
                    meeting._id || meeting.id || meeting.meetingCode || index
                  }
                  className="flex flex-col justify-between gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                      <Video size={19} />
                    </span>

                    <div>
                      <p className="font-bold text-ink">
                        {meeting.title || meeting.name || "Meeting"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {meeting.meetingCode
                          ? `Code: ${meeting.meetingCode}`
                          : meeting.status || "Meeting"}
                      </p>
                    </div>
                  </div>

                  <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-600 sm:self-center">
                    {meeting.status || "Created"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
