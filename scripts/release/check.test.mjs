import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRelease } from './check.mjs';

const previous = { version: '0.17.1', versionCode: 19 };
test('accepts a synchronized version bump with a larger Android code', () => {
  assert.equal(validateRelease(Array(4).fill('0.18.0'), 20, previous), 'v0.18.0');
});
test('accepts ordinary commits without publishing another version', () => {
  assert.equal(validateRelease(Array(4).fill('0.17.1'), 19, previous), 'v0.17.1');
});
test('rejects partial bumps, invalid versions, stale Android codes and downgrades', () => {
  assert.throws(() => validateRelease(['0.18.0', '0.17.1'], 20, previous));
  assert.throws(() => validateRelease(['0.18.0-beta.1'], 20, previous));
  assert.throws(() => validateRelease(['0.18.0'], 19, previous));
  assert.throws(() => validateRelease(['0.16.0'], 20, previous));
  assert.throws(() => validateRelease(['0.17.1'], 20, previous));
  assert.throws(() => validateRelease(['0.18.0'], NaN, previous));
});
