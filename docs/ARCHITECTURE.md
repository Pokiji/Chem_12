# Architecture

## Browser and workspace

Next.js renders the first laboratory view. React restores the browser save after hydration, then persists subsequent changes under `little-chemistry.v1`. The save contains separate Easy and Hard labs, the active mode, and the grid preference. Each lab has a workspace, discoveries, and the latest 150 journal entries. Up to 20 workspace snapshots support undo within a session.

A sample instance has a unique key, stable substance ID, and percentage coordinates. Pointer capture tracks movement, and release near another sample resolves a pair. Click-to-combine uses the same resolution path. Successful reactions replace both samples with one product. Failed reactions leave them available. Each pair of samples represents the relative amounts in the displayed equation.

The atom builder passes integer counts to the shared domain function. The element index establishes identity, the sum of nucleons gives mass number, and protons minus electrons gives charge. A lookup against observed ground-state masses determines the isotope label. Game bounds limit unsupported inputs. Constructed samples enter the neutral-element crafting catalog.

## Combination flow

1. A known pair resolves locally from the curated data. Direct API clients use the same rules.
2. The API resolves trusted substance IDs and sorts the pair. It checks curated recipes, in-process memory, Redis, and PostgreSQL.
3. On a cache miss the deterministic rule layer handles identical samples and selected inert pairs.
4. With inference enabled, the server checks the rate limit and calls the authenticated gateway. The gateway allows one in-flight job and calls loopback Ollama.
5. Zod validates the response, the provider checks elemental balance and assigns hypothetical status. Local icon descriptors control rendering.
6. A single database transaction acquires a per-pair lock, returns an existing winner or stores the generated substance and combination. Redis stores the committed result for one day.
7. An unavailable gateway or unsupported proposal produces a journal explanation. The offline guest path remains usable.

## Data and trust boundaries

```text
Browser ── same-origin request ── Next.js on Vercel
                                   ├─ Redis REST (limits and cache)
                                   ├─ Supabase PostgreSQL (PostgREST / transactional RPC)
                                   └─ HTTPS + Access token + bearer authentication
                                       └─ outbound tunnel to loopback gateway
                                           └─ loopback Ollama /api/generate
```

Model and service credentials stay in server environments. Gateway routing uses a configured origin and fixed local Ollama endpoint. Size limits cover client inputs, model output, and server-side streams. The server constructs equations and educational caveats. The app renders local SVG geometry.

The catalog tables are publicly readable under RLS. Generated combination writes require the service role. Optional player profile, discovery, session, and workspace tables use ownership policies tied to Supabase Auth. A composite foreign key ties workspace ownership to its session. Guest browser storage is the active progression adapter.

## HTTP contracts

JSON endpoints respond with `X-API-Version: 1`. Errors use an `error` string. Inference outages return an ordinary insufficient-information result so play can continue.

| Method and path | Input | Result |
| --- | --- | --- |
| GET /api/elements | None | Element catalog in atomic-number order |
| GET /api/substances | None | Curated substance catalog |
| POST /api/atoms/build | Integer protons, neutrons, electrons | Element, isotope status, mass, signed charge and counts |
| POST /api/combinations | Two sample IDs in a and b | Classification, equation, conditions, explanation and optional product |
| GET /api/discoveries | None | Guest storage descriptor and empty server-side collection |

Invalid requests receive 400, unknown IDs receive 404, and inference limits return 429. Adding condition-dependent outcomes requires extending the cache key and migrating uniqueness rules. [Deployment](deployment.md)

