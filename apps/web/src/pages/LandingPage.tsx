import { useEffect } from 'react';
import { CTAButton } from '../components/landing/CTAButton';
import { FeatureCard } from '../components/landing/FeatureCard';
import { MockPanel } from '../components/landing/MockPanel';
import { Section } from '../components/landing/Section';

const SEO_TAGS = [
  {
    attr: 'name' as const,
    key: 'description',
    content:
      'Masq is a privacy-forward gamer chat platform with mask identity, fast servers, and no-call-recording voice/video.',
  },
  {
    attr: 'property' as const,
    key: 'og:title',
    content: 'Masq | Privacy-Forward Gamer Chat',
  },
  {
    attr: 'property' as const,
    key: 'og:description',
    content:
      'Contextual mask identity, LiveKit-powered realtime chat, and presence progression built for teams, clans, and communities.',
  },
  {
    attr: 'property' as const,
    key: 'og:type',
    content: 'website',
  },
  {
    attr: 'property' as const,
    key: 'og:url',
    content: typeof window !== 'undefined' ? window.location.origin : 'https://masq.chat',
  },
];

const setMetaTag = (attr: 'name' | 'property', key: string, content: string) => {
  let element = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
};

const IconMask = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 10c0-3 1-5 3-6l5 3 5-3c2 1 3 3 3 6 0 6-4 10-8 10s-8-4-8-10z" />
    <path d="M8.5 11.5h.01M15.5 11.5h.01" strokeLinecap="round" />
  </svg>
);

const IconRtc = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3.5" y="7" width="13" height="10" rx="2" />
    <path d="M16.5 10.5l4-2v7l-4-2" />
    <circle cx="8.5" cy="12" r="1.5" />
  </svg>
);

const IconStack = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 6h16M4 12h16M4 18h10" />
    <circle cx="18" cy="18" r="2" />
  </svg>
);

const IconAura = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
  </svg>
);

const IconPrivacy = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" />
    <path d="M9.5 12.5l1.5 1.5 3.5-3.5" />
  </svg>
);

