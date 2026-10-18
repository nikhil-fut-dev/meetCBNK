import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Video,
  LayoutDashboard,
  CalendarDays,
  Plus,
  LogOut,
  Settings,
  Headphones,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const navigation = [
  {
    label: "Overview",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "My Meetings",
    path: "/meetings",
    icon: Video,
  },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  const displayName = user?.fullName || user?.username || "User";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-surface text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <NavLink
          to="/dashboard"
          className="flex h-20 items-center gap-3 border-b border-slate-100 px-6"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Video size={22} />
          </span>
          <span className="text-xl font-extrabold tracking-tight">
            Meet<span className="text-brand-600">CBNK</span>
          </span>
        </NavLink>

        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">
            Workspace
          </p>

          <nav className="space-y-1">
            {navigation.map(({ label, path, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-ink"
                  }`
                }
              >
                <Icon size={19} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="mb-4 rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <Headphones size={19} className="text-brand-600" />
              <div>
                <p className="text-sm font-bold">Need help?</p>
                <p className="mt-1 text-xs text-slate-500">
                  We're here for you.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={19} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-h-screen md:pl-64">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur md:px-8">
          <div>
            <p className="text-sm text-slate-500">Welcome back,</p>
            <p className="font-bold">{displayName}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/meetings")}
              className="hidden items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 sm:flex"
            >
              <Plus size={18} />
              New meeting
            </button>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              {initials || "U"}
            </div>
          </div>
        </header>

        <main className="p-5 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
