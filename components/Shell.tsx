'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Database, FlaskConical, Gauge, Menu, MessageSquareText, Moon, Scale, ShieldCheck, Sun, UsersRound, X, ClipboardList } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HOSTED_EXAMPLE } from '@/lib/hosted';
import { setPreferredMode, type Mode } from '@/lib/mode';
import { PERSONA_IDS, PERSONAS } from '@/lib/personas';
import { useWorkforce } from '@/lib/workforce-data';

const REPO = 'https://github.com/sfc-gh-ooral/sfguide-workforce-intelligence';
const NAV = [
  { href: '/', label: 'Workforce overview', icon: Gauge },
  { href: '/attrition', label: 'Attrition risk', icon: UsersRound },
  { href: '/pay-equity', label: 'Pay equity', icon: Scale },
  { href: '/voice', label: 'Voice of employee', icon: BarChart3 },
  { href: '/ask', label: 'Ask HR data', icon: MessageSquareText },
  { href: '/decisions', label: 'Decisions log', icon: ClipboardList },
];

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-3 px-2">
      <span className="relative w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'var(--aurora)' }} aria-hidden>
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><circle cx="8" cy="8" r="3" /><circle cx="16" cy="9" r="2.4" /><path d="M3 19c.6-3 2.8-5 5-5s4.4 2 5 5M13.5 19c.4-2.2 1.6-3.8 3.2-3.8 1.7 0 2.9 1.6 3.3 3.8" /></svg>
      </span>
      <span className="leading-tight">
        <span className="block font-display text-[17px] font-semibold text-white">Workforce</span>
        <span className="block text-[11px] tracking-[.18em] uppercase" style={{ color: 'var(--rail-muted)' }}>Intelligence</span>
      </span>
    </Link>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    const saved = window.localStorage.getItem('wi-theme');
    const d = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(d); document.documentElement.dataset.theme = d ? 'dark' : 'light';
  }, []);
  if (dark === null) return null;
  const flip = () => { const d = !dark; setDark(d); document.documentElement.dataset.theme = d ? 'dark' : 'light'; window.localStorage.setItem('wi-theme', d ? 'dark' : 'light'); };
  return <button className="btn btn-ghost !p-2" onClick={flip} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>{dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>;
}

