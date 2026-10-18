import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import AuthLayout from "../../components/common/AuthLayout";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const notice = location.state?.message;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(form);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Login failed. Please check your details and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your MeetCBNK account and get back to your team."
      footer={
        <>
          New to MeetCBNK?{" "}
          <Link
            to="/register"
            className="font-bold text-brand-600 hover:text-brand-700"
          >
            Create an account
          </Link>
        </>
      }
    >
      {notice && (
        <p
          role="status"
          className="mb-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {notice}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">
            Email address
          </span>
          <span className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 px-3.5 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-blue-50">
            <Mail size={18} className="text-slate-400" />
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">
            Password
          </span>
          <span className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 px-3.5 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-blue-50">
            <LockKeyhole size={18} className="text-slate-400" />
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
              className="text-slate-400 hover:text-slate-700"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-bold text-brand-600 hover:text-brand-700"
          >
            Forgot password?
          </Link>
        </div>

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
          className="flex h-12 w-full items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-lg shadow-blue-100 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}
