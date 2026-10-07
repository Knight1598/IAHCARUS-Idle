import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
test("Fools mate ends a legal game", () => {
  const g = new Chess();
  for (const m of ["f3", "e5", "g4", "Qh4#"]) g.move(m);
  assert.equal(g.isCheckmate(), true);
});
test("promotion offers four choices", () => {
  const g = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
  assert.equal(
    g.moves({ square: "a7", verbose: true }).filter((m) => m.to === "a8")
      .length,
    4,
  );
});
test("en passant removes the pawn off the destination", () => {
  const g = new Chess();
  for (const m of ["e4", "a6", "e5", "d5"]) g.move(m);
  const m = g.move("exd6");
  assert.ok(m.flags.includes("e"));
  assert.equal(g.get("d5"), undefined);
});
