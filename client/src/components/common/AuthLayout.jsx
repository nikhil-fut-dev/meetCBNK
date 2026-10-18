import { Link } from "react-router-dom";
import { ArrowLeft, Video } from "lucide-react";

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="min-h-screen bg-[#f7f9fc]">
      <header className="container-width flex h-20 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
            <Video size={21} />
          </span>
          <span className="font-[Manrope] text-xl font-extrabold tracking-tight">
            Meet<span className="text-brand-600">CBNK</span>
          </span>
        </Link>

        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-600"
        >
          <ArrowLeft size={16} /> Back to home
        </Link>
      </header>

      <section className="container-width flex min-h-[calc(100vh-120px)] items-center justify-center py-10">
        <div className="w-full max-w-[460px] rounded-[26px] border border-slate-200/80 bg-white p-7 shadow-soft sm:p-10">
          <div className="mb-8">
            <h1 className="font-[Manrope] text-3xl font-extrabold tracking-tight text-ink">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">{subtitle}</p>
          </div>

          {children}

          {footer && (
            <div className="mt-7 border-t border-slate-100 pt-6 text-center text-sm text-slate-500">
              {footer}
            </div>
          )}
        </div>
      </section>

      <footer className="pb-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} MeetCBNK. All rights reserved.
      </footer>
    </main>
  );
}
