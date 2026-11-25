# Technical handoff

Little Chemistry runs as a Next.js App Router game. Start with `npm ci` and `npm run dev`. Guest play needs no secrets. The main UI is `components/Laboratory.tsx`.

- **Scientific truth** comes from `data/elements.json`, `data/recipes.json`, and `lib/chem.ts`. The catalog covers 118 elements, 3,339 observed isotope entries and 23 curated neutral reactions and both directions of water autoionization. Sources and isotope bounds are documented.
- **Progression** uses versioned, validated local storage in `lib/game.ts`. Easy Mode exposes elements immediately. New guests start in Hard Mode with reusable subatomic particles. Canvas particle groups and built atoms store their exact counts per instance. Partial groups combine locally through the atom builder rules. A neutral result unlocks a reusable elemental sample. Two neutral samples use chemical reaction rules. Library copies and legacy v1 items without counts represent bulk samples. Restoring a save retains its selected mode. Both modes use the same crafting engine.
- **Server flow** runs through `app/api/combinations/route.ts` and `lib/server/combinations.ts`. Prefer curated results, cached results, deterministic rules, then validated hypothetical proposals. Unknown pairs can remain unresolved.
- **Inference** uses a server-only provider and a separate authenticated loopback gateway. The remote model is Llama 3.1 8B. The JSON proposal must conserve elemental counts. Its name and icon are restricted.
- **Persistence** uses Supabase for shared generated combinations, Redis for hot reads and production inference limits, and local process adapters when unconfigured. Future accounts have RLS-protected tables.
- **Checks** are `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Model and data-service tests use mocks. Production services require deployment credentials.

Primary extension points are multi-product reactions, conditions in canonical keys, cloud synchronization, additional scientific data and icon renderers. [Architecture](ARCHITECTURE.md) · [Deployment](deployment.md) · [Data provenance](../data/SOURCES.md)

The acid and base library filters use curated substance IDs. Water combines with carbon dioxide or sulfur trioxide to discover an acid and with magnesium or calcium oxide to discover a hydroxide base. Ammonia is also a base. These are qualitative discoveries with reaction conditions in the journal.

Water + water returns ordered `products` (hydronium and hydroxide). The reverse returns two water samples. Older recipes and inference return one bulk sample in `product`. Ion formulas include a trailing ASCII charge for storage and display with a superscript. Ion pairs outside the curated catalog resolve before cache lookup or inference. The v1 guest reader accepts both the original single-product history and optional ordered product IDs. Apply migration 002 before seeding multi-output recipes. Their ordered foreign keys are in `chemical_recipe_products`, with the legacy single-product column null.
