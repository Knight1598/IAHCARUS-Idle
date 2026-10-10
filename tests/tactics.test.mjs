import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { inspectPiece, previewMove } from '../src/tactics.ts';
import { SpecialChess } from '../src/special.ts';
import { VariantChess } from '../src/variants.ts';

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

test('piece inspection names every ordinary controller and legal capture without changing the game', () => {
  const game = new Chess('3r3k/8/8/5n2/3N4/8/8/K5B1 w - - 0 1');
  const before = { fen: game.fen(), history: game.history(), hash: game.hash() };
  const piece = inspectPiece(game, 'd4');
  assert.equal(piece.square, 'd4'); assert.equal(piece.type, 'n'); assert.equal(piece.color, 'w');
  assert.deepEqual(piece.attackers, [
    { square: 'd8', type: 'r', color: 'b' },
    { square: 'f5', type: 'n', color: 'b' },
  ]);
  assert.deepEqual(piece.defenders, [{ square: 'g1', type: 'b', color: 'w' }]);
  assert.equal(piece.legalDestinations.length, 8);
  assert.deepEqual(piece.captureDestinations, ['f5']);
  assert.equal(piece.kingSquare, 'a1'); assert.equal(piece.inCheck, false);
  assert.deepEqual(piece.checkers, []); assert.equal(piece.controlScope, 'ordinary');
  assert.equal(piece.ultimate, false); assert.equal(piece.variant, false);
  // Returned descriptors are snapshots, so UI consumers cannot change live pieces.
  piece.attackers[0].type = 'p'; piece.legalDestinations.push('a8');
  assert.equal(game.get('d8').type, 'r');
  assert.deepEqual({ fen: game.fen(), history: game.history(), hash: game.hash() }, before);
});

test('inspection counts promotion destinations once and does not offer moves for the other side', () => {
  const game = new Chess('1r5k/P7/8/8/8/8/8/K7 w - - 0 1');
  assert.equal(game.moves({ square: 'a7', verbose: true }).length, 8);
  const pawn = inspectPiece(game, 'a7');
  assert.deepEqual(pawn.legalDestinations, ['a8', 'b8']);
  assert.deepEqual(pawn.captureDestinations, ['b8']);
  const preview = previewMove(game, 'a7', 'b8');
  assert.equal(preview.promotion, 'q');
  assert.deepEqual(preview.victim, { square: 'b8', type: 'r', color: 'b' });
  assert.deepEqual(inspectPiece(game, 'b8').legalDestinations, []);
  assert.equal(inspectPiece(game, 'a2'), null);
  assert.equal(game.get('a7').type, 'p'); assert.equal(game.get('b8').type, 'r');
});

test('pinned controllers remain geometric threats while pinned selected pieces have only legal moves', () => {
  const game = new Chess('4k3/4n3/8/3N4/8/8/8/K3R3 w - - 0 1');
  const piece = inspectPiece(game, 'd5');
  assert.deepEqual(piece.attackers, [{ square: 'e7', type: 'n', color: 'b' }]);
  assert.equal(piece.controlScope, 'ordinary');
  const enemyTurn = new Chess(game.fen().replace(' w ', ' b '));
  assert.equal(enemyTurn.moves({ square: 'e7', verbose: true }).some(move => move.to === 'd5'), false);
  const pinned = new Chess('4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1');
  assert.equal(inspectPiece(pinned, 'e2').legalDestinations.includes('d2'), false);
  assert.ok(inspectPiece(pinned, 'e2').legalDestinations.includes('e8'));
});

test('inspection explains check and its legal capture escape without claiming a best move', () => {
  const game = new Chess('4k3/6p1/5N2/8/8/8/8/4K3 b - - 0 1');
  const before = { fen: game.fen(), history: game.history(), hash: game.hash() };
  const pawn = inspectPiece(game, 'g7');
  assert.equal(pawn.inCheck, true); assert.equal(pawn.kingSquare, 'e8');
  assert.deepEqual(pawn.checkers, [{ square: 'f6', type: 'n', color: 'w' }]);
  assert.deepEqual(pawn.legalDestinations, ['f6']); assert.deepEqual(pawn.captureDestinations, ['f6']);
  const target = previewMove(game, 'g7', 'f6');
  assert.equal(target.escapesCheck, true);
  assert.deepEqual(target.victim, { square: 'f6', type: 'n', color: 'w' });
  assert.equal(previewMove(game, 'g7', 'g6'), null);
  assert.deepEqual({ fen: game.fen(), history: game.history(), hash: game.hash() }, before);
});

