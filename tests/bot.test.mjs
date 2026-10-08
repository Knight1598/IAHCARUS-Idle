import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import { SpecialChess } from '../src/special.ts';
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