export function LandingPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Masq | Privacy-Forward Gamer Chat Platform';
    for (const tag of SEO_TAGS) {
      setMetaTag(tag.attr, tag.key, tag.content);
    }
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="relative -m-3 h-[calc(100%+1.5rem)] overflow-y-auto bg-[#050810] text-slate-100 sm:-m-4 sm:h-[calc(100%+2rem)] md:-m-5 md:h-[calc(100%+2.5rem)]">
      <div className="landing-noise pointer-events-none absolute inset-0" />
      <div className="landing-grid pointer-events-none absolute inset-0 opacity-55" />
      <div className="landing-orb landing-orb-a pointer-events-none absolute -left-20 top-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="landing-orb landing-orb-b pointer-events-none absolute right-0 top-[32rem] h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />

      <div className="relative z-10 pb-16">
        <header className="sticky top-0 z-30 border-b border-slate-800/60 bg-[#050810]/85 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-300/35 bg-cyan-300/10 text-cyan-100">
                <IconMask />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-[0.02em] text-white">Masq</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-200/90">Private Realtime Chat</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CTAButton to="/login" variant="secondary" className="px-3 py-1.5 text-xs">
                Open App
              </CTAButton>
              <CTAButton to="/register" className="px-3 py-1.5 text-xs">
                Create Account
              </CTAButton>
            </div>
          </div>
        </header>

        <Section className="pt-16 sm:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-cyan-100">
                  Early Access
                </span>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-emerald-100">
                  No Call Recording
                </span>
              </div>
              <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
                Game with your people.
                <span className="block text-cyan-200">Own your identity.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base text-slate-300 sm:text-lg">
                Masq is a privacy-forward gamer chat platform where you can switch mask personas by context, hop
                between servers, DMs, and rooms instantly, and run LiveKit-powered voice/video without recording.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <CTAButton to="/register" className="min-w-[150px]">
                  Create Account
                </CTAButton>
                <CTAButton href="#features" variant="secondary" className="min-w-[150px]">
                  See Features
                </CTAButton>
                <CTAButton href="#showcase" variant="live" className="min-w-[150px]">
                  Watch Demo
                </CTAButton>
              </div>
              <p className="mt-4 text-xs text-slate-400">
                Built for teams, clans, and communities that want fast comms with stronger identity control.
              </p>
            </div>

            <MockPanel title="Live Session Snapshot" subtitle="Mask context active">
              <div className="space-y-3">
                <div className="rounded-xl border border-cyan-300/25 bg-cyan-300/8 px-3 py-2">
                  <p className="text-xs text-cyan-100">Server: Night Ops</p>
                  <p className="text-[11px] text-cyan-200/80">Voice active - 8 participants</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-700/80 bg-slate-900/80 p-2">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Mask</p>
                    <p className="mt-1 text-sm text-white">Azi</p>
                    <p className="text-[11px] text-slate-400">Aura: Resonant</p>
                  </div>
                  <div className="rounded-lg border border-slate-700/80 bg-slate-900/80 p-2">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Privacy</p>
                    <p className="mt-1 text-sm text-white">Recording Off</p>
                    <p className="text-[11px] text-slate-400">User-controlled</p>
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100">
                  LiveKit media active - minimal retention posture
                </div>
              </div>
            </MockPanel>
          </div>
        </Section>

        <Section
          id="features"
          eyebrow="Core Platform"
          title="Built for high-tempo groups and privacy-first communities"
          subtitle="Masq keeps your communication fast while giving identity and call-control choices usually missing from mainstream chat tools."
          className="pt-16 sm:pt-20"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<IconMask />}
              title="Mask Identity"
              description="Create multiple personas and choose who you are per context. Keep your identity flexible without account juggling."
            />
            <FeatureCard
              icon={<IconRtc />}
              title="Realtime Voice, Video, Screen Share"
              description="Low-latency LiveKit sessions for voice/video/screen share. Designed for tactical comms and quick group coordination."
              badge="Live"
            />
            <FeatureCard
              icon={<IconStack />}
              title="Servers, DMs, and Rooms"
              description="Move between persistent channels and short-lived rooms with fast navigation and clear context switching."
            />
            <FeatureCard
              icon={<IconAura />}
              title="Aura Progression"
              description="Presence progression per mask with visual tiers. Aura is not karma: no punishment loops and no moderation coupling."
            />
            <FeatureCard
              icon={<IconPrivacy />}
              title="Privacy Posture"
              description="No call recording by default, minimal retention direction, and user-facing control surfaces built in from the start."
            />
          </div>
        </Section>

        <Section
          id="showcase"
          eyebrow="Concept Panels"
          title="Designed for fast reads in live sessions"
          subtitle="These previews represent Masq's communication surfaces without exposing private data."
          className="pt-16 sm:pt-20"
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <MockPanel title="Channel Chat" subtitle="Room-scoped messaging">
              <div className="space-y-2">
                <div className="rounded-lg border border-slate-700/70 bg-slate-900/80 p-2">
                  <p className="text-xs font-medium text-white">Azi</p>
                  <p className="text-xs text-slate-300">Push left flank at 02:15.</p>
                </div>
                <div className="rounded-lg border border-slate-700/70 bg-slate-900/80 p-2">
                  <p className="text-xs font-medium text-white">Nyx</p>
                  <p className="text-xs text-slate-300">Copy. Masking to scout profile now.</p>
                </div>
                <div className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 p-2">
                  <p className="text-[11px] text-cyan-100">Typing as: Azi (Resonant Aura)</p>
                </div>
              </div>
            </MockPanel>

            <MockPanel title="Call Dock" subtitle="Live session controls">
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-slate-700/70 bg-slate-900/80 px-3 py-2">
                  <p className="text-xs text-slate-200">Night Ops Voice</p>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.9)]" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" className="rounded-lg border border-slate-700/70 bg-slate-900/80 py-2 text-xs text-slate-200">
                    Mic
                  </button>
                  <button type="button" className="rounded-lg border border-slate-700/70 bg-slate-900/80 py-2 text-xs text-slate-200">
                    Cam
                  </button>
                  <button type="button" className="rounded-lg border border-emerald-300/35 bg-emerald-300/10 py-2 text-xs text-emerald-100">
                    Share
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">Recording remains disabled by policy.</p>
              </div>
            </MockPanel>

            <MockPanel title="Mask + Aura Card" subtitle="Per-mask progression">
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg border border-slate-700/70 bg-slate-900/80 p-3">
                  <div className="h-12 w-12 rounded-full border-2 border-cyan-300/65 bg-gradient-to-br from-cyan-300/20 to-slate-800" />
                  <div>
                    <p className="text-sm font-semibold text-white">Azi</p>
                    <p className="text-[11px] text-cyan-100">Tier: Resonant</p>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-700/70 bg-slate-900/80 p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Effective Aura</p>
                  <p className="mt-1 text-lg font-semibold text-white">1,124</p>
                  <div className="mt-2 h-2 rounded-full bg-slate-800">
                    <div className="h-2 w-[62%] rounded-full bg-gradient-to-r from-cyan-300 to-blue-400" />
                  </div>
                </div>
              </div>
            </MockPanel>
          </div>
        </Section>

        <Section className="pt-16 sm:pt-20">
          <div className="rounded-3xl border border-slate-700/65 bg-slate-900/65 p-6 shadow-[0_20px_45px_rgba(0,0,0,0.34)] sm:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Social Proof Placeholder</p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Built for teams, clans, and communities</h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
              Early access groups are using Masq for match comms, project standups, and private community rooms.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {['Early Access', 'Clan Ready', 'Cross-Platform', 'Privacy-First'].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-slate-600/70 bg-slate-950/80 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-300"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </Section>

        <Section className="pt-16 sm:pt-20">
          <div className="rounded-3xl border border-cyan-300/35 bg-gradient-to-br from-cyan-300/12 to-emerald-300/10 p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">Ready to run private, high-speed comms?</h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-200 sm:text-base">
              Create your account, launch your first server, and invite your crew. Keep mask identity and privacy controls in your hands.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <CTAButton to="/register">Create Account</CTAButton>
              <CTAButton to="/login" variant="secondary">
                Open App
              </CTAButton>
              <CTAButton href="mailto:beta@masq.local" variant="live">
                Join Beta
              </CTAButton>
            </div>
          </div>
        </Section>

        <footer className="mx-auto mt-16 w-full max-w-7xl border-t border-slate-800/70 px-4 pt-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-slate-400">Masq (c) {new Date().getFullYear()}</p>
            <nav className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <a href="#" className="hover:text-white">
                Privacy
              </a>
              <a href="#" className="hover:text-white">
                Terms
              </a>
              <a href="#" className="hover:text-white">
                GitHub
              </a>
              <a href="#" className="hover:text-white">
                Contact
              </a>
            </nav>
          </div>
          <p className="mt-3 pb-8 text-[11px] text-slate-500">
            Privacy-first approach: call recording is not enabled by default and platform controls are built around user choice.
          </p>
        </footer>
      </div>
    </div>
  );
}
