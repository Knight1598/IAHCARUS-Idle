import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { dailyChallenge, dailyProgress, utcDay, validDailyDay } from '../src/daily.ts';
import { evaluateTrial } from '../src/progression.ts';
import { claimXP, readProfile } from '../src/profile.ts';

const day = (offset) => utcDay(new Date(Date.UTC(2026, 9, 1 + offset)));
const transform = (square, seed) => `${String.fromCharCode(97 + (seed & 4 ? 7 - (square.charCodeAt(0) - 97) : square.charCodeAt(0) - 97))}${seed & 8 ? 9 - Number(square[1]) : square[1]}`;

test('daily dates follow UTC, validate actual calendar dates and rotate deterministically', () => {
  assert.equal(utcDay(new Date('2026-10-08T06:59:59+07:00')), '2026-10-07');
  assert.equal(utcDay(new Date('2026-10-08T07:00:00+07:00')), '2026-10-08');
  assert.equal(validDailyDay('2028-02-29'), true);
  for (const value of [null, 123, '2026-02-29', '2026-04-31', '2026-13-01', '2026-1-01', '2026-10-08junk']) {
    assert.equal(validDailyDay(value), false);
    assert.throws(() => dailyChallenge(value), /Invalid daily date/);
  }
  const challenges = Array.from({ length: 16 }, (_, i) => dailyChallenge(day(i)));
  assert.equal(new Set(challenges.map(c => c.trial.fen)).size, 16);
  assert.equal(new Set(challenges.map(c => c.arena)).size, 8);
  assert.deepEqual(dailyChallenge(day(0)), dailyChallenge(day(0)));
  assert.equal(dailyChallenge(day(16)).trial.fen, challenges[0].trial.fen);
  assert.notEqual(dailyChallenge(day(16)).id, challenges[0].id);
});

test('all sixteen daily boards have legal, attainable objectives for either side', () => {
  for (let i = 0; i < 16; i++) {
    const challenge = dailyChallenge(day(i)), trial = challenge.trial;
    const seed = Math.floor(Date.parse(`${day(i)}T00:00:00Z`) / 86400000) % 16;
    const game = new Chess(trial.fen);
    assert.equal(game.turn(), trial.side);
    assert.equal(evaluateTrial(trial, game), 'active');
    const move = (from, to) => game.move({ from: transform(from, seed), to: transform(to, seed) });
    if (trial.objective === 'rescue') {
      assert.equal(game.isCheck(), true);
      move('g7', 'f6');
    } else if (trial.objective === 'fork') move('c3', 'd5');
    else if (trial.maxMoves === 1) move('f7', 'g7');
    else {
      assert.equal(game.moves().some(m => m.endsWith('#')), false);
      move('a1', 'a7');
      assert.equal(evaluateTrial(trial, game), 'active');
      const replies = game.moves();
      assert.ok(replies.length);
      for (const reply of replies) {
        game.move(reply);
        const mate = game.moves().find(m => m.endsWith('#'));
        assert.ok(mate, `${challenge.day}: forced mate survives ${reply}`);
        game.move(mate);
        assert.equal(evaluateTrial(trial, game), 'won');
        game.undo(); game.undo();
      }
      game.move(replies[0]);
      game.move(game.moves().find(m => m.endsWith('#')));
    }
    assert.equal(evaluateTrial(trial, game), 'won', challenge.day);
    game.undo();
    assert.equal(evaluateTrial(trial, game), 'active', 'undo restores the objective');
  }
});

test('streaks count consecutive claimed dates, ignore duplicate/malformed claims and reset after a gap', () => {
  const claims = ['trial:boss', 'daily:2026-02-29', `daily:${day(0)}`, `daily:${day(1)}`, `daily:${day(1)}`];
  assert.deepEqual(dailyProgress(claims, day(2)), { done: false, streak: 2, reward: 100, completed: 2 });
  assert.deepEqual(dailyProgress([...claims, `daily:${day(2)}`], day(2)), { done: true, streak: 3, reward: 100, completed: 3 });
  assert.deepEqual(dailyProgress(claims, day(3)), { done: false, streak: 0, reward: 80, completed: 2 });
  const long = Array.from({ length: 10 }, (_, i) => `daily:${day(i)}`);
  assert.equal(dailyProgress(long, day(10)).reward, 120);
});

test('daily XP and unlocks are granted once per date, survive reload and keep the original date after midnight', () => {
  let profile = readProfile('{"xp":110}');
  for (let i = 0; i < 3; i++) {
    const challenge = dailyChallenge(day(i));
    const reward = dailyProgress(profile.claimed, challenge.day).reward;
    const claim = claimXP(profile, challenge.id, reward);
    assert.equal(claim.added, true);
    if (i === 1) assert.deepEqual(claim.unlocked, ['astral', 'storm']);
    profile = readProfile(JSON.stringify(claim.profile));
    assert.equal(claimXP(profile, challenge.id, reward).added, false);
  }
  assert.equal(profile.xp, 380);
  assert.equal(profile.matches, 0);
  assert.equal(dailyProgress(profile.claimed, day(3)).reward, 110);
  assert.equal(claimXP(profile, dailyChallenge(day(2)).id, 120).added, false);
  assert.equal(dailyProgress(profile.claimed, day(3)).done, false);
});
