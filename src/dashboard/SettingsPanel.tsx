import { useState } from 'react';
import { useSettings, useCustomPresets } from '../ui/useStorage';
import { storage } from '../modules/storage';
import { exportJSON, exportCSV } from '../modules/analytics';
import { resolvePreset } from '../modules/types';

export function SettingsPanel() {
  const [settings, setSettings] = useSettings();
  const [customPresets] = useCustomPresets();
  const [cleared, setCleared] = useState(false);

  if (!settings) return null;

  const download = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportData = async (format: 'json' | 'csv') => {
    const [events, history] = await Promise.all([storage.getEvents(), storage.getHistory()]);
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'json') {
      download(exportJSON({ events, history }), `beacon-${stamp}.json`, 'application/json');
    } else {
      download(exportCSV(history), `beacon-sessions-${stamp}.csv`, 'text/csv');
    }
  };

  const clearAll = async () => {
    if (!confirm('Erase all Beacon data (sessions, events, rules, settings)? This cannot be undone.'))
      return;
    await storage.clearAll();
    setCleared(true);
    setTimeout(() => location.reload(), 800);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-500">Tune Beacon to fit how you work.</p>
      </div>

      {settings.userProfile && (
        <section className="card space-y-2">
          <h2 className="text-sm font-semibold text-slate-200">Your Profile</h2>
          {(() => {
            const p = resolvePreset(settings.userProfile, customPresets);
            return p ? (
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{p.emoji}</span>
                  <div>
                    <div className="text-sm font-semibold text-white">{p.label}</div>
                    <div className="text-xs text-slate-500">{p.tagline || p.desc}</div>
                  </div>
                </div>
                <span className="text-xs text-slate-500">
                  Change in{' '}
                  <span className="text-slate-400">Website Rules → Switch profile</span>
                </span>
              </div>
            ) : null;
          })()}
        </section>
      )}

      <section className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Pomodoro</h2>
        <Toggle
          label="Enable Pomodoro by default"
          hint="New sessions can alternate focus and break automatically."
          checked={settings.pomodoro.enabled}
          onChange={(v) =>
            setSettings({ ...settings, pomodoro: { ...settings.pomodoro, enabled: v } })
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Focus minutes"
            value={settings.pomodoro.focusMinutes}
            min={1}
            onChange={(v) =>
              setSettings({ ...settings, pomodoro: { ...settings.pomodoro, focusMinutes: v } })
            }
          />
          <NumberField
            label="Break minutes"
            value={settings.pomodoro.breakMinutes}
            min={1}
            onChange={(v) =>
              setSettings({ ...settings, pomodoro: { ...settings.pomodoro, breakMinutes: v } })
            }
          />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Interventions</h2>
        <Toggle
          label="Intent check on warning sites"
          hint='Ask "What are you here for?" before continuing.'
          checked={settings.intentCheck}
          onChange={(v) => setSettings({ ...settings, intentCheck: v })}
        />
        <Toggle
          label="Desktop notifications"
          hint="Session start/end, breaks, and gentle drift nudges."
          checked={settings.notificationsEnabled}
          onChange={(v) => setSettings({ ...settings, notificationsEnabled: v })}
        />
        <NumberField
          label="Drift reminder after (minutes)"
          value={settings.driftReminderMinutes}
          min={1}
          onChange={(v) => setSettings({ ...settings, driftReminderMinutes: v })}
        />
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Your Data</h2>
        <p className="text-xs text-slate-500">
          Everything stays on this device. No account, no tracking, no cloud. Export anytime.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => exportData('json')}>
            Export JSON
          </button>
          <button className="btn-ghost" onClick={() => exportData('csv')}>
            Export CSV
          </button>
        </div>
      </section>

      <section className="card space-y-3 border border-rose-500/20">
        <h2 className="text-sm font-semibold text-rose-300">Danger Zone</h2>
        <p className="text-xs text-slate-500">Permanently erase all locally stored Beacon data.</p>
        <button className="btn-danger" onClick={clearAll} disabled={cleared}>
          {cleared ? 'Cleared — reloading…' : 'Clear all data'}
        </button>
      </section>

      <p className="pb-6 text-center text-xs text-slate-600">
        Beacon · Stay on course. Work with intention.
      </p>
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
      <span className="pr-4">
        <span className="block text-sm font-medium text-slate-200">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-beacon-500"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, parseInt(e.target.value, 10) || min))}
        className="input"
      />
    </label>
  );
}
