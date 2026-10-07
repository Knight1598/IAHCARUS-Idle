import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
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
