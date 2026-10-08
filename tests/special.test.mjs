import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { SpecialChess } from '../src/special.ts';
import { previewMove } from '../src/tactics.ts';
import { appearanceMap } from '../src/cosmetics.ts';
import { readProfile } from '../src/profile.ts';
import { battleMVP } from '../src/progression.ts';

test('knight queen-move respects blockers, captures once, and does not acquire queen attacks', () => {
  const g = new SpecialChess('7k/8/8/2r5/8/2N5/8/K7 w - - 0 1');
  assert.ok(g.ultimateMoves('c3').some(m => m.to === 'c5' && m.captured === 'r'));
  assert.ok(!g.ultimateMoves('c3').some(m => m.to === 'c6'));
  g.move({ from: 'c3', to: 'c5', ultimate: true });
  assert.deepEqual(g.remaining, { w: 2, b: 3 });
  assert.equal(g.get('c5').type, 'n'); assert.equal(g.spent('c5'), true);
  assert.equal(g.isAttacked('c8', 'w'), false);
  g.move('Kg7'); assert.equal(g.available('c5'), false);
  assert.throws(() => g.move({ from: 'c5', to: 'c7', ultimate: true }));
});

test('six piece skills have distinct destinations, king cannot capture or cross an attacked square', () => {
  for (const [piece, expected, forbidden] of [['b','e3','f3'],['r','e5','f6'],['q','d5','c5']]) {
    const g = new SpecialChess(`7k/8/8/8/8/2${piece.toUpperCase()}5/8/K7 w - - 0 1`);
    const to = g.ultimateMoves('c3').map(m => m.to);
    assert.ok(to.includes(expected), piece); assert.ok(!to.includes(forbidden), piece);
  }
  const king = new SpecialChess('7k/8/8/8/8/8/8/K7 w - - 0 1');
  assert.ok(king.ultimateMoves('a1').some(m => m.to === 'c1'));
  const blocked = new SpecialChess('7k/8/8/8/8/8/1r6/K7 w - - 0 1');
  assert.ok(!blocked.ultimateMoves('a1').some(m => m.to === 'c1'));
  const pawn = new SpecialChess('7k/8/8/8/3p4/3P4/8/K7 w - - 0 1');
  assert.deepEqual(pawn.ultimateMoves('d3').map(m => m.to), ['d4']);
});

test('pinned ultimates cannot expose own king and no skill captures either king', () => {
  const g = new SpecialChess('4r2k/8/8/8/8/8/4N3/4K3 w - - 0 1');
  assert.ok(!g.ultimateMoves('e2').some(m => m.to === 'd2'));
  assert.ok(g.ultimateMoves('e2').some(m => m.to === 'e8'));
  const near = new SpecialChess('2k5/8/8/8/8/2N5/8/K7 w - - 0 1');
  assert.ok(!near.ultimateMoves('c3').some(m => m.to === 'c8'));
});

test('mate and stalemate include ultimate escapes; ordinary chess remains unchanged', () => {
  const normal = new Chess(), special = new SpecialChess();
  for (const m of ['f3', 'e5', 'g4', 'Qh4']) { normal.move(m); special.move(m); }
  assert.equal(normal.isCheckmate(), true); assert.equal(special.isCheckmate(), false);
  assert.equal(special.isGameOver(), false);
  assert.ok(special.ultimateMoves('g1').some(m => m.to === 'f2'));
  special.move({ from: 'g1', to: 'f2', ultimate: true }); assert.equal(special.isCheck(), false);
  const fen = '7k/p4Q2/P5K1/8/8/8/8/8 b - - 0 1';
  const stale = new SpecialChess(fen);
  assert.equal(new Chess(fen).isStalemate(), true);
  assert.equal(stale.isStalemate(), false); // pawn ultimate captures the blocker
});

