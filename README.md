# Little Chemistry

Little Chemistry is a term project and browser chemistry sandbox built with React, Next.js App Router, strict TypeScript and Tailwind CSS. Play as a guest, move samples around a laboratory workspace, and discover the equations behind successful combinations.

## Play locally

Use Node.js 24 or newer with npm. From the repository root run:

```sh
npm ci
npm run dev
```

Open **http://localhost:3000**. No credentials are needed for guest play.

- **Easy mode** opens with the 118-element library and a few samples already on the canvas. Drag hydrogen onto oxygen to discover water. Inspect the resulting sample to see its formula, activation requirement in its discovery record, and chemistry concept.
- **Hard mode** starts with a particle builder. Choose a representative isotope preset or enter proton, neutron, and electron counts directly. Creating an atom unlocks its elemental sample for crafting.
- **Keyboard and touch** support selecting library entries to place them. Open a canvas sample, choose **Combine with…**, then select its partner.
- **Journal** records experiment outcomes for the selected mode. Returning to the same browser restores its workspace, discoveries, and journal. Undo restores workspace positions and samples. Discoveries remain in the collection.
- **Settings** controls the grid and resets the selected mode after confirmation.

## Systems

| Area | Implementation |
| --- | --- |
| Scientific catalog | 118 elements, a NUBASE2020 isotope snapshot, and 18 curated single-product reactions |
| Game engine | Shared deterministic atom construction, unordered recipe matching, and qualitative reaction conditions |
| Workspace | React pointer events, responsive layouts, local molecular illustrations and guest persistence |
| API | Next.js Node route handlers, bounded JSON parsing, Zod validation |
| Inference | Replaceable chemistry provider and a loopback gateway for Ollama running Llama 3.1 8B |
| Storage | Supabase PostgreSQL, transactional generated-result writes, optional Redis cache, and distributed inference rate limiting |

The browser resolves curated recipes immediately. Other pairs go to the Next.js server for cache lookup, deterministic rules, or an optional model proposal. Every accepted generated candidate is labelled hypothetical. [Architecture](docs/ARCHITECTURE.md) · [Chemistry data sources](data/SOURCES.md)

## Optional services and deployment

Copy `.env.example` to `.env.local` when using external services. Configure the same server variables in Vercel.

| Variable | Purpose |
| --- | --- |
| SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | Server access to the catalog and generated-result transaction |
| UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN | Redis HTTP cache and inference limits |
| CHEM_GATEWAY_URL, CHEM_GATEWAY_TOKEN | HTTPS candidate endpoint and its bearer credential |
| CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET | Cloudflare Access service authentication when using the documented tunnel |
| GATEWAY_PORT | Optional local inference gateway port, default 8787 |

1. Apply `supabase/migrations/001_little_chemistry.sql` to a new Supabase project. Run `npm run seed` with the Supabase credentials in `.env.local`.
2. On the inference computer, run `ollama pull llama3.1:8b`. Start the loopback Ollama service, set a shared random gateway token, and run `npm run gateway`.
3. Set up an outbound authenticated tunnel to the gateway. The browser only calls same-origin API routes.
4. Import the repository into Vercel with the Next.js preset, configure the server environment, and deploy. Redis credentials are required for production inference. Curated gameplay runs without these services.

See the deployment guide for ports, authentication, tunnel configuration, and seed instructions. [Deployment](docs/deployment.md)

## Development checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Tests exercise atomic identity, charge, isotope coverage, invalid inputs, reaction balance, unordered keys, guest saves, candidate validation, network outages, datastore adapters, and rate limits. Integration tests use mocked network responses.

## Scope and roadmap

Reaction cards model relative amounts under the stated conditions. The workspace has no adjustable temperature, pressure, solvent, or reaction kinetics. The atom builder tracks individual isotopes and charges for inspection. Crafting uses bulk, neutral elemental samples. Electron illustrations are schematic and show up to twelve markers. Unknown isotopes are labelled unverified.

Guest progress lives in one browser origin. The account tables provide a foundation for future cloud synchronization. Future work can extend the recipe model to multiple products and explicit environmental conditions, add account sync, and introduce equipment, materials, and richer atomic visualizations.

[Agent instructions](AGENTS.md) · [Technical handoff](docs/LLM_CONTEXT.md)