test('destination controllers describe the resulting position after capture and en passant removal', () => {
  const game = new Chess('7k/8/2p5/3r4/4B3/2N5/8/K7 w - - 0 1');
  const target = previewMove(game, 'c3', 'd5');
  assert.deepEqual(target.attackers, [{ square: 'c6', type: 'p', color: 'b' }]);
  assert.deepEqual(target.defenders, [{ square: 'e4', type: 'b', color: 'w' }]);
  assert.deepEqual(target.victim, { square: 'd5', type: 'r', color: 'b' });
  assert.equal(target.controlled, true);
  assert.equal(game.get('d5').type, 'r');
  const ep = new Chess('7k/8/8/3pP3/8/8/8/K2R4 w - d6 0 1');
  const before = ep.fen();
  const enPassant = previewMove(ep, 'e5', 'd6');
  assert.deepEqual(enPassant.victim, { square: 'd5', type: 'p', color: 'b' });
  // Removing the victim opens the rook's file; the original position cannot see this defender.
  assert.deepEqual(ep.attackers('d6', 'w'), ['e5']);
  assert.deepEqual(enPassant.defenders, [{ square: 'd1', type: 'r', color: 'w' }]);
  assert.deepEqual(enPassant.attackers, []); assert.equal(ep.fen(), before);
});

test('special inspection follows armed movement while controls stay ordinary and resources stay untouched', () => {
  const game = new SpecialChess('7k/8/8/2r5/8/2N5/8/K7 w - - 0 1');
  const ordinary = inspectPiece(game, 'c3');
  assert.equal(ordinary.ultimate, false); assert.equal(ordinary.variant, true);
  assert.equal(ordinary.legalDestinations.includes('c5'), false);
  game.armed = 'c3';
  const before = { fen: game.fen(), snapshot: game.snapshot(), history: game.history(), armed: game.armed };
  const ultimate = inspectPiece(game, 'c3');
  assert.equal(ultimate.ultimate, true); assert.ok(ultimate.legalDestinations.includes('c5'));
  assert.deepEqual(ultimate.captureDestinations, ['c5']);
  assert.equal(ultimate.controlScope, 'ordinary');
  const target = previewMove(game, 'c3', 'c5');
  assert.equal(target.ultimate, true); assert.deepEqual(target.victim, { square: 'c5', type: 'r', color: 'b' });
  assert.deepEqual({ fen: game.fen(), snapshot: game.snapshot(), history: game.history(), armed: game.armed }, before);
  assert.equal(game.isAttacked('c8', 'w'), false);
});

test('variant inspection includes active chaos destinations and preview preserves counters and history', () => {
  const game = new VariantChess('chaos', { seed: 1 });
  game.move('Nf3'); game.move('Nc6');
  assert.equal(game.progress().phase, 'knight');
  const before = { fen: game.fen(), snapshot: game.snapshot(), history: game.history() };
  const piece = inspectPiece(game, 'f3');
  assert.equal(piece.variant, true); assert.equal(piece.ultimate, false);
  assert.equal(piece.controlScope, 'ordinary');
  assert.ok(piece.legalDestinations.includes('g4'));
  assert.equal(new Chess(game.fen()).moves({ square: 'f3', verbose: true }).some(move => move.to === 'g4'), false);
  const target = previewMove(game, 'f3', 'g4');
  assert.equal(target.to, 'g4'); assert.equal(target.ultimate, false);
  assert.equal(target.controlScope, 'ordinary');
  assert.deepEqual({ fen: game.fen(), snapshot: game.snapshot(), history: game.history() }, before);
});