test('preview and cancelled arming consume nothing; undo and SAN replay restore full resources', () => {
  const initial = '7k/8/8/2r5/8/2N5/8/K7 w - - 0 1';
  const g = new SpecialChess(initial); g.armed = 'c3';
  const snapshot = g.snapshot(), fen = g.fen();
  const preview = previewMove(g, 'c3', 'c5');
  assert.equal(preview.ultimate, true); assert.equal(preview.captured, 'r');
  assert.deepEqual(g.snapshot(), snapshot); assert.equal(g.fen(), fen); assert.deepEqual(g.history(), []);
  g.armed = null; assert.equal(previewMove(g, 'c3', 'c5'), null);
  g.move({ from: 'c3', to: 'c5', ultimate: true }); g.move('Kg7');
  const restored = new SpecialChess(initial);
  for (const m of g.history()) restored.move(m);
  assert.equal(restored.fen(), g.fen()); assert.deepEqual(restored.snapshot(), g.snapshot());
  g.undo(); g.undo(); assert.equal(g.fen(), fen); assert.deepEqual(g.snapshot(), snapshot);
});

test('promotion keeps identity spent, rook ultimate revokes castling and clears en passant', () => {
  const promo = new SpecialChess('r6k/P7/8/8/8/8/8/7K w - - 0 1');
  assert.equal(promo.ultimateMoves('a7').filter(m => m.to === 'a8').length, 4);
  promo.move({ from: 'a7', to: 'a8', promotion: 'n', ultimate: true });
  assert.equal(promo.get('a8').type, 'n'); assert.equal(promo.spent('a8'), true);
  const castle = new SpecialChess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  castle.move({ from: 'h1', to: 'g2', ultimate: true });
  assert.equal(castle.fen().split(' ')[2], 'Qkq');
  castle.undo(); assert.equal(castle.fen().split(' ')[2], 'KQkq');
  const ep = new SpecialChess('7k/8/8/3pP3/8/2N5/8/K7 w - d6 0 1');
  ep.move({ from: 'c3', to: 'c4', ultimate: true }); assert.equal(ep.fen().split(' ')[3], '-');
});

test('shared reserve caps at three and individual identities follow normal moves and castling', () => {
  const g = new SpecialChess('7k/8/8/8/8/8/NNN5/K7 w - - 0 1');
  for (const from of ['a2', 'b2', 'c2']) {
    g.move({ from, to: from[0] + '3', ultimate: true }); g.move(g.history().length === 1 || g.history().length === 5 ? 'Kg7' : 'Kh8');
  }
  assert.equal(g.remaining.w, 0); assert.deepEqual(g.ultimateMoves(), []);
  const castle = new SpecialChess('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
  const ids = castle.snapshot().origins;
  castle.move('O-O'); assert.equal(castle.snapshot().origins.f1, ids.h1); assert.equal(castle.snapshot().origins.g1, ids.e1);
});

test('cosmetic identity follows ultimate capture and replay can read before/after snapshots', () => {
  const g = new SpecialChess('7k/8/8/2r5/8/2N5/8/K7 w - - 0 1');
  const initial = g.fen(), profile = readProfile(null);
  profile.loadouts.w.c3 = 'ember';
  g.move({ from: 'c3', to: 'c5', ultimate: true });
  assert.equal(appearanceMap(initial, g.history({ verbose: true }), profile).c5, 'ember');
  assert.ok(g.pgn().includes('[Variant "Special Duel"]'));
  assert.ok(g.pgn().includes('U:Nc3xc5'));
  assert.equal(battleMVP(initial, g.history({ verbose: true })).origin, 'c3');
});

test('threefold uses the board plus remaining abilities and undo restores repetition state', () => {
  const g = new SpecialChess();
  for (const m of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']) g.move(m);
  assert.equal(g.isThreefoldRepetition(), true); assert.equal(g.isDraw(), true);
  g.undo(); assert.equal(g.isThreefoldRepetition(), false);
});

test('ultimate checkmate notation saves and restores a completed match with exact reserves', () => {
  const initial = '7k/7B/6K1/8/2N5/8/8/8 w - - 0 1';
  const g = new SpecialChess(initial);
  const move = g.move({ from: 'c4', to: 'f7', ultimate: true });
  assert.equal(move.san, 'U:Nc4-f7#'); assert.equal(g.isCheckmate(), true);
  const restored = new SpecialChess(initial);
  for (const san of g.history()) restored.move(san);
  assert.equal(restored.isCheckmate(), true); assert.equal(restored.fen(), g.fen());
  assert.deepEqual(restored.snapshot(), g.snapshot());
});
