import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/index.css';
import { Logo } from '../ui/components';
import { sendMessage } from '../modules/messaging';
import { STORAGE_KEYS } from '../modules/types';

// URL params present for both sources:
//   DNR redirect:   ?host=instagram.com          (goal not in URL — read from storage)
//   SPA fallback:   ?host=...&goal=...&reason=... (full params from guard.ts)
const params = new URLSearchParams(location.search);
const host = params.get('host') ?? 'this site';
const goalParam = params.get('goal');   // null when arriving via DNR
const reason = params.get('reason') ?? 'On your block list';

function goBack() {
  if (window.history.length > 1) window.history.back();
  else location.replace(chrome.runtime.getURL('src/dashboard/index.html'));
}

function Blocked() {
  // Goal may come from the URL (SPA guard fallback) or must be loaded from
  // storage (DNR redirect doesn't encode the session goal in the URL).
  const [goal, setGoal] = useState(goalParam ?? '');

  useEffect(() => {
    if (!goalParam) {
      chrome.storage.local.get(STORAGE_KEYS.currentSession, (res) => {
        const session = res[STORAGE_KEYS.currentSession];
        if (session?.goal) setGoal(session.goal as string);
      });
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-ink-950 to-ink-900 px-6">
      <div className="animate-fade-in w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/10">
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15">
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-rose-500/30" />
            <Logo size={34} />
          </span>
        </div>

        <h1 className="text-2xl font-bold text-white">Let's stay on course</h1>
        <p className="mt-2 text-sm text-slate-400">
          <span className="font-semibold text-rose-300">{host}</span> is blocked during your focus
          session.
        </p>
        <p className="mt-1 text-xs text-slate-600">{reason}</p>

        {goal && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-ink-800/60 px-5 py-4">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              You're focusing on
            </div>
            <div className="mt-1 text-lg font-semibold text-beacon-200">{goal}</div>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <button className="btn-primary w-full" onClick={goBack}>
            ← Back to focus
          </button>
          <button
            className="text-xs text-slate-500 hover:text-slate-300"
            onClick={async () => {
              await sendMessage({ type: 'END_SESSION', payload: { reason: 'cancelled' } });
              goBack();
            }}
          >
            End my session instead
          </button>
        </div>

        <p className="mt-8 text-xs text-slate-600">
          The internet isn't the enemy — losing sight of your purpose is.
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Blocked />
  </React.StrictMode>
);
