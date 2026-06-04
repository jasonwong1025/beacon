import { useState } from 'react';
import { normalizePattern } from '../modules/website-rules';
import type { CustomProfilePreset, RuleCategory } from '../modules/types';

const CATEGORY_META: Record<
  RuleCategory,
  { label: string; color: string; dot: string; placeholder: string }
> = {
  blocked: {
    label: 'Blocked',
    color: 'text-rose-300',
    dot: 'bg-rose-500',
    placeholder: 'e.g. tiktok.com',
  },
  warning: {
    label: 'Warning',
    color: 'text-distract',
    dot: 'bg-distract',
    placeholder: 'e.g. youtube.com',
  },
  allowed: {
    label: 'Allowed',
    color: 'text-focus',
    dot: 'bg-focus',
    placeholder: 'e.g. github.com',
  },
};

const CATEGORY_ORDER: RuleCategory[] = ['blocked', 'warning', 'allowed'];

interface Props {
  draft: CustomProfilePreset;
  isNew: boolean;
  onChange: (draft: CustomProfilePreset) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function CustomPresetEditor({ draft, isNew, onChange, onSave, onCancel }: Props) {
  const canSave = draft.label.trim().length > 0 && draft.emoji.trim().length > 0;

  return (
    <div className="animate-fade-in space-y-4 rounded-xl border border-beacon-500/30 bg-ink-900/60 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">
          {isNew ? 'Create custom preset' : 'Edit custom preset'}
        </h3>
        <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-300">
          ✕ Cancel
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Start with an empty site list and build a profile that fits your workflow.
      </p>

      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <label className="block">
          <span className="label">Icon</span>
          <input
            className="input w-16 text-center text-xl"
            value={draft.emoji}
            maxLength={4}
            onChange={(e) => onChange({ ...draft, emoji: e.target.value })}
            placeholder="✨"
            title="Emoji or short symbol"
          />
        </label>
        <label className="block">
          <span className="label">Title</span>
          <input
            className="input"
            value={draft.label}
            onChange={(e) => onChange({ ...draft, label: e.target.value })}
            placeholder="My Preset"
          />
        </label>
      </div>

      <label className="block">
        <span className="label">Tagline</span>
        <input
          className="input"
          value={draft.tagline}
          onChange={(e) => onChange({ ...draft, tagline: e.target.value })}
          placeholder="Short subtitle shown on the preset card"
        />
      </label>

      <label className="block">
        <span className="label">Description</span>
        <textarea
          className="input min-h-[72px] resize-y"
          value={draft.desc}
          onChange={(e) => onChange({ ...draft, desc: e.target.value })}
          placeholder="What is this preset for?"
        />
      </label>

      <div className="grid gap-3 lg:grid-cols-3">
        {CATEGORY_ORDER.map((category) => (
          <SiteListEditor
            key={category}
            category={category}
            sites={draft[category]}
            onChange={(sites) => onChange({ ...draft, [category]: sites })}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button className="btn-primary" onClick={onSave} disabled={!canSave}>
          {isNew ? 'Save preset' : 'Save changes'}
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function SiteListEditor({
  category,
  sites,
  onChange,
}: {
  category: RuleCategory;
  sites: string[];
  onChange: (sites: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const meta = CATEGORY_META[category];

  const add = () => {
    const host = normalizePattern(input);
    if (!host || sites.includes(host)) {
      setInput('');
      return;
    }
    onChange([...sites, host].sort((a, b) => a.localeCompare(b)));
    setInput('');
  };

  const remove = (host: string) => {
    onChange(sites.filter((s) => s !== host));
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className={`mb-2 text-xs font-semibold ${meta.color}`}>{meta.label}</div>
      <div className="mb-2 flex gap-1.5">
        <input
          className="input py-1.5 text-xs"
          placeholder={meta.placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        />
        <button
          type="button"
          className="btn-ghost shrink-0 px-2 py-1.5 text-xs"
          onClick={add}
          disabled={!input.trim()}
        >
          Add
        </button>
      </div>
      {sites.length === 0 ? (
        <p className="text-[11px] text-slate-600">No sites yet</p>
      ) : (
        <ul className="max-h-36 space-y-1 overflow-y-auto">
          {sites.map((s) => (
            <li key={s} className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
              <span className="min-w-0 flex-1 truncate">{s}</span>
              <button
                type="button"
                onClick={() => remove(s)}
                className="shrink-0 text-slate-600 hover:text-rose-400"
                aria-label={`Remove ${s}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
