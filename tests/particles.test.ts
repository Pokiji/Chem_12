import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAtom, combineCurated } from "../lib/chem";
import { addBuiltAtom, restore } from "../lib/game";

test("new guests build reusable neutral samples from particles before reacting", () => {
  const game = restore(null);
  assert.equal(game.mode, "hard");
  assert.deepEqual(game.hard, { items: [], discoveries: [], log: [] });
  const hydrogen = buildAtom(1, 0, 1);
  assert.throws(() => addBuiltAtom(game.hard, buildAtom(1, 0, 0)), /neutral/);
  const once = addBuiltAtom(game.hard, hydrogen);
  const twice = addBuiltAtom(once, hydrogen);
  assert.equal(twice.discoveries.length, 1);
  assert.notEqual(twice.items[0].key, twice.items[1].key);
  const lab = addBuiltAtom(twice, buildAtom(8, 8, 8));
  assert.deepEqual(lab.discoveries.map((s) => s.id), ["hydrogen", "oxygen"]);
  assert.equal(lab.log.length, 3);
  assert.equal(combineCurated(lab.items[0].id, lab.items[2].id)?.product?.id, "water");
  assert.deepEqual(restore(JSON.stringify({ ...game, hard: lab })).hard, lab);
});

test("a v1 guest resumes their selected mode and original canvas", () => {
  const oldSave = {
    mode: "easy", grid: false,
    easy: { items: [{ key: "legacy", id: "oxygen", x: 77, y: 46 }], discoveries: [], log: [] },
    hard: { items: [], discoveries: [], log: [] },
  };
  assert.deepEqual(restore(JSON.stringify(oldSave)), oldSave);
});
