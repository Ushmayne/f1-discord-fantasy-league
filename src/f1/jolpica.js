// Client for the Jolpica F1 API (the maintained successor to Ergast).
// Docs: https://github.com/jolpica/jolpica-f1/blob/main/docs/README.md
// Rate limit is ~500 requests/hour, so everything goes through a TTL cache.

const BASE_URL = 'https://api.jolpi.ca/ergast/f1';
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export class F1DataError extends Error {}

// ---------- normalization (pure, unit tested) ----------

function toDate(date, time) {
  if (!date) return null;
  return new Date(`${date}T${time ?? '00:00:00Z'}`);
}

function toInt(value) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

export function normalizeDriver(d) {
  return {
    id: d.driverId,
    code: d.code ?? d.familyName.slice(0, 3).toUpperCase(),
    name: `${d.givenName} ${d.familyName}`,
  };
}

function normalizeRace(r) {
  return {
    season: toInt(r.season),
    round: toInt(r.round),
    name: r.raceName,
    circuit: r.Circuit?.circuitName ?? '',
    country: r.Circuit?.Location?.country ?? '',
    raceStart: toDate(r.date, r.time),
    qualifyingStart: r.Qualifying ? toDate(r.Qualifying.date, r.Qualifying.time) : null,
  };
}

export function parseSchedule(json) {
  const table = json.MRData.RaceTable;
  return {
    season: toInt(table.season),
    races: table.Races.map(normalizeRace).sort((a, b) => a.round - b.round),
  };
}

export function parseResults(json) {
  const race = json.MRData.RaceTable.Races[0];
  if (!race?.Results?.length) return null;
  return {
    ...normalizeRace(race),
    results: race.Results.map((r) => ({
      // Drivers who retired/were disqualified still get a numeric `position`,
      // but their `positionText` is a letter (R, D, W...). Only numbers count.
      position: /^\d+$/.test(r.positionText) ? toInt(r.positionText) : null,
      driver: normalizeDriver(r.Driver),
      team: r.Constructor.name,
      status: r.status,
      points: Number(r.points),
      fastestLapRank: toInt(r.FastestLap?.rank),
      fastestLapTime: r.FastestLap?.Time?.time ?? null,
    })),
  };
}

export function parseQualifying(json) {
  const race = json.MRData.RaceTable.Races[0];
  if (!race?.QualifyingResults?.length) return null;
  return {
    ...normalizeRace(race),
    order: race.QualifyingResults.map((q) => ({
      position: toInt(q.position),
      driver: normalizeDriver(q.Driver),
      team: q.Constructor.name,
    })),
  };
}

export function parseDriverStandings(json) {
  const list = json.MRData.StandingsTable.StandingsLists[0];
  if (!list) return null;
  return {
    season: toInt(list.season),
    round: toInt(list.round),
    entries: list.DriverStandings.map((s) => ({
      position: toInt(s.position),
      driver: normalizeDriver(s.Driver),
      team: s.Constructors.at(-1)?.name ?? '',
      points: Number(s.points),
      wins: toInt(s.wins),
    })),
  };
}

export function parseConstructorStandings(json) {
  const list = json.MRData.StandingsTable.StandingsLists[0];
  if (!list) return null;
  return {
    season: toInt(list.season),
    round: toInt(list.round),
    entries: list.ConstructorStandings.map((s) => ({
      position: toInt(s.position),
      team: s.Constructor.name,
      points: Number(s.points),
      wins: toInt(s.wins),
    })),
  };
}

export function parseDrivers(json) {
  return json.MRData.DriverTable.Drivers.map(normalizeDriver);
}

// ---------- fetching ----------

const cache = new Map();

async function fetchJson(path) {
  const url = `${BASE_URL}/${path}`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    throw new F1DataError(`Request to ${url} failed: ${err.message}`);
  }
  if (!res.ok) throw new F1DataError(`Request to ${url} returned ${res.status}`);
  return res.json();
}

async function cached(path, ttlMs, parse) {
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = parse(await fetchJson(path));
  cache.set(path, { value, expires: Date.now() + ttlMs });
  return value;
}

export function getSchedule(season = 'current') {
  return cached(`${season}.json?limit=100`, 6 * HOUR, parseSchedule);
}

/** `round` may be a number or 'last'. Returns null if the race has no results yet. */
export function getRaceResults(season, round) {
  return cached(`${season}/${round}/results.json?limit=100`, 10 * MINUTE, parseResults);
}

/** Returns null if qualifying has not happened yet. */
export function getQualifying(season, round) {
  return cached(`${season}/${round}/qualifying.json?limit=100`, 10 * MINUTE, parseQualifying);
}

export function getDriverStandings(season = 'current') {
  return cached(`${season}/driverStandings.json?limit=100`, 10 * MINUTE, parseDriverStandings);
}

export function getConstructorStandings(season = 'current') {
  return cached(`${season}/constructorStandings.json?limit=100`, 10 * MINUTE, parseConstructorStandings);
}

/** Every driver who has entered a race this season, including stand-ins. */
export function getSeasonDrivers(season) {
  return cached(`${season}/drivers.json?limit=100`, 6 * HOUR, parseDrivers);
}

/**
 * The drivers worth suggesting in /predict: the grid from the season's most
 * recent race, falling back to last season's final grid before round 1.
 */
export async function getCurrentGrid(season) {
  const latest = await getRaceResults(season, 'last');
  if (latest && latest.season === season) return latest.results.map((r) => r.driver);
  const previous = await getRaceResults(season - 1, 'last');
  return previous ? previous.results.map((r) => r.driver) : [];
}

/** Drivers a pick may name: this season's entrants plus the suggested grid. */
export async function getPickableDrivers(season) {
  const [entrants, grid] = await Promise.all([getSeasonDrivers(season), getCurrentGrid(season)]);
  const byId = new Map([...grid, ...entrants].map((d) => [d.id, d]));
  return [...byId.values()];
}
