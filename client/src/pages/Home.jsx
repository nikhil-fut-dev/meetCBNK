import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  AudioLines,
  Check,
  ChevronRight,
  CirclePlay,
  Globe2,
  LockKeyhole,
  Menu,
  Mic,
  MonitorUp,
  ShieldCheck,
  Sparkles,
  Video,
  X,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Video,
    title: "Meet face to face",
    description:
      "Bring your team together with a meeting experience that feels natural, focused, and effortless.",
    tone: "blue",
  },
  {
    icon: MonitorUp,
    title: "Share what matters",
    description:
      "Present your ideas, walk through projects, and keep everyone on the same page.",
    tone: "violet",
  },
  {
    icon: AudioLines,
    title: "Conversations that flow",
    description:
      "A clean, distraction-free space designed to keep conversations moving forward.",
    tone: "green",
  },
];

const benefits = [
  "Simple meeting links",
  "A clean, focused workspace",
  "Meet from your browser",
];

function Brand({ light = false }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5">
      <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-brand-600 text-white shadow-lg shadow-blue-200/60">
        <Video size={21} strokeWidth={2.4} />
      </span>
      <span
        className={`font-[Manrope] text-[21px] font-extrabold tracking-[-1px] ${
          light ? "text-white" : "text-ink"
        }`}
      >
        Meet
        <span className={light ? "text-blue-300" : "text-brand-600"}>CBNK</span>
      </span>
    </Link>
  );
}

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="relative z-30 border-b border-slate-100 bg-white/95 backdrop-blur-xl">
      <nav className="container-width flex h-[82px] items-center justify-between">
        <Brand />

        <div className="hidden items-center gap-9 md:flex">
          <a
            href="#features"
            className="text-sm font-semibold text-slate-600 transition hover:text-brand-600"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-sm font-semibold text-slate-600 transition hover:text-brand-600"
          >
            How it works
          </a>
          <a
            href="#security"
            className="text-sm font-semibold text-slate-600 transition hover:text-brand-600"
          >
            Security
          </a>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="rounded-xl px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200/60 transition hover:-translate-y-0.5 hover:bg-brand-700"
          >
            Get started <ArrowRight size={16} />
          </Link>
        </div>

        <button
          type="button"
          aria-label={
            menuOpen ? "Close navigation menu" : "Open navigation menu"
          }
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-700 md:hidden"
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </nav>

      {menuOpen && (
        <div className="absolute left-0 right-0 top-full border-b border-slate-200 bg-white p-5 shadow-xl md:hidden">
          <div className="container-width flex flex-col gap-1">
            <a
              onClick={closeMenu}
              href="#features"
              className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-700"
            >
              Features
            </a>
            <a
              onClick={closeMenu}
              href="#how-it-works"
              className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-700"
            >
              How it works
            </a>
            <a
              onClick={closeMenu}
              href="#security"
              className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-700"
            >
              Security
            </a>
            <Link
              onClick={closeMenu}
              to="/login"
              className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-700"
            >
              Log in
            </Link>
            <Link
              onClick={closeMenu}
              to="/register"
              className="mt-2 rounded-xl bg-brand-600 px-4 py-3 text-center text-sm font-bold text-white"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function MeetingPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[590px]">
      <div className="absolute -inset-5 rounded-[36px] bg-blue-400/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-[25px] border border-white/80 bg-white p-3 shadow-[0_35px_100px_rgba(29,78,216,0.17)] sm:p-4">
        <div className="flex items-center justify-between px-2 pb-4 pt-1">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-brand-600">
              <Video size={18} />
            </span>
            <div>
              <p className="text-sm font-extrabold text-slate-900">
                Product sync
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Your meeting space
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Preview
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="relative h-[142px] overflow-hidden rounded-[16px] bg-[#dbeafe] sm:h-[180px]">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=85"
              alt="Portrait representing a meeting participant"
              className="h-full w-full object-cover object-center"
            />
            <span className="absolute bottom-2.5 left-2.5 rounded-lg bg-slate-950/60 px-2.5 py-1.5 text-[10px] font-semibold text-white backdrop-blur">
              Olivia Chen
            </span>
            <span className="absolute right-2.5 top-2.5 rounded-lg bg-slate-950/50 p-1.5 text-white">
              <Mic size={12} />
            </span>
          </div>

          <div className="relative h-[142px] overflow-hidden rounded-[16px] bg-[#e9e7ff] sm:h-[180px]">
            <img
              src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=85"
              alt="Portrait representing another meeting participant"
              className="h-full w-full object-cover object-center"
            />
            <span className="absolute bottom-2.5 left-2.5 rounded-lg bg-slate-950/60 px-2.5 py-1.5 text-[10px] font-semibold text-white backdrop-blur">
              Alex Morgan
            </span>
          </div>

          <div className="relative col-span-2 flex h-[102px] items-center justify-between overflow-hidden rounded-[16px] bg-gradient-to-r from-[#142447] via-[#1b3261] to-[#284b86] p-4 sm:h-[120px] sm:p-5">
            <div className="absolute -right-8 -top-14 h-40 w-40 rounded-full border border-white/10" />
            <div className="absolute -right-2 -top-6 h-28 w-28 rounded-full border border-white/10" />
            <div className="relative">
              <p className="text-[10px] font-medium text-blue-200">
                SHARED PRESENTATION
              </p>
              <p className="mt-1.5 font-[Manrope] text-base font-bold text-white sm:text-lg">
                Q4 Product Roadmap
              </p>
              <p className="mt-1 text-[11px] text-blue-100/70">
                Design · Engineering · Growth
              </p>
            </div>
            <span className="relative grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white">
              <MonitorUp size={21} />
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between px-1 pb-1 pt-4">
          <div className="flex -space-x-2">
            {[
              "photo-1534528741775-53994a69daeb",
              "photo-1500648767791-00dcc994a43e",
              "photo-1506794778202-cad84cf45f1d",
            ].map((photo) => (
              <img
                key={photo}
                src={`https://images.unsplash.com/${photo}?auto=format&fit=crop&w=80&q=75`}
                alt=""
                className="h-7 w-7 rounded-full border-2 border-white object-cover"
              />
            ))}
            <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-blue-50 text-[9px] font-bold text-brand-700">
              +2
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 sm:text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />A clearer
            way to connect
          </div>
        </div>
      </div>

      <div className="absolute -left-5 top-[23%] hidden items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-card lg:flex">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
          <ShieldCheck size={20} />
        </span>
        <div>
          <p className="text-xs font-extrabold text-slate-900">
            Private by design
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            Built for your workspace
          </p>
        </div>
      </div>

      <div className="absolute -right-4 bottom-[17%] hidden items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-card sm:flex">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-brand-600">
          <Zap size={20} />
        </span>
        <div>
          <p className="text-xs font-extrabold text-slate-900">Less friction</p>
          <p className="mt-1 text-[10px] text-slate-500">
            More meaningful work
          </p>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#fbfcff]">
      <div className="pointer-events-none absolute -right-40 -top-28 h-[540px] w-[540px] rounded-full bg-blue-100/50 blur-[90px]" />
      <div className="pointer-events-none absolute -left-48 top-72 h-[420px] w-[420px] rounded-full bg-indigo-50 blur-[80px]" />

      <div className="container-width relative grid items-center gap-14 py-16 sm:py-20 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10 lg:py-24">
        <div className="max-w-[570px]">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3.5 py-2 shadow-sm">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-50 text-brand-600">
              <Sparkles size={13} />
            </span>
            <span className="text-xs font-bold text-slate-700 sm:text-sm">
              A more human way to meet
            </span>
            <ChevronRight size={15} className="text-brand-600" />
          </div>

          <h1 className="font-[Manrope] text-[43px] font-extrabold leading-[1.09] tracking-[-2.5px] text-[#111d35] sm:text-[58px] lg:text-[64px]">
            Great work
            <br />
            starts with
            <br />
            <span className="relative inline-block text-brand-600">
              a better
              <span className="absolute -bottom-1 left-0 -z-0 h-2 w-full rounded-full bg-blue-100" />
            </span>{" "}
            meeting.
          </h1>

          <p className="mt-7 max-w-[470px] text-base leading-8 text-slate-600 sm:text-[17px]">
            Bring your people together, share ideas, and make progress. MeetCBNK
            gives your conversations a workspace that feels simple from the very
            first click.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/register"
              className="group inline-flex min-h-[54px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-200/70 transition hover:-translate-y-0.5 hover:bg-brand-700"
            >
              Start a meeting journey
              <ArrowRight
                size={17}
                className="transition group-hover:translate-x-1"
              />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50/50"
            >
              <CirclePlay size={18} className="text-brand-600" />
              See how it works
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs font-medium text-slate-500 sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Check size={15} className="text-emerald-600" /> Easy to get
              started
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check size={15} className="text-emerald-600" /> Made for teams
            </span>
          </div>
        </div>

        <div className="relative px-1 sm:px-4 lg:px-0">
          <MeetingPreview />
        </div>
      </div>

      <div className="border-y border-slate-100 bg-white/80">
        <div className="container-width flex flex-wrap items-center justify-center gap-x-10 gap-y-4 py-5 text-center sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-[1.5px] text-slate-400">
            Made for the way teams work
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm font-bold text-slate-500">
            <span className="inline-flex items-center gap-2">
              <Globe2 size={16} /> Work anywhere
            </span>
            <span className="inline-flex items-center gap-2">
              <LockKeyhole size={16} /> Privacy minded
            </span>
            <span className="inline-flex items-center gap-2">
              <Zap size={16} /> Less setup
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="section-padding bg-white">
      <div className="container-width">
        <div className="mx-auto max-w-[640px] text-center">
          <span className="text-xs font-extrabold uppercase tracking-[2px] text-brand-600">
            Built around your work
          </span>
          <h2 className="mt-4 font-[Manrope] text-3xl font-extrabold leading-tight tracking-[-1.4px] text-ink sm:text-[43px]">
            Everything you need to
            <br className="hidden sm:block" /> make time together count.
          </h2>
          <p className="mt-5 text-base leading-7 text-slate-500">
            Your meetings should move ideas forward, not get in the way. Keep
            the experience simple and the conversation at the center.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {features.map(({ icon: Icon, title, description, tone }) => {
            const toneClasses = {
              blue: "bg-blue-50 text-brand-600",
              violet: "bg-violet-50 text-violet-600",
              green: "bg-emerald-50 text-emerald-600",
            };

            return (
              <article
                key={title}
                className="group rounded-[22px] border border-slate-200/80 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-soft sm:p-8"
              >
                <span
                  className={`grid h-14 w-14 place-items-center rounded-2xl ${toneClasses[tone]}`}
                >
                  <Icon size={25} strokeWidth={1.8} />
                </span>
                <h3 className="mt-7 font-[Manrope] text-xl font-extrabold tracking-[-0.5px] text-ink">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  {description}
                </p>
                <a
                  href="#how-it-works"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-600"
                >
                  Explore the experience
                  <ArrowRight
                    size={15}
                    className="transition group-hover:translate-x-1"
                  />
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Create your space",
      description: "Set up your account and get your workspace ready.",
    },
    {
      number: "02",
      title: "Bring people in",
      description:
        "Create a meeting and share its meeting code with your guests.",
    },
    {
      number: "03",
      title: "Get to the good stuff",
      description:
        "Spend less time setting things up and more time working together.",
    },
  ];

  return (
    <section id="how-it-works" className="section-padding bg-surface">
      <div className="container-width grid items-center gap-14 lg:grid-cols-2">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-[2px] text-brand-600">
            A simpler workflow
          </span>
          <h2 className="mt-4 max-w-[500px] font-[Manrope] text-3xl font-extrabold leading-tight tracking-[-1.4px] text-ink sm:text-[43px]">
            From “let’s meet” to “let’s make it happen.”
          </h2>
          <p className="mt-5 max-w-[490px] text-base leading-7 text-slate-500">
            A straightforward meeting journey that helps your team get organized
            and start on the same page.
          </p>

          <div className="mt-9 space-y-7">
            {steps.map((step) => (
              <div key={step.number} className="flex gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-blue-100 bg-white font-[Manrope] text-sm font-extrabold text-brand-600 shadow-sm">
                  {step.number}
                </span>
                <div>
                  <h3 className="font-bold text-slate-900">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-500">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[28px] bg-[#142447] p-6 text-white shadow-soft sm:p-9">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-blue-100">
                Your workspace
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-blue-100">
                MeetCBNK
              </span>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.07] p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-500/20 text-blue-200">
                  <Video size={22} />
                </span>
                <div>
                  <p className="font-bold">Team catch-up</p>
                  <p className="mt-1 text-xs text-blue-100/60">
                    A space to connect and collaborate
                  </p>
                </div>
              </div>

              <div className="my-6 h-px bg-white/10" />

              <div className="space-y-4">
                {benefits.map((benefit) => (
                  <div
                    key={benefit}
                    className="flex items-center gap-3 text-sm text-blue-50/90"
                  >
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                      <Check size={12} />
                    </span>
                    {benefit}
                  </div>
                ))}
              </div>

              <Link
                to="/register"
                className="mt-7 flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-extrabold text-[#142447] transition hover:bg-blue-50"
              >
                Set up your account <ArrowRight size={16} />
              </Link>
            </div>

            <p className="relative mt-5 text-center text-xs text-blue-100/50">
              Your next great conversation starts here.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  return (
    <section id="security" className="bg-white py-20 sm:py-24">
      <div className="container-width">
        <div className="relative overflow-hidden rounded-[28px] border border-blue-100 bg-gradient-to-br from-[#f4f8ff] via-white to-[#edf3ff] px-6 py-12 sm:px-12 sm:py-14">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-100/60 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-[650px]">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-2 text-xs font-bold text-brand-700">
                <ShieldCheck size={15} /> Thoughtful by design
              </span>
              <h2 className="mt-5 font-[Manrope] text-3xl font-extrabold leading-tight tracking-[-1.3px] text-ink sm:text-[40px]">
                Your conversations deserve a considered space.
              </h2>
              <p className="mt-4 max-w-[570px] text-sm leading-7 text-slate-600 sm:text-base">
                MeetCBNK is designed around a clear, focused experience. Account
                access and meeting permissions are handled by your application
                backend.
              </p>
            </div>
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-[25px] border border-blue-100 bg-white text-brand-600 shadow-card">
              <ShieldCheck size={38} strokeWidth={1.6} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-24">
      <div className="relative mx-auto max-w-[1180px] overflow-hidden rounded-[28px] bg-[#142447] px-6 py-14 text-center sm:px-12 sm:py-16">
        <div className="absolute -left-20 -top-36 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-12 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative mx-auto max-w-[650px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-blue-100">
            <Sparkles size={14} /> Make room for better conversations
          </span>
          <h2 className="mt-6 font-[Manrope] text-3xl font-extrabold leading-tight tracking-[-1.5px] text-white sm:text-[45px]">
            Good things happen when we connect.
          </h2>
          <p className="mx-auto mt-5 max-w-[510px] text-sm leading-7 text-blue-100/70 sm:text-base">
            Bring your team into one space and turn your next conversation into
            forward progress.
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex min-h-[54px] items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-extrabold text-[#142447] transition hover:-translate-y-0.5 hover:bg-blue-50"
          >
            Get started with MeetCBNK <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="container-width grid gap-10 py-10 sm:grid-cols-2 sm:py-12 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Brand />
          <p className="mt-4 max-w-[310px] text-sm leading-6 text-slate-500">
            A focused space for teams to meet, share ideas, and move work
            forward.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Explore</h3>
          <div className="mt-4 flex flex-col items-start gap-3 text-sm text-slate-500">
            <a href="#features" className="transition hover:text-brand-600">
              Features
            </a>
            <a href="#how-it-works" className="transition hover:text-brand-600">
              How it works
            </a>
            <a href="#security" className="transition hover:text-brand-600">
              Security
            </a>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-extrabold text-slate-900">
            Your account
          </h3>
          <div className="mt-4 flex flex-col items-start gap-3 text-sm text-slate-500">
            <Link to="/login" className="transition hover:text-brand-600">
              Log in
            </Link>
            <Link to="/register" className="transition hover:text-brand-600">
              Create an account
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100">
        <div className="container-width flex flex-col gap-2 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} MeetCBNK. All rights reserved.</p>
          <p>Designed for better conversations.</p>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-white">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <SecuritySection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
