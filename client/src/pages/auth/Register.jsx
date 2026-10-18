import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AtSign,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import AuthLayout from "../../components/common/AuthLayout";
import { useAuth } from "../../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register({
        ...form,
        fullName: form.fullName.trim(),
        username: form.username.trim().toLowerCase(),
        email: form.email.trim().toLowerCase(),
      });

      navigate("/login", {
        replace: true,
        state: {
          message: "Registration successful. Please sign in to continue.",
        },
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Registration failed. Please review your details and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up your account and bring your team together."
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-bold text-brand-600 hover:text-brand-700"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">
            Full name
          </span>
          <span className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 px-3.5 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-blue-50">
            <UserRound size={18} className="text-slate-400" />
            <input
              name="fullName"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              placeholder="Your full name"
              value={form.fullName}
              onChange={updateField}
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">
            Username
          </span>
          <span className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 px-3.5 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-blue-50">
            <AtSign size={18} className="text-slate-400" />
            <input
              name="username"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
              autoComplete="username"
              placeholder="your_username"
              value={form.username}
              onChange={updateField}
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </span>
          <span className="mt-1.5 block text-xs text-slate-400">
            Use 3–30 letters, numbers, or underscores.
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">
            Email address
          </span>
          <span className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 px-3.5 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-blue-50">
            <Mail size={18} className="text-slate-400" />
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={updateField}
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
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Create a password"
              value={form.password}
              onChange={updateField}
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
          <span className="mt-1.5 block text-xs text-slate-400">
            Use at least 6 characters.
          </span>
        </label>

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
          {loading ? "Creating account..." : "Create account"}
        </button>

        <p className="text-center text-xs leading-5 text-slate-400">
          Please use accurate account details.
        </p>
      </form>
    </AuthLayout>
  );
}
