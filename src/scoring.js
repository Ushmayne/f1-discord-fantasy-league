// Partial credit by where the picked driver actually placed.
export const POINTS_BY_PLACE = { 1: 10, 2: 6, 3: 4, 4: 2, 5: 2 };
export const EXACT_POINTS = POINTS_BY_PLACE[1];

export function pointsForPlace(place) {
  return POINTS_BY_PLACE[place] ?? 0;
}

/**
 * Turn a race's results and qualifying into lookups of driverId -> place.
 * Unclassified finishers (DNF/DSQ) and drivers without a fastest lap are left out,
 * so picking them scores 0.
 */
export function buildOutcome(results, qualifying) {
  const racePlace = new Map();
  const fastestLapRank = new Map();
  for (const r of results.results) {
    if (r.position != null) racePlace.set(r.driver.id, r.position);
    if (r.fastestLapRank != null) fastestLapRank.set(r.driver.id, r.fastestLapRank);
  }
  const qualifyingPlace = new Map(qualifying.order.map((q) => [q.driver.id, q.position]));
  return { racePlace, qualifyingPlace, fastestLapRank };
}

/** picks: { winner, pole, fastestLap } as driverIds. */
export function scorePicks(picks, outcome) {
  const winner = pointsForPlace(outcome.racePlace.get(picks.winner));
  const pole = pointsForPlace(outcome.qualifyingPlace.get(picks.pole));
  const fastestLap = pointsForPlace(outcome.fastestLapRank.get(picks.fastestLap));
  const exact = [winner, pole, fastestLap].filter((p) => p === EXACT_POINTS).length;
  return { winner, pole, fastestLap, total: winner + pole + fastestLap, exact };
}

/**
 * players: [{ userId, total, exact, races }]. Sorted by total, then exact picks.
 * Players tied on both share a rank (1, 2, 2, 4).
 */
export function rankPlayers(players) {
  const sorted = [...players].sort(
    (a, b) => b.total - a.total || b.exact - a.exact || a.userId.localeCompare(b.userId),
  );
  let rank = 0;
  return sorted.map((player, i) => {
    const prev = sorted[i - 1];
    if (!prev || prev.total !== player.total || prev.exact !== player.exact) rank = i + 1;
    return { ...player, rank };
  });
}
