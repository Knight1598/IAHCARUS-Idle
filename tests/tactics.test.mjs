import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { previewMove } from '../src/tactics.ts';

test('previews accept legal destinations and leave board, history and turn untouched', () => {
  const game = new Chess(); game.move('e4'); game.move('e5');
  const fen = game.fen(), history = game.history();
  assert.equal(previewMove(game, 'g1', 'f3').piece, 'n');
  assert.equal(previewMove(game, 'g1', 'f3').captured, undefined);
  assert.equal(previewMove(game, 'g1', 'f3').controlled, false);
  assert.equal(previewMove(game, 'g1', 'g3'), null);
  assert.equal(previewMove(game, 'g8', 'f6'), null);
  assert.equal(game.fen(), fen); assert.deepEqual(game.history(), history);
});

test('captures warn about controlled squares without asserting a guaranteed recapture', () => {
  const game = new Chess('7k/8/8/3r1p2/4B3/2N5/8/K7 w - - 0 1');
  const target = previewMove(game, 'c3', 'd5');
  assert.equal(target.captured, 'r'); assert.equal(target.capturedSquare, 'd5');
  assert.equal(target.controlled, false);
  const defended = new Chess('7k/8/2p5/3r4/8/2N5/8/K7 w - - 0 1');
  assert.equal(previewMove(defended, 'c3', 'd5').controlled, true);
  const pinned = new Chess('4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1');
  assert.equal(previewMove(pinned, 'e2', 'd2'), null);
});

test('preview identifies actual en passant victim, castle, promotion and checkmate', () => {
  const ep = new Chess('7k/8/8/3pP3/8/8/8/K7 w - d6 0 1');
  const target = previewMove(ep, 'e5', 'd6');
  assert.equal(target.captured, 'p'); assert.equal(target.capturedSquare, 'd5');
  const castle = new Chess('4k3/8/8/8/8/8/8/4K2R w K - 0 1');
  assert.equal(previewMove(castle, 'e1', 'g1').castle, true);
  const promotion = new Chess('7k/P7/8/8/8/8/8/K7 w - - 0 1');
  assert.equal(previewMove(promotion, 'a7', 'a8').promotion, 'q');
  const mate = new Chess('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');
  assert.equal(previewMove(mate, 'f7', 'g7').mate, true);
  assert.equal(previewMove(mate, 'f7', 'g7').check, true);
  assert.equal(mate.isCheckmate(), false);
});
