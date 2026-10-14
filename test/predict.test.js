import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDriver } from '../src/commands/predict.js';

const drivers = [
  { id: 'max_verstappen', code: 'VER', name: 'Max Verstappen' },
  { id: 'leclerc', code: 'LEC', name: 'Charles Leclerc' },
  { id: 'antonelli', code: 'ANT', name: 'Andrea Kimi Antonelli' },
];

test('resolveDriver accepts an autocomplete value, code, surname or full name', () => {
  for (const input of ['max_verstappen', 'VER', 'ver', 'Verstappen', 'max verstappen', '  Max Verstappen ']) {
    assert.equal(resolveDriver(input, drivers)?.id, 'max_verstappen', input);
  }
  assert.equal(resolveDriver('antonelli', drivers)?.id, 'antonelli');
});

test('resolveDriver rejects unknown names', () => {
  assert.equal(resolveDriver('Senna', drivers), null);
  assert.equal(resolveDriver('', drivers), null);
});
