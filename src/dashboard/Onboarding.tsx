import { useState } from 'react';
import { Logo } from '../ui/components';
import { PROFILE_PRESETS, rulesForProfile, type UserProfile } from '../modules/types';
import { storage } from '../modules/storage';

interface Props {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: Props) {
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    if (!selected) return;
    setSaving(true);
    const settings = await storage.getSettings();
    await Promise.all([
      storage.setRules(rulesForProfile(selected)),
      storage.setSettings({ ...settings, userProfile: selected }),
    ]);
    onComplete();
  };

  const preset = selected ? PROFILE_PRESETS.find((p) => p.id === selected) : null;

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-b from-ink-950 via-ink-900 to-ink-950 px-6 py-12">
      {/* Header */}
      <div className="mb-10 flex flex-col items-center text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <Logo size={36} />
          <span className="text-3xl font-bold text-white">Beacon</span>
        </div>
        <h1 className="text-xl font-semibold text-white">Welcome. Let's set you up.</h1>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          Choose what best describes how you use the browser. Beacon will pre-fill a sensible
          set of rules — you can tweak anything afterwards.
        </p>
      </div>

      {/* Profile grid */}
      <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROFILE_PRESETS.map((p) => {
          const active = selected === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`group relative flex flex-col gap-2 rounded-2xl border p-5 text-left transition-all duration-150 ${
                active
                  ? 'border-beacon-500 bg-beacon-600/15 shadow-lg shadow-beacon-500/10'
                  : 'border-white/10 bg-ink-800/50 hover:border-white/20 hover:bg-ink-800'
              }`}
            >
              {active && (
                <span className="absolute right-3.5 top-3.5 flex h-5 w-5 items-center justify-center rounded-full bg-beacon-500 text-[11px] text-white">
                  ✓
                </span>
              )}
              <span className="text-3xl leading-none">{p.emoji}</span>
              <span className="text-sm font-bold text-white">{p.label}</span>
              <span className="text-xs leading-relaxed text-slate-400">{p.tagline}</span>

              {/* Rule preview pills */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.blocked.slice(0, 2).map((s) => (
                  <span key={s} className="chip bg-rose-500/15 text-rose-300">
                    ⛔ {s}
                  </span>
                ))}
                {p.allowed.slice(0, 2).map((s) => (
                  <span key={s} className="chip bg-focus/15 text-focus">
                    ✅ {s}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected summary */}
      {preset && (
        <div className="mt-6 w-full max-w-3xl animate-fade-in rounded-2xl border border-beacon-500/20 bg-ink-800/60 p-5">
          <p className="mb-3 text-sm text-slate-300">{preset.desc}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <RuleGroup
              label="Blocked"
              color="text-rose-300"
              dot="bg-rose-500"
              items={preset.blocked}
            />
            <RuleGroup
              label="Warning"
              color="text-distract"
              dot="bg-distract"
              items={preset.warning}
            />
            <RuleGroup
              label="Allowed"
              color="text-focus"
              dot="bg-focus"
              items={preset.allowed}
            />
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <button
          className="btn-primary min-w-[220px] py-3 text-base disabled:opacity-40"
          disabled={!selected || saving}
          onClick={confirm}
        >
          {saving ? 'Setting up…' : selected ? `Get started as ${preset?.label} →` : 'Pick a profile to continue'}
        </button>
        <p className="text-xs text-slate-600">
          You can change or fine-tune any rule in Website Rules at any time.
        </p>
      </div>
    </div>
  );
}

function RuleGroup({
  label,
  color,
  dot,
  items,
}: {
  label: string;
  color: string;
  dot: string;
  items: string[];
}) {
  return (
    <div>
      <div className={`mb-1.5 text-xs font-semibold ${color}`}>{label}</div>
      <ul className="space-y-1">
        {items.map((s) => (
          <li key={s} className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
