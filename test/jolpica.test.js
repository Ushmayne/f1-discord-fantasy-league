import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseConstructorStandings,
  parseDriverStandings,
  parseQualifying,
  parseResults,
  parseSchedule,
} from '../src/f1/jolpica.js';

// Fixtures are real responses from api.jolpi.ca (2026 season, Singapore GP = round 17).
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)));
const emptyRaceTable = { MRData: { RaceTable: { season: '2026', Races: [] } } };

test('parseSchedule returns races in round order with session times', () => {
  const { season, races } = parseSchedule(fixture('schedule'));
  assert.equal(season, 2026);
  assert.equal(races.length, 23);
  assert.deepEqual(races.map((r) => r.round), [...Array(23).keys()].map((i) => i + 1));
  assert.equal(races[0].name, 'Australian Grand Prix');
  assert.equal(races[0].raceStart.toISOString(), '2026-03-08T04:00:00.000Z');
  assert.equal(races[0].qualifyingStart.toISOString(), '2026-03-07T05:00:00.000Z');
});

test('parseResults marks retired drivers as unclassified and keeps fastest-lap rank', () => {
  const race = parseResults(fixture('results'));
  assert.equal(race.round, 17);
  assert.equal(race.results[0].driver.id, 'max_verstappen');
  assert.equal(race.results[0].driver.code, 'VER');
  assert.equal(race.results[0].position, 1);

  const stroll = race.results.find((r) => r.driver.id === 'stroll');
  assert.equal(stroll.position, null, 'retired driver has no classified position');
  assert.equal(stroll.fastestLapRank, 19);

  assert.equal(race.results.find((r) => r.fastestLapRank === 1).driver.id, 'leclerc');
});

test('parseQualifying returns the qualifying order', () => {
  const q = parseQualifying(fixture('qualifying'));
  assert.deepEqual(
    q.order.slice(0, 3).map((e) => [e.position, e.driver.id]),
    [[1, 'max_verstappen'], [2, 'leclerc'], [3, 'hamilton']],
  );
});

test('parse functions return null when a session has not happened yet', () => {
  assert.equal(parseResults(emptyRaceTable), null);
  assert.equal(parseQualifying(emptyRaceTable), null);
  assert.equal(parseDriverStandings({ MRData: { StandingsTable: { StandingsLists: [] } } }), null);
});

test('parseDriverStandings and parseConstructorStandings', () => {
  const drivers = parseDriverStandings(fixture('driver-standings'));
  assert.equal(drivers.round, 17);
  assert.deepEqual(
    { id: drivers.entries[0].driver.id, points: drivers.entries[0].points, team: drivers.entries[0].team },
    { id: 'antonelli', points: 340, team: 'Mercedes' },
  );

  const constructors = parseConstructorStandings(fixture('constructor-standings'));
  assert.deepEqual(
    { team: constructors.entries[0].team, points: constructors.entries[0].points, wins: constructors.entries[0].wins },
    { team: 'Mercedes', points: 578, wins: 11 },
  );
});