export function PersonaSwitch() {
  const { persona, setPersona } = useWorkforce();
  return (
    <div className="flex items-center gap-2">
      <span className="eyebrow hidden md:inline">View as</span>
      <div className="persona-switch" role="radiogroup" aria-label="View as persona">
        {PERSONA_IDS.map((id) => (
          <button key={id} role="radio" aria-checked={persona === id} onClick={() => setPersona(id)} title={PERSONAS[id].label}
            style={{ ['--pc' as string]: PERSONAS[id].color }}>
            <span className="persona-dot" aria-hidden /><span className="hidden sm:inline">{PERSONAS[id].label}</span><span className="sm:hidden">{PERSONAS[id].short}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ModeSwitch() {
  const { mode, configured } = useWorkforce();
  const [help, setHelp] = useState(false);
  if (!mode) return null;
  const choose = (next: Mode) => {
    if (next === mode) return;
    if (next === 'live' && !configured) { setHelp(true); return; }
    setPreferredMode(next); window.location.reload();
  };
  const live = mode === 'live';
  return (
    <>
      <div className={`mode-switch ${live ? 'is-live' : ''}`} role="radiogroup" aria-label="Data source">
        <button role="radio" aria-checked={!live} onClick={() => choose('sample')} title="Bundled synthetic data; AI answers are scripted samples"><FlaskConical className="w-3.5 h-3.5" aria-hidden />Sample</button>
        <button role="radio" aria-checked={live} onClick={() => choose('live')} title={configured ? 'Data and AI from your Snowflake account' : 'Needs a Snowflake connection'}>{live && <span className="mode-dot" aria-hidden />}<Database className="w-3.5 h-3.5" aria-hidden />Live</button>
      </div>
      {help && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,10,25,.6)' }} onClick={() => setHelp(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="live-help" className="card max-w-lg w-full p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto" style={{ background: 'var(--card-solid)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 id="live-help" className="font-display text-lg font-semibold">Connect Snowflake to use Live mode</h2>
              <button onClick={() => setHelp(false)} aria-label="Close" className="p-1"><X className="w-4 h-4" /></button>
            </div>
            {HOSTED_EXAMPLE ? (
              <p className="text-sm" style={{ color: 'var(--ink-2)' }}>This hosted example runs only on synthetic data in your browser. To use Live mode, clone the{' '}
                <a className="underline" href={REPO} target="_blank" rel="noreferrer">repository</a> and follow{' '}
                <a className="underline" href={`${REPO}#live-mode-deploy-to-your-account`} target="_blank" rel="noreferrer">&ldquo;Live mode: deploy to your account&rdquo;</a> in the README.</p>
            ) : (
              <div className="text-sm space-y-3" style={{ color: 'var(--ink-2)' }}>
                <p>No Snowflake connection is configured on this server. For security, the app doesn&apos;t take credentials in the browser. Set them up once on the machine running the app:</p>
                <ol className="list-decimal pl-5 space-y-1.5">
                  <li>Run <code>sql/setup.sql</code> in a Snowsight worksheet as ACCOUNTADMIN.</li>
                  <li>Create a key pair outside the repository and register the public key on your user.</li>
                  <li>Copy <code>.env.example</code> to <code>.env.local</code> and fill in:</li>
                </ol>
                <pre className="text-xs rounded-xl p-3 overflow-x-auto" style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}>{`SNOWFLAKE_ACCOUNT=<orgname>-<account_name>
SNOWFLAKE_USERNAME=<YOUR_USER>
SNOWFLAKE_PRIVATE_KEY_PATH=/absolute/path/to/workforce_key.p8`}</pre>
                <p>Then restart with <code>npm run dev</code> and switch to Live. <a className="underline" href={`${REPO}#live-mode-deploy-to-your-account`} target="_blank" rel="noreferrer">Full guide</a></p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Which policies the current persona's view passes through. Shown at the top of every screen.
export function PolicyStrip() {
  const { persona } = useWorkforce();
  const p = PERSONAS[persona];
  const items = persona === 'hrbp'
    ? ['Row access policy: Operations only', 'Masking policy applied: pay in $10k bands', 'Protected attributes masked']
    : persona === 'comp'
      ? ['Row access policy: all business units', 'Full pay detail', 'Protected attributes visible for equity analysis']
      : ['Aggregation policy: minimum group size 10', 'Small-cell masking on pay gaps', 'No row-level records'];
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px] mb-5 fade-up">
      <span className="chip" style={{ borderColor: p.color, color: p.color }}><ShieldCheck className="w-3.5 h-3.5" aria-hidden />Viewing as {p.label} · {p.role}</span>
      {items.map((t) => <span key={t} className="chip chip-policy">{t}</span>)}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 fade-up">
      <div className="eyebrow mb-2">{eyebrow}</div>
      <h1 className="font-display text-[30px] md:text-[36px] font-semibold leading-[1.1]">{title}</h1>
      {children && <p className="mt-2 max-w-3xl text-[14.5px]" style={{ color: 'var(--ink-2)' }}>{children}</p>}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href) || (href === '/attrition' && path.startsWith('/team')));
  // Below lg the rail is hidden and the nav opens from a menu button in the header.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  useEffect(() => { setMenuOpen(false); }, [path]);
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector('a')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenuOpen(false); menuBtn.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="rail hidden lg:flex flex-col gap-6 p-4 sticky top-0 h-screen">
        <div className="pt-2"><Wordmark /></div>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`rail-link ${active(href) ? 'active' : ''}`}><Icon className="w-[18px] h-[18px]" aria-hidden />{label}</Link>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl p-3 text-[11.5px] leading-relaxed" style={{ background: 'rgba(255,255,255,.05)', color: 'var(--rail-muted)' }}>
          <div className="aurora-bar mb-2 w-10" />
          Synthetic data as of Oct 31, 2026. Risk scores are illustrative and aren&apos;t for decisions about individual employees.
        </div>
      </aside>
      <div className="min-w-0 flex flex-col max-lg:overflow-x-clip">
        <header className="lg:sticky top-0 z-30 lg:backdrop-blur-md border-b" style={{ background: 'color-mix(in srgb, var(--bg) 82%, transparent)', borderColor: 'var(--line)' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-8 py-3">
            <div className="lg:hidden flex w-full items-center justify-between gap-3">
              <div className="rail rounded-xl px-2 py-1.5"><Wordmark /></div>
              <button ref={menuBtn} className="btn btn-ghost !p-2" onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen} aria-controls="mobile-nav" aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
            <PersonaSwitch />
            <div className="flex items-center gap-2"><ModeSwitch /><ThemeToggle /></div>
          </div>
          <nav ref={menuRef} id="mobile-nav" hidden={!menuOpen} className="rail lg:hidden flex-col gap-1 p-3 [&:not([hidden])]:flex" aria-label="Main">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setMenuOpen(false)} aria-current={active(href) ? 'page' : undefined}
                className={`rail-link ${active(href) ? 'active' : ''}`}><Icon className="w-[18px] h-[18px]" aria-hidden />{label}</Link>
            ))}
          </nav>
        </header>
        <main className="canvas flex-1 min-w-0 px-4 md:px-8 py-6 md:py-8 max-w-[1400px] w-full">{children}</main>
        <footer className="px-4 md:px-8 py-5 text-[11.5px] border-t" style={{ color: 'var(--muted)', borderColor: 'var(--line)' }}>
          Illustrative example on synthetic data. Logic is simplified and not production-ready. This isn&apos;t HR, legal, regulatory, or compliance advice, and risk scores must not be used for decisions about individual employees. Not an official Snowflake product and not supported by Snowflake Support.
        </footer>
      </div>
    </div>
  );
}
