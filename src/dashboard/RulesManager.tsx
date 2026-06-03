import { useState } from 'react';
import { useRules, useSettings } from '../ui/useStorage';
import { normalizePattern } from '../modules/website-rules';
import type { RuleCategory, WebsiteRule } from '../modules/types';

const CATEGORIES: {
  id: RuleCategory;
  title: string;
  desc: string;
  color: string;
  ring: string;
}[] = [
  {
    id: 'blocked',
    title: 'Blocked',
    desc: 'Hard stop during focus sessions.',
    color: 'text-rose-300',
    ring: 'border-rose-500/30 bg-rose-500/5',
  },
  {
    id: 'warning',
    title: 'Warning',
    desc: 'A gentle check-in before you continue.',
    color: 'text-distract',
    ring: 'border-distract/30 bg-distract/5',
  },
  {
    id: 'allowed',
    title: 'Allowed',
    desc: 'Always open, no interruption.',
    color: 'text-focus',
    ring: 'border-focus/30 bg-focus/5',
  },
];

export function RulesManager() {
  const [rules, setRules] = useRules();
  const [settings, setSettings] = useSettings();

  const addRule = async (category: RuleCategory, raw: string) => {
    const pattern = normalizePattern(raw);
    if (!pattern) return;
    // Remove any existing rule for the same host (a host has one category).
    const filtered = rules.filter((r) => r.pattern !== pattern);
    const rule: WebsiteRule = {
      id: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      pattern,
      category,
      createdAt: Date.now(),
    };
    await setRules([...filtered, rule]);
  };

  const removeRule = async (id: string) => {
    await setRules(rules.filter((r) => r.id !== id));
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Website Rules</h1>
        <p className="text-sm text-slate-500">
          Beacon guides rather than gatekeeps. Tune how each site behaves during a focus session.
        </p>
      </div>

      {settings && (
        <div className="card">
          <h2 className="mb-1 text-sm font-semibold text-slate-200">Smart Modes</h2>
          <p className="mb-3 text-xs text-slate-500">
            Keep useful pages open while taming the rabbit holes.
          </p>
          <div className="space-y-2">
            <Toggle
              label="Smart YouTube"
              hint="Allow /watch & search · warn on Shorts, feed & trending"
              checked={settings.smart.youtube}
              onChange={(v) =>
                setSettings({ ...settings, smart: { ...settings.smart, youtube: v } })
              }
            />
            <Toggle
              label="Smart Reddit"
              hint="Allow subreddits & search · warn on the popular feed"
              checked={settings.smart.reddit}
              onChange={(v) =>
                setSettings({ ...settings, smart: { ...settings.smart, reddit: v } })
              }
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {CATEGORIES.map((cat) => {
          const list = rules.filter((r) => r.category === cat.id).sort((a, b) =>
            a.pattern.localeCompare(b.pattern)
          );
          return (
            <div key={cat.id} className={`card border ${cat.ring}`}>
              <h2 className={`text-sm font-semibold ${cat.color}`}>{cat.title}</h2>
              <p className="mb-3 text-xs text-slate-500">{cat.desc}</p>
              <RuleInput onAdd={(v) => addRule(cat.id, v)} />
              <div className="mt-3 space-y-1.5">
                {list.length === 0 && (
                  <p className="py-2 text-xs text-slate-600">No sites yet.</p>
                )}
                {list.map((r) => (
                  <div
                    key={r.id}
                    className="group flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5"
                  >
                    <span className="truncate text-sm text-slate-200">{r.pattern}</span>
                    <button
                      onClick={() => removeRule(r.id)}
                      className="ml-2 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
                      aria-label={`Remove ${r.pattern}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RuleInput({ onAdd }: { onAdd: (value: string) => void }) {
  const [value, setValue] = useState('');
  const submit = () => {
    if (!value.trim()) return;
    onAdd(value);
    setValue('');
  };
  return (
    <div className="flex gap-2">
      <input
        className="input py-1.5 text-sm"
        placeholder="example.com"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <button className="btn-ghost px-3 py-1.5" onClick={submit}>
        Add
      </button>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5">
      <span>
        <span className="block text-sm font-medium text-slate-200">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-beacon-500"
      />
    </label>
  );
}
