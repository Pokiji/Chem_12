import assert from "node:assert/strict";
import { test } from "node:test";
import { OllamaChemistryProvider } from "../lib/server/generation";
import { combineSubstances } from "../lib/server/combinations";
import { substances } from "../lib/chem";
import { discover, initialGame, restore } from "../lib/game";

const inputs = ["hydrogen", "oxygen"].map((id) =>
  substances.find((s) => s.id === id)!,
);
const proposed = {
  name: "Sample",
  formula: "H2O",
  coefficients: [2, 1, 2],
  icon: "droplets",
};

test("gateway candidates require a valid bounded schema and a balanced equation", async (t) => {
  const originalURL = process.env.CHEM_GATEWAY_URL,
    originalToken = process.env.CHEM_GATEWAY_TOKEN;
  process.env.CHEM_GATEWAY_URL = "https://gateway.invalid/candidate";
  process.env.CHEM_GATEWAY_TOKEN = "test-only";
  t.after(() => {
    if (originalURL === undefined) delete process.env.CHEM_GATEWAY_URL;
    else process.env.CHEM_GATEWAY_URL = originalURL;
    if (originalToken === undefined) delete process.env.CHEM_GATEWAY_TOKEN;
    else process.env.CHEM_GATEWAY_TOKEN = originalToken;
  });
  let payload: unknown = proposed;
  const mocked = t.mock.method(globalThis, "fetch", async () =>
    Response.json(payload),
  );
  const provider = new OllamaChemistryProvider();
  const call = () => provider.propose(inputs[0], inputs[1]);
  const result = await call();
  assert.equal(result?.classification, "hypothetical");
  assert.equal(result?.product?.formula, "H2O");
  for (const altered of [
    { ...proposed, formula: "H2O2" },
    { ...proposed, icon: "<svg>" },
    { ...proposed, name: "<script>" },
    { ...proposed, coefficients: [-2, 1, 2] },
  ]) {
    payload = altered;
    assert.equal(await call(), null);
  }
  mocked.mock.mockImplementation(async () => {
    throw Error("gateway offline");
  });
  const fallback = await combineSubstances("silver", "gold", async () => true);
  assert.equal(fallback.classification, "no-reaction");
  assert.match(fallback.explanation, /unavailable/);
  assert.equal(
    (await combineSubstances("oxygen", "hydrogen", async () => false)).product
      ?.id,
    "water",
  );
});

test("guest save retains discoveries, samples, history, and independent modes", () => {
  const game = initialGame();
  const water = substances.find((s) => s.id === "water")!;
  game.easy.discoveries = discover(game.easy, water);
  game.easy.discoveries = discover(game.easy, water);
  game.easy.log = [
    {
      time: 1,
      title: "Water",
      detail: "Balanced",
      success: true,
      productId: "water",
    },
  ];
  assert.deepEqual(restore(JSON.stringify(game)), game);
  assert.equal(game.easy.discoveries.length, 1);
  assert.equal(game.hard.discoveries.length, 0);
  assert.equal(restore("{").easy.items.length, 4);
});
