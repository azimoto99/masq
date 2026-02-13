import { type MouseEvent, useCallback, useEffect } from 'react';
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
    key: 'og:image',
    content: 'https://masq.chat/og-placeholder.png',
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

const IconAlwaysOn = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5l3 2" strokeLinecap="round" />
  </svg>
);

const IconLock = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 1 1 8 0v3" />
  </svg>
);

const IconBolt = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M13 2L5 13h6l-1 9 9-13h-6l0-7z" />
  </svg>
);

const IconShield = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" />
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

  const onScrollTo = useCallback((id: string, event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    const section = document.getElementById(id);
    if (!section) {
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    section.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }, []);

  const handleFeaturesNav = (event: MouseEvent<HTMLElement>) => onScrollTo('features', event);
  const handlePrivacyNav = (event: MouseEvent<HTMLElement>) => onScrollTo('privacy', event);
  const handleProNav = (event: MouseEvent<HTMLElement>) => onScrollTo('pro', event);
  const handleBuiltForNav = (event: MouseEvent<HTMLElement>) => onScrollTo('built-for', event);
  const handleSnapshotNav = (event: MouseEvent<HTMLElement>) => onScrollTo('snapshot', event);

  return (
    <div className="relative -m-3 h-[calc(100%+1.5rem)] overflow-y-auto bg-[#050810] text-slate-100 sm:-m-4 sm:h-[calc(100%+2rem)] md:-m-5 md:h-[calc(100%+2.5rem)]">
      <div className="landing-noise pointer-events-none absolute inset-0" />
      <div className="landing-grid pointer-events-none absolute inset-0 opacity-55" />
      <div className="landing-orb landing-orb-a pointer-events-none absolute -left-20 top-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="landing-orb landing-orb-b pointer-events-none absolute right-0 top-[30rem] h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />

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
            <nav className="hidden items-center gap-4 md:flex">
              <a
                href="#features"
                onClick={handleFeaturesNav}
                className="text-xs uppercase tracking-[0.12em] text-slate-300 hover:text-white"
              >
                Features
              </a>
              <a
                href="#privacy"
                onClick={handlePrivacyNav}
                className="text-xs uppercase tracking-[0.12em] text-slate-300 hover:text-white"
              >
                Privacy
              </a>
              <a
                href="#pro"
                onClick={handleProNav}
                className="text-xs uppercase tracking-[0.12em] text-slate-300 hover:text-white"
              >
                Pro
              </a>
            </nav>
            <div className="flex items-center gap-2 sm:gap-2.5">
              <CTAButton to="/login" variant="secondary" className="px-3 py-1.5 text-xs sm:text-sm">
                Open App
              </CTAButton>
              <CTAButton to="/register" className="px-3 py-1.5 text-xs sm:text-sm">
                Create Account
              </CTAButton>
            </div>
          </div>
        </header>

        <Section id="snapshot" className="scroll-mt-24 pt-16 sm:pt-20">
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
                Switch personas by context, jump into low-latency voice/video/screen share, and keep recordings off by
                default.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <CTAButton to="/register" className="min-w-[150px]">
                  Create Account
                </CTAButton>
                <CTAButton href="#features" variant="secondary" className="min-w-[150px]" onClick={handleFeaturesNav}>
                  See Features
                </CTAButton>
                <CTAButton href="#snapshot" variant="live" className="min-w-[150px]" onClick={handleSnapshotNav}>
                  Watch Demo
                </CTAButton>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-700/70 bg-slate-950/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Why Masq</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-2.5 py-2 text-xs text-slate-200">
                    Mask identity for every context
                  </div>
                  <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-2.5 py-2 text-xs text-slate-200">
                    Fast RTC voice, video, screen share
                  </div>
                  <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-2.5 py-2 text-xs text-slate-200">
                    No call recording by default
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs text-slate-400">Built for teams, clans, and communities that move fast.</p>
            </div>

            <MockPanel title="Live Session Snapshot" subtitle="Mask context active" badgeLabel="Live" badgeTone="live">
              <div className="space-y-3">
                <div className="rounded-xl border border-cyan-300/25 bg-cyan-300/8 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-cyan-100">Server: Night Ops</p>
                    <p className="inline-flex items-center gap-1.5 text-[11px] text-emerald-100">
                      <span className="landing-live-dot h-2.5 w-2.5 rounded-full bg-emerald-300" />
                      Voice active
                    </p>
                  </div>
                  <p className="text-[11px] text-cyan-200/80">8 participants in-call</p>
                </div>
                <div className="rounded-lg border border-slate-700/80 bg-slate-900/80 p-2.5">
                  <div className="flex items-center gap-3">
                    <div className="landing-aura-avatar relative h-11 w-11 rounded-full border border-cyan-300/55 bg-gradient-to-br from-cyan-300/25 to-slate-800">
                      <span className="landing-aura-halo absolute inset-0 rounded-full" />
                    </div>
                    <div>
                      <p className="text-sm text-white">Azi</p>
                      <p className="text-[11px] text-slate-400">Aura: Resonant</p>
                    </div>
                  </div>
                  <div className="landing-wave mt-3" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100">
                  <p className="inline-flex items-center gap-1.5">
                    <IconLock />
                    Recording Off
                  </p>
                  <p className="text-[11px] text-emerald-200/85">LiveKit media active</p>
                </div>
              </div>
            </MockPanel>
          </div>
        </Section>

        <Section
          id="features"
          eyebrow="Core Platform"
          title="Move faster with identity control and realtime clarity"
          subtitle="Everything stays readable mid-session: where you are, who you are, and what your call state is."
          className="scroll-mt-24 pt-16 sm:pt-20"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<IconMask />}
              title="Mask Identity"
              description="Switch personas by context without account juggling."
              href="#built-for"
              onLearnMore={handleBuiltForNav}
            />
            <FeatureCard
              icon={<IconRtc />}
              title="Realtime Voice, Video, Screen Share"
              description="LiveKit-powered comms tuned for low-latency group play."
              badge="Live"
              href="#privacy"
              onLearnMore={handlePrivacyNav}
            />
            <FeatureCard
              icon={<IconStack />}
              title="Servers, DMs, and Rooms"
              description="Jump between persistent channels and quick rooms instantly."
              href="#built-for"
              onLearnMore={handleBuiltForNav}
            />
            <FeatureCard
              icon={<IconAlwaysOn />}
              title="Always-on Calls"
              description="Stay connected while moving through pages and workflows."
              href="#pro"
              onLearnMore={handleProNav}
            />
            <FeatureCard
              icon={<IconAura />}
              title="Aura (Presence, not karma)"
              description="Per-mask progression with tiers and color, never punishment."
              href="#privacy"
              onLearnMore={handlePrivacyNav}
            />
          </div>
        </Section>

        <Section
          id="built-for"
          eyebrow="Built For"
          title="Teams and communities that need fast trust"
          subtitle="Masq fits high-pressure sessions and private spaces where identity context matters."
          className="scroll-mt-24 pt-16 sm:pt-20"
        >
          <div className="rounded-2xl border border-slate-700/65 bg-slate-900/65 p-4 sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Built for teams, clans, and communities</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Early Access', 'Clan Ready', 'Focus Sessions', 'Privacy-Forward'].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-slate-600/70 bg-slate-950/80 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-300"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-slate-700/65 bg-slate-900/65 p-4">
              <h3 className="text-sm font-semibold text-white">Competitive Teams</h3>
              <p className="mt-2 text-sm text-slate-300">Run scrims with always-on comms and swap masks by role between rounds.</p>
            </article>
            <article className="rounded-2xl border border-slate-700/65 bg-slate-900/65 p-4">
              <h3 className="text-sm font-semibold text-white">Private Communities</h3>
              <p className="mt-2 text-sm text-slate-300">Host voice nights where recording stays off and identity stays contextual.</p>
            </article>
            <article className="rounded-2xl border border-slate-700/65 bg-slate-900/65 p-4">
              <h3 className="text-sm font-semibold text-white">Dev and Study Squads</h3>
              <p className="mt-2 text-sm text-slate-300">Share screens for pair sessions while keeping channels clean and focused.</p>
            </article>
            <article className="rounded-2xl border border-slate-700/65 bg-slate-900/65 p-4">
              <h3 className="text-sm font-semibold text-white">Identity-driven Spaces</h3>
              <p className="mt-2 text-sm text-slate-300">Use different masks for guilds, friends, and public lobbies without leakage.</p>
            </article>
          </div>
        </Section>

        <Section
          id="privacy"
          eyebrow="Privacy"
          title="Privacy-first by design"
          subtitle="Masq is built for real-time communication without surveillance-style defaults."
          className="scroll-mt-24 pt-16 sm:pt-20"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-2xl border border-slate-700/65 bg-slate-900/65 p-5">
              <ul className="space-y-3">
                <li className="flex items-start gap-2 text-sm text-slate-200">
                  <span className="mt-0.5 text-cyan-200">
                    <IconShield />
                  </span>
                  <span>
                    <strong className="font-semibold text-white">No call recording:</strong> recording is off by default.
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-200">
                  <span className="mt-0.5 text-cyan-200">
                    <IconStack />
                  </span>
                  <span>
                    <strong className="font-semibold text-white">Minimal retention posture:</strong> keep only what sessions need.
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-200">
                  <span className="mt-0.5 text-cyan-200">
                    <IconMask />
                  </span>
                  <span>
                    <strong className="font-semibold text-white">User-controlled identity:</strong> masks are chosen per context.
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-200">
                  <span className="mt-0.5 text-cyan-200">
                    <IconBolt />
                  </span>
                  <span>
                    <strong className="font-semibold text-white">Clear media permissions:</strong> voice, video, and screen share
                    controls are explicit.
                  </span>
                </li>
              </ul>
            </div>

            <MockPanel title="Privacy Control Surface" subtitle="Session-level signals" badgeLabel="Recording Off" badgeTone="privacy">
              <div className="space-y-2">
                <div className="rounded-lg border border-slate-700/70 bg-slate-900/80 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Call Policy</p>
                  <p className="mt-1 text-sm text-white">Recording disabled</p>
                </div>
                <div className="rounded-lg border border-slate-700/70 bg-slate-900/80 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Retention</p>
                  <p className="mt-1 text-sm text-white">Minimal operational metadata</p>
                </div>
                <div className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100">
                  Permissions shown before mic/cam/share actions.
                </div>
              </div>
            </MockPanel>
          </div>
        </Section>

        <Section
          id="pro"
          eyebrow="Masq Pro"
          title="Gamer-grade control, still privacy-forward"
          subtitle="Upgrade clarity and expression without introducing recording."
          className="scroll-mt-24 pt-16 sm:pt-20"
        >
          <div className="rounded-2xl border border-cyan-300/35 bg-gradient-to-br from-cyan-300/12 to-emerald-300/10 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-100">Coming soon</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Masq Pro</h3>
                <p className="mt-2 text-sm text-slate-100">
                  For power users who want finer RTC control, stronger layout options, and premium identity cosmetics.
                </p>
                <CTAButton href="mailto:pro@masq.local" variant="live" className="mt-5 min-w-[190px]">
                  Get Pro (Coming soon)
                </CTAButton>
              </div>
              <ul className="space-y-2 text-sm text-slate-100">
                <li className="rounded-xl border border-cyan-300/25 bg-slate-950/35 px-3 py-2">
                  Advanced layouts: pin and multi-pin participant views
                </li>
                <li className="rounded-xl border border-cyan-300/25 bg-slate-950/35 px-3 py-2">
                  Screen share tuning: FPS, quality, cursor highlight
                </li>
                <li className="rounded-xl border border-cyan-300/25 bg-slate-950/35 px-3 py-2">
                  Advanced audio: per-participant volume controls
                </li>
                <li className="rounded-xl border border-cyan-300/25 bg-slate-950/35 px-3 py-2">
                  Premium aura styles: visual cosmetics only
                </li>
              </ul>
            </div>
          </div>
        </Section>

        <Section className="pt-16 sm:pt-20">
          <div className="rounded-3xl border border-cyan-300/35 bg-gradient-to-br from-cyan-300/12 to-emerald-300/10 p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">Ready to run cleaner, faster comms?</h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-200 sm:text-base">
              Launch your crew space, pick your mask, and keep call control in your hands.
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
                Terms
              </a>
              <a href="#" className="hover:text-white">
                Privacy
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
