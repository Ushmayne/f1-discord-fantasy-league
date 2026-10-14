import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findOpenRace,
  isOpenPostDue,
  isReminderDue,
  isScoringDue,
  isVoidDue,
  lockTime,
} from '../src/season.js';

const at = (iso) => new Date(iso);
const races = [
  { round: 1, qualifyingStart: at('2026-03-07T05:00:00Z'), raceStart: at('2026-03-08T04:00:00Z') },
  { round: 2, qualifyingStart: at('2026-03-14T07:00:00Z'), raceStart: at('2026-03-15T07:00:00Z') },
  { round: 3, qualifyingStart: null, raceStart: at('2026-03-29T05:00:00Z') },
];

test('picks lock at qualifying, or 24h before the race when qualifying time is unknown', () => {
  assert.equal(lockTime(races[0]).toISOString(), '2026-03-07T05:00:00.000Z');
  assert.equal(lockTime(races[2]).toISOString(), '2026-03-28T05:00:00.000Z');
});

test('findOpenRace moves to the next race the moment qualifying starts', () => {
  assert.equal(findOpenRace(races, at('2026-03-01T00:00:00Z')).round, 1);
  assert.equal(findOpenRace(races, at('2026-03-07T04:59:59Z')).round, 1);
  assert.equal(findOpenRace(races, at('2026-03-07T05:00:00Z')).round, 2);
  assert.equal(findOpenRace(races, at('2026-04-01T00:00:00Z')), null);
});

test('the open post waits until 3h after the previous race starts', () => {
  assert.equal(isOpenPostDue(races, races[0], at('2026-01-01T00:00:00Z')), true, 'round 1 has no previous race');
  assert.equal(isOpenPostDue(races, races[1], at('2026-03-08T06:59:00Z')), false);
  assert.equal(isOpenPostDue(races, races[1], at('2026-03-08T07:00:00Z')), true);
});

test('the reminder is due only in the final hour before lock', () => {
  assert.equal(isReminderDue(races[0], at('2026-03-07T03:59:00Z')), false);
  assert.equal(isReminderDue(races[0], at('2026-03-07T04:00:00Z')), true);
  assert.equal(isReminderDue(races[0], at('2026-03-07T05:00:00Z')), false, 'locked');
});

test('scoring starts 2h after the race start; void after 7 days', () => {
  assert.equal(isScoringDue(races[0], at('2026-03-08T05:59:00Z')), false);
  assert.equal(isScoringDue(races[0], at('2026-03-08T06:00:00Z')), true);
  assert.equal(isVoidDue(races[0], at('2026-03-14T04:00:00Z')), false);
  assert.equal(isVoidDue(races[0], at('2026-03-15T04:00:00Z')), true);
});
