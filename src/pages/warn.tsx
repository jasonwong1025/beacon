import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/index.css';
import { Logo } from '../ui/components';
import { sendMessage } from '../modules/messaging';
import {
  DEFAULT_SETTINGS,
  DEFAULT_WARN_CONFIRM_PHRASE,
  STORAGE_KEYS,
  type Settings,
} from '../modules/types';

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

function phraseMatches(typed: string, expected: string): boolean {
  return typed.trim() === expected.trim();
}

function Warn() {
  const [tabId, setTabId] = useState<number | null>(null);
  const [intent, setIntent] = useState<string | null>(null);
  const [typedPhrase, setTypedPhrase] = useState('');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SETTINGS.warnFriction.countdownSeconds);

  const friction = settings.warnFriction;
  const expectedPhrase = friction.confirmPhrase.trim() || DEFAULT_WARN_CONFIRM_PHRASE;
  const countdownTotal = Math.max(0, Math.min(120, friction.countdownSeconds));

  useEffect(() => {
    chrome.tabs.getCurrent().then((t) => setTabId(t?.id ?? null));
    chrome.storage.local.get(STORAGE_KEYS.settings, (res) => {
      const stored = res[STORAGE_KEYS.settings] as Settings | undefined;
      if (!stored) return;
      const merged: Settings = {
        ...DEFAULT_SETTINGS,
        ...stored,
        warnFriction: { ...DEFAULT_SETTINGS.warnFriction, ...stored.warnFriction },
      };
      setSettings(merged);
      setSecondsLeft(Math.max(0, merged.warnFriction.countdownSeconds));
    });
  }, []);

  // Countdown before Continue unlocks.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const countdownDone = countdownTotal === 0 || secondsLeft <= 0;
  const intentOk = !wantsIntent || intent !== null;
  const phraseOk = !friction.phraseConfirm || phraseMatches(typedPhrase, expectedPhrase);

  const canContinue = intentOk && countdownDone && phraseOk;

  const continueHint = useMemo(() => {
    const parts: string[] = [];
    if (!countdownDone) parts.push(`wait ${secondsLeft}s`);
    if (wantsIntent && !intentOk) parts.push('pick your intent');
    if (friction.phraseConfirm && !phraseOk) parts.push('type the confirmation phrase');
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [countdownDone, secondsLeft, wantsIntent, intentOk, friction.phraseConfirm, phraseOk]);

  const proceed = async () => {
    if (!canContinue) return;
    if (tabId == null) {
      location.replace(target);
      return;
    }
    await sendMessage({
      type: 'CONTINUE_PAST_WARNING',
      payload: { url: target, tabId, domain: host, intent: intent ?? undefined },
    });
  };

  const countdownPct =
    countdownTotal > 0 ? ((countdownTotal - secondsLeft) / countdownTotal) * 100 : 100;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-ink-950 to-ink-900 px-6 py-10">
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

        {/* Countdown friction */}
        {countdownTotal > 0 && !countdownDone && (
          <div className="mt-6 text-left">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span>Pause before continuing</span>
              <span className="font-mono tabular-nums text-distract">{secondsLeft}s</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-distract transition-all duration-1000 ease-linear"
                style={{ width: `${countdownPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Phrase confirmation friction */}
        {friction.phraseConfirm && (
          <div className="mt-6 text-left">
            <label className="label" htmlFor="confirm-phrase">
              Type this to confirm you're choosing to continue
            </label>
            <p className="mb-2 rounded-lg border border-white/10 bg-ink-900/80 px-3 py-2 font-mono text-xs leading-relaxed text-slate-400">
              {expectedPhrase}
            </p>
            <input
              id="confirm-phrase"
              className="input text-sm"
              placeholder="Type the phrase exactly"
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            {typedPhrase.length > 0 && !phraseOk && (
              <p className="mt-1.5 text-xs text-rose-400/90">Must match exactly (including punctuation).</p>
            )}
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <button className="btn-primary flex-1" onClick={goBack}>
            ← Return
          </button>
          <button
            className="btn-ghost flex-1"
            onClick={proceed}
            disabled={!canContinue}
            title={continueHint ?? undefined}
          >
            {!countdownDone ? `Continue (${secondsLeft})` : 'Continue anyway'}
          </button>
        </div>

        {continueHint && (
          <p className="mt-3 text-xs text-slate-600">To continue: {continueHint}</p>
        )}

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
