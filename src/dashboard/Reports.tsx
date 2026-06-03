import { useMemo, useState } from 'react';
import { useEvents, useHistory, useRules } from '../ui/useStorage';
import { buildRangeReport, type RangeReport } from '../modules/analytics';
import { formatHm } from '../modules/session-engine';
import { StatCard, EmptyState } from '../ui/components';

const RANGES = [
  { id: 'daily', label: 'Daily', days: 1 },
  { id: 'weekly', label: 'Weekly', days: 7 },
  { id: 'monthly', label: 'Monthly', days: 30 },
] as const;

export function Reports() {
  const events = useEvents();
  const history = useHistory();
  const [rules] = useRules();
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[1]);

  const report = useMemo(
    () => buildRangeReport(range.label, range.days, events, history, rules),
    [range, events, history, rules]
  );

  const hasData = report.totalFocusSeconds > 0 || report.sessionsCompleted > 0;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-sm text-slate-500">Understand your productivity patterns over time.</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-white/5 p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                range.id === r.id ? 'bg-beacon-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <EmptyState
          title="Not enough data yet"
          hint="Complete a few focus sessions and your reports will fill in here."
        />
      ) : (
        <ReportBody report={report} />
      )}
    </div>
  );
}

function ReportBody({ report }: { report: RangeReport }) {
  const maxDay = Math.max(1, ...report.perDay.map((d) => d.focusSeconds));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Focus" value={formatHm(report.totalFocusSeconds * 1000)} accent="text-focus" />
        <StatCard label="Sessions" value={report.sessionsCompleted} />
        <StatCard
          label="Avg Session"
          value={`${Math.round(report.avgSessionMinutes)}m`}
          accent="text-beacon-300"
        />
        <StatCard
          label="Distraction"
          value={formatHm(report.totalDistractionSeconds * 1000)}
          accent="text-distract"
        />
      </div>

      {report.perDay.length > 1 && (
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Focus by Day</h2>
          <div className="flex h-40 items-end gap-1.5">
            {report.perDay.map((d) => (
              <div key={d.dateKey} className="group flex flex-1 flex-col items-center justify-end gap-1">
                <div
                  className="w-full rounded-t bg-beacon-500/80 transition-all group-hover:bg-beacon-400"
                  style={{ height: `${(d.focusSeconds / maxDay) * 100}%`, minHeight: d.focusSeconds > 0 ? 4 : 0 }}
                  title={`${d.dateKey}: ${formatHm(d.focusSeconds * 1000)}`}
                />
                <span className="text-[9px] text-slate-600">
                  {new Date(d.dateKey).toLocaleDateString(undefined, { weekday: 'narrow' })}
                </span>
              </div>
            ))}
          </div>
          {report.mostProductiveDay && report.mostProductiveDay.focusSeconds > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              Most productive day:{' '}
              <span className="font-medium text-slate-300">
                {new Date(report.mostProductiveDay.dateKey).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>{' '}
              ({formatHm(report.mostProductiveDay.focusSeconds * 1000)})
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <TopList title="Most Visited Productive Sites" domains={report.topProductive} accent="text-focus" />
        <TopList title="Most Visited Distracting Sites" domains={report.topDistracting} accent="text-distract" />
      </div>
    </div>
  );
}

function TopList({
  title,
  domains,
  accent,
}: {
  title: string;
  domains: { domain: string; seconds: number }[];
  accent: string;
}) {
  return (
    <div className="card">
      <h2 className={`mb-3 text-sm font-semibold ${accent}`}>{title}</h2>
      {domains.length === 0 ? (
        <p className="text-xs text-slate-600">No data for this range.</p>
      ) : (
        <ol className="space-y-2">
          {domains.map((d, i) => (
            <li key={d.domain} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-4 text-xs text-slate-600">{i + 1}</span>
                {d.domain}
              </span>
              <span className="tabular-nums text-slate-400">{formatHm(d.seconds * 1000)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
