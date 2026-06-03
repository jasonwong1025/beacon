import { useEffect, useMemo, useState } from 'react';
import { useRules, useSettings } from '../ui/useStorage';
import { normalizePattern, hostFromUrl } from '../modules/website-rules';
import { DEFAULT_RULES, type RuleCategory, type WebsiteRule } from '../modules/types';

const CATEGORY_META: Record<
  RuleCategory,
  { label: string; short: string; icon: string; desc: string; text: string; dot: string; active: string }
> = {
  blocked: {
    label: 'Blocked',
    short: 'Block',
    icon: '⛔',
    desc: 'Hard stop during focus sessions.',
    text: 'text-rose-300',
    dot: 'bg-rose-500',
    active: 'border-rose-500/50 bg-rose-500/20 text-rose-200',
  },
  warning: {
    label: 'Warning',
    short: 'Warn',
    icon: '⚠️',
    desc: 'A gentle check-in before you continue.',
    text: 'text-distract',
    dot: 'bg-distract',
    active: 'border-distract/50 bg-distract/20 text-distract',
  },
  allowed: {
    label: 'Allowed',
    short: 'Allow',
    icon: '✅',
    desc: 'Always open, no interruption.',
    text: 'text-focus',
    dot: 'bg-focus',
    active: 'border-focus/50 bg-focus/20 text-focus',
  },
};

const CATEGORY_ORDER: RuleCategory[] = ['blocked', 'warning', 'allowed'];

const COMMON_DISTRACTIONS = [
  'instagram.com',
  'tiktok.com',
  'facebook.com',
  'x.com',
  'reddit.com',
  'youtube.com',
  'netflix.com',
  'twitch.tv',
  'pinterest.com',
  '9gag.com',
  'news.ycombinator.com',
  'amazon.com',
];

type Filter = 'all' | RuleCategory;

