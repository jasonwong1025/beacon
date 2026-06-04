import { useMemo } from 'react';
import { StatCard, Bar, EmptyState } from '../ui/components';
import { useEvents, useHistory, useRules, useCustomPresets, useSettings } from '../ui/useStorage';
import { buildDayOverview } from '../modules/analytics';
import { formatHm } from '../modules/session-engine';
import { sessionTypeDisplay } from '../modules/types';

export function Overview() {
  const events = useEvents();
  const history = useHistory();
  const [rules] = useRules();
  const [customPresets] = useCustomPresets();
  const [settings] = useSettings();

  const day = useMemo(
    () => buildDayOverview(Date.now(), events, history, rules),
    [events, history, rules]
  );

  const totalTracked = day.focusSeconds + day.distractionSeconds + day.neutralSeconds;
  const productive = day.domains.filter((d) => d.category === 'productive').slice(0, 6);
  const distracting = day.domains.filter((d) => d.category === 'distracting').slice(0, 6);
  const maxDomain = Math.max(1, ...day.domains.slice(0, 6).map((d) => d.seconds));

  const recent = [...history].reverse().slice(0, 6);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Today's Overview</h1>
        <p className="text-sm text-slate-500">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total Focus Time"
          value={formatHm(day.focusSeconds * 1000)}
          accent="text-focus"
        />
        <StatCard label="Sessions Completed" value={day.sessionsCompleted} />
        <StatCard
          label="Distraction Events"
          value={day.distractionEvents}
          accent="text-distract"
        />
        <StatCard
          label="Focus Ratio"
          value={`${Math.round(day.focusRatio * 100)}%`}
          accent="text-beacon-300"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Website Breakdown</h2>
          {day.domains.length === 0 ? (
            <EmptyState title="No activity tracked yet" hint="Start a focus session to see where your time goes." />
          ) : (
            <div className="space-y-4">
              <DomainList title="Productive" color="bg-focus" domains={productive} max={maxDomain} accent="text-focus" />
              <DomainList title="Distracting" color="bg-distract" domains={distracting} max={maxDomain} accent="text-distract" />
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Time Allocation</h2>
          {totalTracked === 0 ? (
            <EmptyState title="Nothing to allocate yet" />
          ) : (
            <Allocation
              segments={[
                { label: 'Productive', seconds: day.focusSeconds, color: 'bg-focus' },
                { label: 'Neutral', seconds: day.neutralSeconds, color: 'bg-beacon-500' },
                { label: 'Distracting', seconds: day.distractionSeconds, color: 'bg-distract' },
              ]}
              total={totalTracked}
            />
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Recent Sessions</h2>
        {recent.length === 0 ? (
          <EmptyState title="No sessions yet" hint="Click the Beacon icon to start your first focus session." />
        ) : (
          <div className="divide-y divide-white/5">
            {recent.map((s) => {
              const meta = sessionTypeDisplay(s, customPresets, s.profileId ?? settings?.userProfile);
              const total = s.focusSeconds + s.distractionSeconds;
              const ratio = total > 0 ? s.focusSeconds / total : 0;
              const goal = s.goal?.trim();
              return (
                <div key={s.id} className="flex items-center gap-3 py-2.5">
                  <span className="text-lg leading-none">{meta.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-200">
                      {goal || meta.label}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {goal ? `${meta.label} · ` : ''}
                      {new Date(s.endedAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · {s.durationMinutes}m planned ·{' '}
                      <span className={s.status === 'completed' ? 'text-focus' : 'text-slate-500'}>
                        {s.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-focus">{formatHm(s.focusSeconds * 1000)}</div>
                    <div className="text-[10px] text-slate-500">{Math.round(ratio * 100)}% focus</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DomainList({
  title,
  domains,
  max,
  color,
  accent,
}: {
  title: string;
  domains: { domain: string; seconds: number }[];
  max: number;
  color: string;
  accent: string;
}) {
  if (domains.length === 0)
    return (
      <div>
        <div className={`mb-1.5 text-xs font-semibold ${accent}`}>{title}</div>
        <p className="text-xs text-slate-600">None today.</p>
      </div>
    );
  return (
    <div>
      <div className={`mb-1.5 text-xs font-semibold ${accent}`}>{title}</div>
      <div className="space-y-2">
        {domains.map((d) => (
          <div key={d.domain} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-xs text-slate-300">{d.domain}</span>
            <Bar value={d.seconds} max={max} color={color} />
            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-400">
              {formatHm(d.seconds * 1000)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Allocation({
  segments,
  total,
}: {
  segments: { label: string; seconds: number; color: string }[];
  total: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-white/5">
        {segments.map((s) => (
          <div
            key={s.label}
            className={s.color}
            style={{ width: `${(s.seconds / total) * 100}%` }}
            title={`${s.label}: ${formatHm(s.seconds * 1000)}`}
          />
        ))}
      </div>
      <div className="space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-300">
              <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
              {s.label}
            </span>
            <span className="tabular-nums text-slate-400">
              {Math.round((s.seconds / total) * 100)}% · {formatHm(s.seconds * 1000)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
