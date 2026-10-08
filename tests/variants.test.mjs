import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { VariantChess, variantInitialFen, validateDraft, draftCost, defaultDraft, encodeChallenge, decodeChallenge, rushPuzzle } from '../src/variants.ts';

test('draft validates a mandatory king, budget and composition before constructing a board', () => {
  assert.deepEqual(validateDraft(defaultDraft), { valid: true, error: undefined, cost: 24 });
  for (const roster of [['q','p','p'],['k','k','p'],['k','q','q','p'],['k',...Array(7).fill('p')],['k','q','r','r','n','n']]) assert.equal(validateDraft(roster).valid, false);
  assert.equal(validateDraft(['k','n','p']).valid, true);
  assert.throws(() => new VariantChess('draft', { seed: 1, draft: ['k','q','q'] }));
});

test('draft opponent uses exactly the chosen budget and color ownership survives challenge seeds', () => {
  for (const seed of [0, 1, 7, 42, 1203, 0xffffffff]) for (const roster of [defaultDraft, ['k','n','p'], ['k','r','r','n','n','b']]) for (const draftColor of ['w','b']) {
    const fen = variantInitialFen('draft', { seed, draft: roster, draftColor });
    const game = new Chess(fen);
    const own = game.board().flat().filter(p => p?.color === draftColor).map(p => p.type);
    const enemy = game.board().flat().filter(p => p && p.color !== draftColor).map(p => p.type);
    assert.deepEqual(own.sort(), [...roster].sort());
    assert.equal(draftCost(enemy), draftCost(roster));
    assert.equal(game.isCheck(), false);
    assert.equal(fen.split(' ')[2], '-');
    assert.equal(fen, variantInitialFen('draft', { seed, draft: roster, draftColor }));
  }
});

test('mirror armies are symmetric, legal and protected from immediate first-turn captures', () => {
  const positions = new Set();
  for (let seed = 0; seed < 128; seed++) {
    const fen = variantInitialFen('mirror', { seed }), game = new Chess(fen);
    positions.add(fen);
    assert.equal(fen, variantInitialFen('mirror', { seed, round: 2 }));
    assert.equal(game.isCheck(), false);
    assert.equal(game.isGameOver(), false);
    assert.ok(game.moves({ verbose: true }).every(move => !move.captured));
    for (const piece of game.board().flat().filter(Boolean)) {
      const reflected = game.get(`${piece.square[0]}${9 - Number(piece.square[1])}`);
      assert.equal(reflected.type, piece.type); assert.notEqual(reflected.color, piece.color);
    }
  }
  assert.ok(positions.size >= 8, `expected meaningful seed variation; got ${positions.size}`);
});

test('score captures use piece value and undo/reload restore exact counters', () => {
  const game = new VariantChess('score', { seed: 3 }, '7k/8/8/q7/8/8/7P/R6K w - - 0 1');
  const original = game.snapshot(), move = game.move({ from: 'a1', to: 'a5' });
  assert.equal(move.captured, 'q'); assert.deepEqual(game.progress().scores, { w: 9, b: 0 });
  assert.deepEqual(game.progress().turns, { w: 1, b: 0 });
  const copy = new VariantChess('score', game.options, game.fen(), game.snapshot());
  assert.deepEqual(copy.snapshot(), game.snapshot());
  assert.equal(copy.undo().san, move.san); assert.deepEqual(copy.snapshot(), original);
  const replay = new VariantChess('score', game.options, original.fen);
  for (const san of game.history()) replay.move(san);
  assert.deepEqual(replay.snapshot(), game.snapshot());
});

const scoreOpening = ['e4','e5','Nf3','Nc6','Bc4','Bc5','d3','d6','Nc3','Nf6','O-O','O-O','Re1','Re8','h3','h6','a3','a6','Ba2','Ba7','Be3','Be6','Qd2','Qd7'];
test('score ends only after both sides complete twelve turns, with a tie outcome', () => {
  const game = new VariantChess('score', { seed: 1 });
  for (const san of scoreOpening.slice(0, 23)) { game.move(san); assert.equal(game.outcome(), null); }
  game.move(scoreOpening[23]);
  assert.deepEqual(game.progress().turns, { w: 12, b: 12 });
  assert.deepEqual(game.outcome(), { winner: null, reason: 'score-limit', label: 'ครบฝ่ายละ 12 ตา' });
  assert.equal(game.isGameOver(), true);
  assert.throws(() => game.move('a4'));
  game.undo(); assert.equal(game.isGameOver(), false);
});

test('mate immediately wins score and control before their numeric objectives', () => {
  for (const id of ['score','control']) {
    const game = new VariantChess(id, { seed: 1 });
    for (const san of ['f3','e5','g4','Qh4#']) game.move(san);
    assert.deepEqual(game.outcome(), { winner: 'b', reason: 'checkmate', label: 'รุกฆาต' });
  }
});

