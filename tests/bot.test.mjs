import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import { SpecialChess } from '../src/special.ts';
import { VariantChess } from '../src/variants.ts';
let reply;
globalThis.self = {postMessage:move=>{reply=move;}};
await import('../src/bot.ts');
for(const depth of [1,2,3]) {
  test(`bot depth ${depth} finds mate and returns a legal move`,()=>{
    const game=new Chess();for(const move of ['f3','e5','g4'])game.move(move);
    reply=null;self.onmessage({data:{fen:game.fen(),depth}});
    assert.ok(reply);game.move(reply);assert.equal(game.isCheckmate(),true);
  });
}
for(const depth of [1,2,3]) {
  test(`bot depth ${depth} also finds mate when playing white`,()=>{
    const game=new Chess();for(const move of ['e4','f6','d4','g5'])game.move(move);
    reply=null;self.onmessage({data:{fen:game.fen(),depth}});
    assert.ok(reply);game.move(reply);assert.equal(game.isCheckmate(),true);
  });
}
test('bot does not suggest a move after a terminal draw',()=>{
  reply=null;self.onmessage({data:{fen:'7k/8/8/8/8/8/8/7K w - - 0 1',depth:3}});
  assert.equal(reply,undefined);
});
for (const depth of [1, 2, 3]) {
  test(`special bot depth ${depth} uses a shared-reserve ultimate to capture a queen`, () => {
    const g = new SpecialChess('7k/8/8/2q5/8/2N5/7P/K7 w - - 0 1');
    reply = null; self.onmessage({ data: { fen: g.fen(), depth, special: g.snapshot() } });
    assert.ok(reply); assert.equal(reply.ultimate, true);
    const move = g.move(reply); assert.equal(move.captured, 'q'); assert.equal(g.remaining.w, 2);
  });
}
for (const depth of [1,2,3]) test(`chaos bot depth ${depth} returns a wind capture with its action flag`, () => {
  const game = new VariantChess('chaos', { seed: 7 }, '7k/8/8/8/3q4/2N5/7P/K7 w - - 0 1');
  game.move('h3'); game.move('Kh7'); reply = null;
  self.onmessage({ data: { fen: game.fen(), depth, variant: { id: game.id, options: game.options, snapshot: game.snapshot() } } });
  assert.ok(reply); assert.equal(reply.chaos, true);
  const move = game.move(reply); assert.equal(move.captured, 'q');
});
for (const depth of [1,2,3]) test(`control bot depth ${depth} prefers its fifth point to a queen capture`, () => {
  const fen = '7k/8/4p3/6b1/5Q2/8/7P/K7 b - - 0 1';
  const game = new VariantChess('control', { seed: 1 }, fen), snapshot = game.snapshot();
  // The worker receives the current trusted objective state separately from FEN.
  snapshot.counters = { scores: { w: 0, b: 4 }, turns: { w: 5, b: 4 } };
  const active = new VariantChess('control', game.options, fen, snapshot);
  reply = null;
  self.onmessage({ data: { fen, depth, variant: { id: active.id, options: active.options, snapshot: active.snapshot() } } });
  assert.ok(reply); assert.equal(reply.to, 'e5');
  active.move(reply);
  assert.equal(active.outcome().winner, 'b'); assert.equal(active.progress().scores.b, 5);
});
