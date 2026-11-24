import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAtom, combineCurated } from "../lib/chem";
import { addBuiltAtom, assemble, sample, restore } from "../lib/game";

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

test("canvas assembly preserves duplicates, isotope counts, and undo snapshots", () => {
  const game = restore(null);
  const proton = sample("Proton", 20, 30);
  const spare = sample("Proton", 70, 70);
  const electron = sample("Electron", 30, 20);
  const before = { ...game.hard, items: [proton, spare, electron] };
  const hydrogen = assemble(before, electron, proton);
  assert.deepEqual(before.items, [proton, spare, electron]);
  assert.deepEqual(hydrogen.items.map(i => i.id), ["particle-group", "hydrogen"]);
  assert.equal(hydrogen.items[0].key, spare.key);
  const neutron = sample("Neutron", 0, 0);
  const deuterium = assemble(hydrogen, neutron, hydrogen.items[1]);
  const ion = assemble(deuterium, spare, deuterium.items[1]);
  assert.equal(ion.items[0].id, "particle-group");
  assert.deepEqual(restore(JSON.stringify({ ...game, hard: ion })).hard, ion);
  const helium = assemble(ion, sample("Electron", 0, 0), ion.items[0]);
  assert.equal(helium.items[0].id, "helium");
  assert.deepEqual(helium.items[0].counts, { protons: 2, neutrons: 1, electrons: 2 });
  assert.deepEqual(helium.discoveries.map(s => s.id), ["hydrogen", "helium"]);
  assert.deepEqual(restore(JSON.stringify({ ...game, hard: helium })).hard, helium);
});

test("failed assemblies leave both instances available", () => {
  const items = [sample("Proton", 20, 30), sample("Proton", 40, 50)];
  const lab = { ...restore(null).hard, items };
  const before = structuredClone(lab);
  assert.throws(() => assemble(lab, items[0], items[1]), /neutron/);
  assert.throws(() => assemble(lab, items[0], sample("water", 0, 0)), /canvas-built/);
  assert.deepEqual(lab, before);
});

test("a v1 guest resumes their selected mode and original canvas", () => {
  const oldSave = {
    mode: "easy", grid: false,
    easy: { items: [{ key: "legacy", id: "oxygen", x: 77, y: 46 }], discoveries: [], log: [] },
    hard: { items: [], discoveries: [], log: [] },
  };
  assert.deepEqual(restore(JSON.stringify(oldSave)), oldSave);
});