test('control awards occupancy once per full round, respects ties and rolls back objectives', () => {
  const game = new VariantChess('control', { seed: 1 });
  const opening = ['e4','a6','h3','a5','a3','b6','b3','b5','c3','c6'];
  for (let index = 0; index < opening.length; index++) {
    game.move(opening[index]);
    assert.equal(game.progress().scores.w, Math.floor((index + 1) / 2));
    assert.equal(game.progress().scores.b, 0);
  }
  assert.deepEqual(game.outcome(), { winner: 'w', reason: 'control-target', label: 'ยึดใจกลางครบ 5 แต้ม' });
  game.undo(); assert.equal(game.progress().scores.w, 4); assert.equal(game.outcome(), null);
  const restored = game.clone(); assert.deepEqual(restored.snapshot(), game.snapshot());
  restored.move('c6'); assert.equal(restored.outcome().winner, 'w');
  const tie = new VariantChess('control', { seed: 1 });
  for (const san of ['e4','d5','h3','h6','a3','a6','b3','b6','g3','g6']) tie.move(san);
  assert.deepEqual(tie.progress().scores, { w: 5, b: 5 }); assert.equal(tie.outcome().winner, null);
  assert.equal(new VariantChess('control', { seed: 1 }, '7k/8/8/8/8/8/8/K7 w - - 0 1').isInsufficientMaterial(), false);
});

test('control repetition identity includes objective scores so holding the center can reach five', () => {
  const game = new VariantChess('control', { seed: 1 }, '1n4k1/7p/8/8/4P3/8/8/1N4K1 w - - 0 1');
  for (const san of ['Nc3','Nc6','Nb1','Nb8','Nc3','Nc6','Nb1','Nb8']) {
    game.move(san); assert.equal(game.isThreefoldRepetition(), false); assert.equal(game.outcome(), null);
  }
  assert.equal(game.progress().scores.w, 4);
  game.move('Nc3'); game.move('Nc6');
  assert.equal(game.outcome().winner, 'w'); assert.equal(game.progress().scores.w, 5);
});

test('chaos previews its deterministic next phase and permits one-step knight wind actions', () => {
  const game = new VariantChess('chaos', { seed: 7 }, '7k/8/8/3q4/8/2N5/7P/K7 w - - 0 1');
  assert.equal(game.progress().phase, 'calm'); assert.equal(game.progress().forecast, 'knight');
  game.move('h3'); game.move('Kh7');
  assert.equal(game.progress().phase, 'knight'); assert.equal(game.progress().forecast, 'bishop');
  const extra = game.moves({ square: 'c3', verbose: true }).find(m => m.to === 'd4');
  assert.equal(extra.chaos, true);
  const original = game.snapshot();
  game.move({ from: 'c3', to: 'd4' });
  assert.equal(game.history().at(-1).startsWith('C:'), true);
  assert.equal(game.get('d4').type, 'n');
  // One-turn movement has not made this knight a permanent bishop.
  assert.equal(game.isAttacked('e5', 'w'), false);
  const reconstructed = new VariantChess('chaos', game.options, original.initialFen);
  for (const san of game.history()) reconstructed.move(san);
  assert.deepEqual(reconstructed.snapshot(), game.snapshot());
  assert.deepEqual(game.undo().from, 'c3'); assert.deepEqual(game.snapshot(), original);
  assert.throws(() => game.move('Nd4')); // extra action requires C: notation or coordinate input
});

test('chaos wind cannot expose its king or capture the enemy king; bishop phase really adds straight steps', () => {
  const pinned = new VariantChess('chaos', { seed: 1 }, 'r6k/8/8/8/8/N7/7P/K7 w - - 0 1');
  pinned.move('h3'); pinned.move('Kh7');
  assert.ok(pinned.chaosMoves('a3').every(move => move.to !== 'b4' && move.to !== 'b2'));
  const game = new VariantChess('chaos', { seed: 1 }, '7k/8/8/8/8/2B5/7P/K7 w - - 0 1');
  for (const san of ['h3','Kh7','h4','Kh6']) game.move(san);
  assert.equal(game.progress().phase, 'bishop');
  const move = game.move({ from: 'c3', to: 'c4' }); assert.equal(move.chaos, true);
  assert.equal(game.get('c4').type, 'b');
});

test('rush seeds reproduce legal mate-in-one puzzles instead of impossible advertised objectives', () => {
  const positions = new Set();
  for (let seed = 0; seed < 50; seed++) for (let index = 0; index < 10; index++) {
    const puzzle = rushPuzzle(seed, index), game = new Chess(puzzle.fen);
    assert.deepEqual(puzzle, rushPuzzle(seed, index));
    assert.equal(game.turn(), puzzle.side); assert.equal(game.isGameOver(), false);
    assert.ok(game.moves({ verbose: true }).some(move => { const probe = new Chess(game.fen()); probe.move(move); return probe.isCheckmate(); }), puzzle.fen);
    positions.add(puzzle.fen);
  }
  assert.ok(positions.size >= 12);
});

test('challenge codes round-trip legal rules, reject corruption/version/malformed inputs', () => {
  for (const mode of ['draft','score','control','mirror','rush','chaos']) {
    const challenge = { mode, seed: 0xffffffff, draft: mode === 'draft' ? defaultDraft : undefined, arena: 'astral' };
    const code = encodeChallenge(challenge); assert.deepEqual(decodeChallenge(code), challenge);
    assert.equal(decodeChallenge(code.slice(0, -1) + (code.at(-1) === 'a' ? 'b' : 'a')), null);
    assert.equal(decodeChallenge(code.replace('SC1-', 'SC2-')), null);
  }
  for (const text of ['', 'SC1-deadbeef-1', 'x'.repeat(1000), 'javascript:alert(1)']) assert.equal(decodeChallenge(text), null);
  assert.throws(() => encodeChallenge({ mode: 'draft', seed: 1, draft: ['k','q','q'] }));
});
