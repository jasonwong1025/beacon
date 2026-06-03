import { useMemo, useState } from 'react';
import { Brand, ProgressRing } from '../ui/components';
import { useSession, useEvents, useHistory, useRules, useSettings, useNow } from '../ui/useStorage';
import { sendMessage } from '../modules/messaging';
import {
  SESSION_TYPES,
  type SessionType,
} from '../modules/types';
import {
  TIMER_PRESETS,
  formatDuration,
  remainingMs,
  elapsedMs,
  formatHm,
} from '../modules/session-engine';
import { buildDayOverview } from '../modules/analytics';

export function Popup() {
  const session = useSession();
  return (
    <div className="flex min-h-[480px] w-[380px] flex-col bg-ink-950 text-slate-200">
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <Brand />
        <button
          className="text-xs text-slate-400 hover:text-beacon-300"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          Dashboard ↗
        </button>
      </header>
      <main className="flex-1 p-4">
        {session && session.status !== 'completed' && session.status !== 'cancelled' ? (
          <ActiveSession />
        ) : (
          <SessionSetup />
        )}
      </main>
      <QuickStats />
    </div>
  );
}

function SessionSetup() {
  const [settings] = useSettings();
  const [goal, setGoal] = useState('');
  const [type, setType] = useState<SessionType>('work');
  const [duration, setDuration] = useState(50);
  const [customDuration, setCustomDuration] = useState('');
  const [pomodoro, setPomodoro] = useState(false);
  const [starting, setStarting] = useState(false);

  const start = async () => {
    const mins = customDuration ? Math.max(1, parseInt(customDuration, 10) || duration) : duration;
    setStarting(true);
    await sendMessage({
      type: 'START_SESSION',
      payload: {
        goal,
        type,
        durationMinutes: mins,
        pomodoro: pomodoro
          ? {
              enabled: true,
              focusMinutes: settings?.pomodoro.focusMinutes ?? 25,
              breakMinutes: settings?.pomodoro.breakMinutes ?? 5,
            }
          : undefined,
      },
    });
    setStarting(false);
    window.close();
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <label className="label" htmlFor="goal">What are you focusing on?</label>
        <input
          id="goal"
          className="input"
          placeholder="e.g. Build Flutter Portfolio App"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          autoFocus
        />
      </div>

      <div>
        <span className="label">Session type</span>
        <div className="grid grid-cols-3 gap-2">
          {SESSION_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`rounded-xl border px-2 py-2 text-xs font-medium transition ${
                type === t.value
                  ? 'border-beacon-500 bg-beacon-600/20 text-beacon-200'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              <span className="mr-1">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label">Duration</span>
        <div className="flex flex-wrap gap-2">
          {TIMER_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setDuration(p);
                setCustomDuration('');
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                duration === p && !customDuration
                  ? 'border-beacon-500 bg-beacon-600/20 text-beacon-200'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              {p}m
            </button>
          ))}
          <input
            type="number"
            min={1}
            placeholder="Custom"
            value={customDuration}
            onChange={(e) => setCustomDuration(e.target.value)}
            className="input w-20 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5">
        <span className="text-sm">
          <span className="font-medium text-slate-200">Pomodoro mode</span>
          <span className="ml-1 text-xs text-slate-500">
            {settings?.pomodoro.focusMinutes ?? 25}/{settings?.pomodoro.breakMinutes ?? 5}
          </span>
        </span>
        <input
          type="checkbox"
          checked={pomodoro}
          onChange={(e) => setPomodoro(e.target.checked)}
          className="h-4 w-4 accent-beacon-500"
        />
      </label>

      <button className="btn-primary w-full" onClick={start} disabled={starting}>
        Start focus session
      </button>
    </div>
  );
}

function ActiveSession() {
  const session = useSession();
  const now = useNow();
  if (!session) return null;

  const isBreak = session.status === 'break';
  const isPaused = session.status === 'paused';
  const remaining = remainingMs(session, now);
  const elapsed = elapsedMs(session, now);
  const totalMs = session.durationMinutes * 60_000;
  const progress = isBreak
    ? 1 - remaining / ((session.pomodoro?.breakMinutes ?? 5) * 60_000)
    : Math.min(1, elapsed / totalMs);

  const typeMeta = SESSION_TYPES.find((t) => t.value === session.type);

  return (
    <div className="animate-fade-in flex flex-col items-center">
      <div className="mb-1 flex items-center gap-2 text-xs">
        <span className={`chip ${isBreak ? 'bg-distract/20 text-distract' : 'bg-focus/20 text-focus'}`}>
          {isBreak ? '☕ Break' : isPaused ? '⏸ Paused' : '● Focusing'}
        </span>
        <span className="text-slate-500">
          {typeMeta?.emoji} {typeMeta?.label}
          {session.pomodoro?.enabled && ` · Round ${session.pomodoroRound}`}
        </span>
      </div>

      <ProgressRing
        progress={progress}
        color={isBreak ? '#f59e0b' : isPaused ? '#64748b' : '#3380fc'}
      >
        <span className="font-mono text-4xl font-bold tabular-nums text-white">
          {formatDuration(remaining)}
        </span>
        <span className="mt-1 text-xs text-slate-500">
          {isBreak ? 'until focus resumes' : `of ${session.durationMinutes}m`}
        </span>
      </ProgressRing>

      <div className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-center">
        <div className="text-[10px] uppercase tracking-wide text-slate-500">Goal</div>
        <div className="mt-0.5 text-sm font-semibold text-slate-100">
          {session.goal || 'Stay on course'}
        </div>
      </div>

      <div className="mt-4 grid w-full grid-cols-2 gap-2">
        {isBreak ? (
          <button className="btn-ghost col-span-2" onClick={() => sendMessage({ type: 'SKIP_BREAK' })}>
            Skip break →
          </button>
        ) : isPaused ? (
          <button className="btn-primary" onClick={() => sendMessage({ type: 'RESUME_SESSION' })}>
            Resume
          </button>
        ) : (
          <button className="btn-ghost" onClick={() => sendMessage({ type: 'PAUSE_SESSION' })}>
            Pause
          </button>
        )}
        {!isBreak && (
          <button
            className="btn-danger"
            onClick={() => sendMessage({ type: 'END_SESSION', payload: { reason: 'cancelled' } })}
          >
            End
          </button>
        )}
      </div>
    </div>
  );
}

function QuickStats() {
  const events = useEvents();
  const history = useHistory();
  const [rules] = useRules();

  const overview = useMemo(
    () => buildDayOverview(Date.now(), events, history, rules),
    [events, history, rules]
  );

  return (
    <footer className="grid grid-cols-3 gap-px border-t border-white/5 bg-white/5">
      <Stat label="Focus today" value={formatHm(overview.focusSeconds * 1000)} />
      <Stat label="Sessions" value={String(overview.sessionsCompleted)} />
      <Stat label="Focus ratio" value={`${Math.round(overview.focusRatio * 100)}%`} />
    </footer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink-950 px-3 py-2.5 text-center">
      <div className="text-sm font-bold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
