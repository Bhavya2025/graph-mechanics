import { useEffect, useState } from 'react';
import { Crown, Trophy } from 'lucide-react';
import type { LeaderboardEntry } from '../contracts';
import { leaderboard } from '../services/leaderboard';

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Top times for a level. Reads the `LeaderboardService` (a localStorage mock today, a
 * Supabase service later — same interface). `version` is bumped by the parent to
 * trigger a refetch after a new score is submitted.
 */
export function Leaderboard({ levelId, version = 0 }: { levelId: number; version?: number }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    leaderboard.top(levelId, 8).then((rows) => {
      if (active) {
        setEntries(rows);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [levelId, version]);

  return (
    <div className="panel p-4">
      <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold tracking-widest text-synth-amber">
        <Trophy size={15} />
        Fastest Times
      </h2>
      {loading ? (
        <p className="text-xs text-synth-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-synth-muted/70">No records yet. Be the first to solve it.</p>
      ) : (
        <ol className="space-y-1.5">
          {entries.map((e, i) => (
            <li
              key={`${e.handle}-${e.createdAt}`}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                i === 0 ? 'bg-synth-amber/10' : ''
              }`}
            >
              <span
                className={`w-5 text-center font-mono text-xs ${
                  i === 0 ? 'text-synth-amber' : 'text-synth-muted'
                }`}
              >
                {i === 0 ? <Crown size={13} className="inline" /> : i + 1}
              </span>
              <span className="flex-1 truncate font-medium text-synth-text">{e.handle}</span>
              <span className="font-mono tabular-nums text-synth-cyan">{formatTime(e.timeMs)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
