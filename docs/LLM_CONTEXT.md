# Technical handoff

Little Chemistry runs as a Next.js App Router game. Start with `npm ci` and `npm run dev`. Guest play needs no secrets. The main UI is `components/Laboratory.tsx`.

- **Scientific truth** comes from `data/elements.json`, `data/recipes.json`, and `lib/chem.ts`. The catalog covers 118 elements, 3,339 observed isotope entries and 18 curated neutral reactions. Sources and isotope bounds are documented.
- **Progression** uses versioned, validated local storage in `lib/game.ts`. Easy Mode exposes elements immediately. New guests start in Hard Mode with reusable subatomic particles. Building a neutral atom adds its elemental sample to the canvas and library. Restoring a save retains its selected mode. Both modes use the same crafting engine.
- **Server flow** runs through `app/api/combinations/route.ts` and `lib/server/combinations.ts`. Prefer curated results, cached results, deterministic rules, then validated hypothetical proposals. Unknown pairs can remain unresolved.
- **Inference** uses a server-only provider and a separate authenticated loopback gateway. The remote model is Llama 3.1 8B. The JSON proposal must conserve elemental counts. Its name and icon are restricted.
- **Persistence** uses Supabase for shared generated combinations, Redis for hot reads and production inference limits, and local process adapters when unconfigured. Future accounts have RLS-protected tables.
- **Checks** are `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Model and data-service tests use mocks. Production services require deployment credentials.

Primary extension points are multi-product reactions, conditions in canonical keys, cloud synchronization, additional scientific data and icon renderers. [Architecture](ARCHITECTURE.md) · [Deployment](deployment.md) · [Data provenance](../data/SOURCES.md)

