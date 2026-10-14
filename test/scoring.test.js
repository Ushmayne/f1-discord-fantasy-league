import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseQualifying, parseResults } from '../src/f1/jolpica.js';
import { buildOutcome, pointsForPlace, rankPlayers, scorePicks } from '../src/scoring.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)));

// Singapore 2026: VER won from pole, LEC fastest lap, ANT P3, STR retired.
const outcome = buildOutcome(parseResults(fixture('results')), parseQualifying(fixture('qualifying')));

test('pointsForPlace follows the 10/6/4/2/2 scale', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 20, undefined].map(pointsForPlace), [10, 6, 4, 2, 2, 0, 0, 0]);
});

test('perfect picks score 30 with three exact hits', () => {
  assert.deepEqual(scorePicks({ winner: 'max_verstappen', pole: 'max_verstappen', fastestLap: 'leclerc' }, outcome), {
    winner: 10,
    pole: 10,
    fastestLap: 10,
    total: 30,
    exact: 3,
  });
});

test('near misses earn partial credit', () => {
  // LEC finished P2, HAM qualified P3, VER had the 5th-fastest lap.
  assert.deepEqual(scorePicks({ winner: 'leclerc', pole: 'hamilton', fastestLap: 'max_verstappen' }, outcome), {
    winner: 6,
    pole: 4,
    fastestLap: 2,
    total: 12,
    exact: 0,
  });
});

test('a retired driver scores nothing for the winner pick', () => {
  assert.equal(scorePicks({ winner: 'stroll', pole: 'x', fastestLap: 'x' }, outcome).winner, 0);
});

test('a driver missing from the results scores nothing', () => {
  assert.equal(scorePicks({ winner: 'nobody', pole: 'nobody', fastestLap: 'nobody' }, outcome).total, 0);
});

test('rankPlayers sorts by points then exact picks, and ties share a rank', () => {
  const ranked = rankPlayers([
    { userId: 'a', total: 20, exact: 1, races: 2 },
    { userId: 'b', total: 40, exact: 2, races: 2 },
    { userId: 'c', total: 20, exact: 2, races: 2 },
    { userId: 'd', total: 20, exact: 1, races: 2 },
    { userId: 'e', total: 5, exact: 0, races: 1 },
  ]);
  assert.deepEqual(
    ranked.map((p) => [p.userId, p.rank]),
    [['b', 1], ['c', 2], ['a', 3], ['d', 3], ['e', 5]],
  );
});

test('rankPlayers handles an empty league', () => {
  assert.deepEqual(rankPlayers([]), []);
});
