import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/index.css';
import { Logo } from '../ui/components';
import { sendMessage } from '../modules/messaging';

const params = new URLSearchParams(location.search);
const target = params.get('target') ?? '';
const host = params.get('host') ?? 'this site';
const goal = params.get('goal') ?? '';
const reason = params.get('reason') ?? 'On your warning list';
const wantsIntent = params.get('intent') === '1';

const INTENTS = [
  { id: 'work', label: 'Work', emoji: '💼' },
  { id: 'learning', label: 'Learning', emoji: '📚' },
  { id: 'research', label: 'Research', emoji: '🔬' },
  { id: 'personal', label: 'Personal', emoji: '🌿' },
] as const;

function goBack() {
  sendMessage({ type: 'RETURN_FROM_WARNING', payload: { tabId: -1 } }).catch(() => {});
  if (window.history.length > 1) window.history.back();
  else location.replace(chrome.runtime.getURL('src/dashboard/index.html'));
}

function Warn() {
  const [tabId, setTabId] = useState<number | null>(null);
  const [intent, setIntent] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(5);

  useEffect(() => {
    chrome.tabs.getCurrent().then((t) => setTabId(t?.id ?? null));
  }, []);

  // A short, intentional pause before "Continue" becomes available.
  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const canContinue = !wantsIntent || intent !== null;

  const proceed = async () => {
    if (tabId == null) {
      location.replace(target);
      return;
    }
    await sendMessage({
      type: 'CONTINUE_PAST_WARNING',
      payload: { url: target, tabId, domain: host, intent: intent ?? undefined },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-ink-950 to-ink-900 px-6">
      <div className="animate-fade-in w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-distract/10">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-distract/15">
            <Logo size={34} />
          </span>
        </div>

        <h1 className="text-2xl font-bold text-white">Quick check-in</h1>
        <p className="mt-2 text-sm text-slate-400">
          You're heading to <span className="font-semibold text-distract">{host}</span>.
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

        {wantsIntent && (
          <div className="mt-6 text-left">
            <div className="mb-2 text-sm font-medium text-slate-300">What are you here for?</div>
            <div className="grid grid-cols-2 gap-2">
              {INTENTS.map((i) => (
                <button
                  key={i.id}
                  onClick={() => setIntent(i.id)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    intent === i.id
                      ? 'border-beacon-500 bg-beacon-600/20 text-beacon-200'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <span className="mr-1.5">{i.emoji}</span>
                  {i.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <button className="btn-primary flex-1" onClick={goBack}>
            ← Return
          </button>
          <button
            className="btn-ghost flex-1"
            onClick={proceed}
            disabled={!canContinue || seconds > 0}
          >
            {seconds > 0 ? `Continue (${seconds})` : 'Continue anyway'}
          </button>
        </div>

        <p className="mt-8 text-xs text-slate-600">
          Beacon guides — it doesn't gatekeep. You're always in control.
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Warn />
  </React.StrictMode>
);
