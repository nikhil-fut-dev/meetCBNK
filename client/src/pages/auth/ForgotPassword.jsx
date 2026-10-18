import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import AuthLayout from "../../components/common/AuthLayout";
import { requestPasswordReset } from "../../services/api/authService";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const data = await requestPasswordReset(email);
      setMessage(
        data.message ||
          "If the account is eligible, password reset instructions will be provided.",
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to submit your request. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email associated with your account to begin recovery."
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-2 font-bold text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft size={15} /> Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">
            Email address
          </span>
          <span className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 px-3.5 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-blue-50">
            <Mail size={18} className="text-slate-400" />
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </span>
        </label>

        {message && (
          <p
            role="status"
            className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"
          >
            {message}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Sending request..." : "Continue"}
        </button>
      </form>
    </AuthLayout>
  );
}
