// Pure helpers for deciding where we are in a race weekend. `now` is always
// passed in so these can be tested without faking the clock.

const HOUR = 60 * 60 * 1000;

export const REMINDER_BEFORE_LOCK = 1 * HOUR;
export const OPEN_AFTER_PREVIOUS_RACE = 3 * HOUR;
export const SCORE_AFTER_RACE_START = 2 * HOUR;
export const VOID_AFTER_RACE_START = 7 * 24 * HOUR;

/** Picks lock when Grand Prix qualifying starts (24h before the race if unknown). */
export function lockTime(race) {
  return race.qualifyingStart ?? new Date(race.raceStart.getTime() - 24 * HOUR);
}

/** The race predictions currently go towards, or null once the season's last lock has passed. */
export function findOpenRace(races, now) {
  return races.find((race) => lockTime(race) > now) ?? null;
}

export function findRace(races, round) {
  return races.find((race) => race.round === round) ?? null;
}

export function isOpenPostDue(races, race, now) {
  const previous = findRace(races, race.round - 1);
  if (!previous) return true;
  return now.getTime() >= previous.raceStart.getTime() + OPEN_AFTER_PREVIOUS_RACE;
}

export function isReminderDue(race, now) {
  const msToLock = lockTime(race).getTime() - now.getTime();
  return msToLock > 0 && msToLock <= REMINDER_BEFORE_LOCK;
}

export function isScoringDue(race, now) {
  return now.getTime() >= race.raceStart.getTime() + SCORE_AFTER_RACE_START;
}

export function isVoidDue(race, now) {
  return now.getTime() >= race.raceStart.getTime() + VOID_AFTER_RACE_START;
}

/** Discord renders <t:...> in each viewer's own timezone. Styles: F full, R relative, f short. */
export function discordTime(date, style = 'F') {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}
