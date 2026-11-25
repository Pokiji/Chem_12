import assert from "node:assert/strict";
import { test } from "node:test";
import { OllamaChemistryProvider } from "../lib/server/generation";
import { combineSubstances } from "../lib/server/combinations";
import { substances } from "../lib/chem";
import { discover, formulaFor, placeProducts, initialGame, restore } from "../lib/game";

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
    { ...proposed, formula: "H2O+" },
    { ...proposed, products: ["H3O+", "OH-"] },
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

test("ionic results format, persist, and bypass generated caches and providers", async (t) => {
  const noneAllowed = async () => { throw Error("unexpected inference") };
  const forward = await combineSubstances("water", "water", noneAllowed);
  assert.deepEqual(forward.products?.map(formulaFor), ["H₃O⁺", "OH⁻"]);
  const reverse = await combineSubstances("hydroxide", "hydronium", noneAllowed);
  const game = initialGame();
  game.easy.items = placeProducts(reverse.products!, 91, 50, 360, 500);
  assert.deepEqual(game.easy.items.map(i => i.id), ["water", "water"]);
  assert.equal(new Set(game.easy.items.map(i => i.key)).size, 2);
  const [first, second] = game.easy.items;
  assert.ok(Math.abs(first.x - second.x) * 3.6 >= 156 || Math.abs(first.y - second.y) * 5 >= 156);
  game.easy.discoveries = forward.products!;
  game.easy.log = [{title:"Autoionization", detail:forward.equation, time:1, success:true, productIds:["hydronium", "hydroxide"]}];
  assert.deepEqual(restore(JSON.stringify(game)), game);
  const {save} = await import("../lib/server/storage");
  t.mock.method(globalThis, "fetch", async () => Response.json(forward));
  await save("hydroxide|water", "hydroxide", "water", forward);
  const unsupported = await combineSubstances("water", "hydroxide", noneAllowed);
  assert.equal(unsupported.classification, "no-reaction");
  assert.match(unsupported.explanation, /ion pair/);
  assert.equal(await new OllamaChemistryProvider().propose(forward.products![0], inputs[0]), null);
});
