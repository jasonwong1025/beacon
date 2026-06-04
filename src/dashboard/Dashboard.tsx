import { useState } from 'react';
import { Brand, GitHubIcon, GITHUB_REPO_URL } from '../ui/components';
import { Overview } from './Overview';
import { RulesManager } from './RulesManager';
import { Reports } from './Reports';
import { SettingsPanel } from './SettingsPanel';
import { Onboarding } from './Onboarding';
import { useSession, useSettings } from '../ui/useStorage';
import { remainingMs, formatDuration } from '../modules/session-engine';
import { useNow } from '../ui/useStorage';

type Tab = 'overview' | 'rules' | 'reports' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'rules', label: 'Website Rules', icon: '🛡️' },
  { id: 'reports', label: 'Reports', icon: '📈' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function Dashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const [settings] = useSettings();

  // Show onboarding for fresh installs (userProfile === null).
  // settings is null while storage is loading — render nothing to avoid flicker.
  if (!settings) return null;
  if (settings.userProfile === null) {
    // onComplete is a no-op: useSettings subscribes to storage, so when
    // Onboarding writes userProfile the Dashboard rerenders automatically.
    return <Onboarding onComplete={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      <div className="mx-auto flex max-w-5xl gap-6 px-6 py-8">
        <aside className="sticky top-8 hidden h-fit w-52 shrink-0 flex-col gap-1 md:flex">
          <div className="mb-4">
            <Brand />
          </div>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-beacon-600/20 text-beacon-200'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
          <SessionBadge />
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
          >
            <GitHubIcon size={14} />
            GitHub
          </a>
        </aside>

        <main className="min-w-0 flex-1">
          {/* Mobile tabs */}
          <div className="mb-5 flex gap-1 overflow-x-auto md:hidden">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
                  tab === t.id ? 'bg-beacon-600/20 text-beacon-200' : 'text-slate-400'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && <Overview />}
          {tab === 'rules' && <RulesManager />}
          {tab === 'reports' && <Reports />}
          {tab === 'settings' && <SettingsPanel />}
        </main>
      </div>

      <footer className="mx-auto max-w-5xl px-6 pb-8 pt-2 md:hidden">
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs text-slate-600 transition hover:text-slate-400"
        >
          <GitHubIcon size={14} />
          View on GitHub
        </a>
      </footer>
    </div>
  );
}

function SessionBadge() {
  const session = useSession();
  const now = useNow();
  if (!session || (session.status !== 'active' && session.status !== 'break' && session.status !== 'paused'))
    return null;

  return (
    <div className="mt-4 rounded-xl border border-beacon-500/30 bg-beacon-600/10 p-3">
      <div className="text-[10px] uppercase tracking-wide text-beacon-300">
        {session.status === 'break' ? 'On break' : session.status === 'paused' ? 'Paused' : 'Focusing'}
      </div>
      <div className="mt-1 font-mono text-xl font-bold tabular-nums text-white">
        {formatDuration(remainingMs(session, now))}
      </div>
      <div className="mt-1 truncate text-xs text-slate-400" title={session.goal}>
        {session.goal || 'Stay on course'}
      </div>
    </div>
  );
}