const newId = () =>
  `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export function RulesManager() {
  const [rules, setRules] = useRules();
  const [settings, setSettings] = useSettings();

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [draftCategory, setDraftCategory] = useState<RuleCategory>('blocked');
  const [openHosts, setOpenHosts] = useState<string[]>([]);

  // Pull domains from currently open tabs so suggestions reflect real usage.
  useEffect(() => {
    chrome.tabs
      .query({})
      .then((tabs) => {
        const hosts = new Set<string>();
        for (const t of tabs) {
          const h = t.url ? hostFromUrl(t.url) : null;
          if (h) hosts.add(h);
        }
        setOpenHosts([...hosts]);
      })
      .catch(() => setOpenHosts([]));
  }, []);

  /** Add or move one-or-more hosts into a category (dedupes, keeps id/createdAt). */
  const upsert = async (patterns: string[], category: RuleCategory) => {
    const clean = patterns.map(normalizePattern).filter(Boolean);
    if (clean.length === 0) return;
    const map = new Map(rules.map((r) => [r.pattern, r] as const));
    for (const pattern of clean) {
      const existing = map.get(pattern);
      map.set(pattern, {
        id: existing?.id ?? newId(),
        pattern,
        category,
        createdAt: existing?.createdAt ?? Date.now(),
      });
    }
    await setRules([...map.values()]);
  };

  const setCategory = async (id: string, category: RuleCategory) => {
    await setRules(rules.map((r) => (r.id === id ? { ...r, category } : r)));
  };

  const removeRule = async (id: string) => {
    await setRules(rules.filter((r) => r.id !== id));
  };

  const resetDefaults = async () => {
    if (!confirm('Replace your current rules with Beacon’s defaults?')) return;
    await setRules(DEFAULT_RULES.map((r) => ({ ...r, createdAt: Date.now() })));
  };

  const counts = useMemo(() => {
    const c = { all: rules.length, blocked: 0, warning: 0, allowed: 0 };
    for (const r of rules) c[r.category] += 1;
    return c;
  }, [rules]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rules
      .filter((r) => (filter === 'all' ? true : r.category === filter))
      .filter((r) => (q ? r.pattern.includes(q) : true))
      .sort((a, b) => {
        const byCat = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
        return byCat !== 0 ? byCat : a.pattern.localeCompare(b.pattern);
      });
  }, [rules, filter, query]);

  const existingPatterns = useMemo(() => new Set(rules.map((r) => r.pattern)), [rules]);
  const openSuggestions = openHosts.filter((h) => !existingPatterns.has(h)).slice(0, 10);
  const commonSuggestions = COMMON_DISTRACTIONS.filter((h) => !existingPatterns.has(h));

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Website Rules</h1>
          <p className="text-sm text-slate-500">
            Beacon guides rather than gatekeeps. Tune how each site behaves during a focus session.
          </p>
        </div>
        <button
          onClick={resetDefaults}
          className="text-xs text-slate-500 transition hover:text-slate-300"
        >
          Reset to defaults
        </button>
      </div>

      {settings && (
        <div className="card">
          <h2 className="mb-1 text-sm font-semibold text-slate-200">Smart Modes</h2>
          <p className="mb-3 text-xs text-slate-500">
            Keep useful pages open while taming the rabbit holes.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
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

      {/* Add bar */}
      <AddBar
        draftCategory={draftCategory}
        onDraftCategory={setDraftCategory}
        onAdd={(raw) => upsert(raw.split(/[\s,]+/), draftCategory)}
      />

      {/* Suggestions */}
      {(openSuggestions.length > 0 || commonSuggestions.length > 0) && (
        <div className="card space-y-3">
          {openSuggestions.length > 0 && (
            <Suggestions
              title="From your open tabs"
              hint={`adds as “${CATEGORY_META[draftCategory].label}”`}
              hosts={openSuggestions}
              meta={CATEGORY_META[draftCategory]}
              onPick={(h) => upsert([h], draftCategory)}
            />
          )}
          {commonSuggestions.length > 0 && (
            <Suggestions
              title="Common distractions"
              hint={`adds as “${CATEGORY_META[draftCategory].label}”`}
              hosts={commonSuggestions}
              meta={CATEGORY_META[draftCategory]}
              onPick={(h) => upsert([h], draftCategory)}
            />
          )}
        </div>
      )}

      {/* List + toolbar */}
      <div className="card">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            <FilterChip label="All" count={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} />
            {CATEGORY_ORDER.map((c) => (
              <FilterChip
                key={c}
                label={CATEGORY_META[c].label}
                count={counts[c]}
                dot={CATEGORY_META[c].dot}
                active={filter === c}
                onClick={() => setFilter(c)}
              />
            ))}
          </div>
          <div className="relative ml-auto w-full sm:w-56">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">⌕</span>
            <input
              className="input py-1.5 pl-8 text-sm"
              placeholder="Search sites"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-600">
            {rules.length === 0
              ? 'No rules yet — add a site above to get started.'
              : 'No sites match your search.'}
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {visible.map((r) => (
              <RuleRow
                key={r.id}
                rule={r}
                onSetCategory={(c) => setCategory(r.id, c)}
                onRemove={() => removeRule(r.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AddBar({
  draftCategory,
  onDraftCategory,
  onAdd,
}: {
  draftCategory: RuleCategory;
  onDraftCategory: (c: RuleCategory) => void;
  onAdd: (raw: string) => void;
}) {
  const [value, setValue] = useState('');
  const submit = () => {
    if (!value.trim()) return;
    onAdd(value);
    setValue('');
  };
  return (
    <div className="card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="input flex-1"
          placeholder="Add a site — e.g. instagram.com (separate several with spaces or commas)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <div className="flex items-center gap-2">
          <CategorySwitch value={draftCategory} onChange={onDraftCategory} />
          <button className="btn-primary px-4 py-2" onClick={submit} disabled={!value.trim()}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function RuleRow({
  rule,
  onSetCategory,
  onRemove,
}: {
  rule: WebsiteRule;
  onSetCategory: (c: RuleCategory) => void;
  onRemove: () => void;
}) {
  return (
    <li className="group flex items-center gap-3 py-2.5">
      <Avatar domain={rule.pattern} />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{rule.pattern}</span>
      <CategorySwitch value={rule.category} onChange={onSetCategory} />
      <button
        onClick={onRemove}
        className="text-slate-600 opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
        aria-label={`Remove ${rule.pattern}`}
        title="Remove"
      >
        ✕
      </button>
    </li>
  );
}

function CategorySwitch({
  value,
  onChange,
}: {
  value: RuleCategory;
  onChange: (c: RuleCategory) => void;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-white/10 bg-ink-900/60 p-0.5">
      {CATEGORY_ORDER.map((c) => {
        const meta = CATEGORY_META[c];
        const active = value === c;
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            title={meta.desc}
            className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
              active ? meta.active : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {meta.short}
          </button>
        );
      })}
    </div>
  );
}

function Suggestions({
  title,
  hint,
  hosts,
  meta,
  onPick,
}: {
  title: string;
  hint: string;
  hosts: string[];
  meta: (typeof CATEGORY_META)[RuleCategory];
  onPick: (host: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-300">{title}</span>
        <span className="text-[11px] text-slate-600">{hint}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {hosts.map((h) => (
          <button
            key={h}
            onClick={() => onPick(h)}
            className="chip border border-white/10 bg-white/5 text-slate-300 transition hover:border-white/20 hover:bg-white/10"
            title={`Add ${h} as ${meta.label}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {h}
            <span className="text-slate-500">+</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  dot,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  dot?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`chip border transition ${
        active
          ? 'border-beacon-500/50 bg-beacon-600/20 text-beacon-200'
          : 'border-transparent bg-white/5 text-slate-400 hover:bg-white/10'
      }`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {label}
      <span className={active ? 'text-beacon-300' : 'text-slate-600'}>{count}</span>
    </button>
  );
}

function Avatar({ domain }: { domain: string }) {
  const { hue, letter } = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < domain.length; i++) hash = (hash * 31 + domain.charCodeAt(i)) >>> 0;
    return { hue: hash % 360, letter: (domain[0] ?? '?').toUpperCase() };
  }, [domain]);
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white/90"
      style={{ backgroundColor: `hsl(${hue} 45% 38%)` }}
      aria-hidden
    >
      {letter}
    </span>
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
      <span className="pr-3">
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
