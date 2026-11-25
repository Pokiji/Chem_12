# Working on Little Chemistry

Maintain a playable chemistry sandbox where a guest can experiment immediately. Preserve local play whenever optional services are slow or disconnected.

## Repository map

- `app/` contains the Next.js entry points, visual tokens, responsive styling and route handlers.
- `components/Laboratory.tsx` owns workspace interaction, dialogs, history and mode selection. `LabDialogs.tsx` contains the atom builder, periodic table, and inspector. `Molecule.tsx` renders local models from trusted descriptors.
- `lib/game.ts` defines guest saves, starting workspaces, sample identity, and discovery deduplication.
- `lib/chem.ts` owns the scientific types, catalog, deterministic build rules, and curated matching.
- `data/` contains elements, isotope mass numbers, and reactions with source notes.
- `lib/server/` contains input parsing, combination resolution, inference, caching, and persistence.
- `scripts/` contains the loopback Ollama gateway and idempotent catalog seeder.
- `supabase/migrations/`, `tests/`, and `docs/` contain database history, executable checks, and technical handoff material.

## Modification rules

Use strict TypeScript, plain serializable data, and the existing domain types. Keep calculated chemistry in the engine. Preserve stable substance IDs and the versioned guest save key. Add a migration and compatibility tests when changing stored shapes. Keep mode workspaces independent. Use normalized coordinates for samples and unique instance keys for duplicate substances.

Each element record must occupy its atomic-number position. The current catalog covers all 118 recognized elements. Use the documented CIAAW mass convention, source isotope changes, and update the source snapshot notes. Empty oxidation-state arrays indicate unavailable common states.

To add a recipe, edit `data/recipes.json` with two catalog IDs, matching reactant formulas, a stable product ID, coefficients, a balanced equation, appropriate conditions, a concept, and an application. Check the source supports the product and conditions. Preserve atom counts and charge. Curated molecular events may specify ordered productIds, repeating an ID for each output instance. Generated proposals require neutral inputs and a single neutral product. Add a named rendering model when useful and re-run the seed for database-backed deployments.

Model output is an untrusted proposal. Restrict input length, time, JSON schema, coefficients, formula grammar and icon vocabulary. Recheck conservation before persistence. Only curated evidence can grant verified status. Keep gateway credentials on the server. Render strings through React text nodes.

Apply database changes as versioned migrations. Preserve unique pair keys, atomic transactions, foreign keys, RLS, and per-user ownership across related records. Service-role secrets belong in server environments.

## Checks and current status

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Test a fresh guest session, restore after refresh, Hard Mode atom creation, drag collision, and click-to-combine when changing interactions. Verify a timed-out inference request leaves both inputs available.

The guest MVP, 23 neutral recipes and both directions of water autoionization, secure inference adapter, database schema, and optional cache are implemented. Account sign-in and cloud sync are future work. Update the handoff when changing system boundaries or supported chemistry. [Handoff](docs/LLM_CONTEXT.md)

