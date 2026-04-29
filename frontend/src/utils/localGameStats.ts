export type LocalBotMatch = {
  id: string;
  result: "win" | "loss";
  winner: "bot" | "player";
  playedAt: string;
  targetScore: number;
  difficulty: string;
  controlMode: "keyboard" | "mouse";
};

export type LocalBotStats = {
  totalPlayed: number;
  wins: number;
  losses: number;
  matches: LocalBotMatch[];
};

const emptyStats: LocalBotStats = {
  totalPlayed: 0,
  wins: 0,
  losses: 0,
  matches: [],
};

function storageKey(userId: number): string {
  return `transcendence:localBotStats:${userId}`;
}

export function getLocalBotStats(userId?: number | null): LocalBotStats {
  if (!userId) return emptyStats;

  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return emptyStats;

    const parsed = JSON.parse(raw) as LocalBotStats;
    return {
      totalPlayed: Number(parsed.totalPlayed) || 0,
      wins: Number(parsed.wins) || 0,
      losses: Number(parsed.losses) || 0,
      matches: Array.isArray(parsed.matches) ? parsed.matches : [],
    };
  } catch (_error) {
    return emptyStats;
  }
}

export function recordLocalBotMatch(
  userId: number | undefined,
  winnerSide: "left" | "right",
  settings: { targetScore: number; difficulty: string } | undefined,
  controlMode: "keyboard" | "mouse",
): LocalBotStats {
  if (!userId) return emptyStats;

  const current = getLocalBotStats(userId);
  const result = winnerSide === "right" ? "win" : "loss";
  const nextMatch: LocalBotMatch = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    result,
    winner: result === "win" ? "player" : "bot",
    playedAt: new Date().toISOString(),
    targetScore: settings?.targetScore ?? 5,
    difficulty: settings?.difficulty ?? "Beginner",
    controlMode,
  };

  const nextStats: LocalBotStats = {
    totalPlayed: current.totalPlayed + 1,
    wins: current.wins + (result === "win" ? 1 : 0),
    losses: current.losses + (result === "loss" ? 1 : 0),
    matches: [nextMatch, ...current.matches].slice(0, 50),
  };

  localStorage.setItem(storageKey(userId), JSON.stringify(nextStats));
  return nextStats;
}
