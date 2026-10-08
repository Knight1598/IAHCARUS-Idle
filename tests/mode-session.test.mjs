import assert from 'node:assert/strict';
import test from 'node:test';
import { newModeSession, mirrorScore, readModeSession } from '../src/mode-session.ts';

test('Mirror match points follow original players when their colors swap, including half-point draws', () => {
  const session = newModeSession('mirror', { seed: 0 }, 'b');
  assert.deepEqual(mirrorScore(session, 'b', 'b'), { w: 0, b: 1 });
  assert.deepEqual(session.mirrorWins, { w: 0, b: 0 }, 'previewing results never records a round');
  session.mirrorWins = mirrorScore(session, null, 'b'); session.options.round = 2;
  assert.deepEqual(mirrorScore(session, 'w', 'w'), { w: .5, b: 1.5 });
  const restored = readModeSession(JSON.parse(JSON.stringify(session)));
  assert.deepEqual(restored.mirrorWins, session.mirrorWins); assert.equal(restored.firstColor, session.firstColor); assert.equal(restored.options.round, 2);
});
test('mode save validation rejects unrecognized modes and bounds timers and counters', () => {
  assert.equal(readModeSession({ id: 'made-up', options: { seed: 1 } }), null);
  assert.equal(readModeSession({ id: 'rush', options: { seed: -1 } }), null);
  const session = readModeSession({ id: 'rush', options: { seed: 42 }, rushRemaining: -123, rushFailures: 100, rushSolved: '1' });
  assert.equal(session.rushRemaining, 0); assert.equal(session.rushFailures, 0); assert.equal(session.rushSolved, 0);
});
