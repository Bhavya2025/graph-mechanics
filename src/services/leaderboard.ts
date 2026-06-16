import type { LeaderboardEntry, LeaderboardService } from '../contracts';

/**
 * Leaderboard service. Currently a localStorage-backed mock; a Supabase-backed
 * implementation can drop in behind the same `LeaderboardService` interface later
 * (the UI only ever depends on the interface).
 */

const STORAGE_KEY = 'graph-mechanics:leaderboard';

function readAll(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LeaderboardEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: LeaderboardEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* storage full / unavailable — non-fatal for a mock */
  }
}

export class MockLeaderboardService implements LeaderboardService {
  async top(levelId: number, limit = 10): Promise<LeaderboardEntry[]> {
    return readAll()
      .filter((e) => e.levelId === levelId)
      .sort((a, b) => a.timeMs - b.timeMs)
      .slice(0, limit);
  }

  async submit(entry: Omit<LeaderboardEntry, 'createdAt'>): Promise<void> {
    const all = readAll();
    all.push({ ...entry, createdAt: new Date().toISOString() });
    writeAll(all);
  }
}

/** Singleton the app talks to. Swap this construction for SupabaseLeaderboardService later. */
export const leaderboard: LeaderboardService = new MockLeaderboardService();
