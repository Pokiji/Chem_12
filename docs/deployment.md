# Deployment

Use Node.js 24 or newer. Run `npm install`, then `npm run dev` and open the address printed by Next.js. Guest saves use browser storage. The atom builder and curated combinations run without external services.

Import the repository into Vercel as a Next.js project using `npm run build`. Configure optional server-only credentials from .env.example in the project environment and redeploy when they change.

## Supabase and Redis

Apply supabase/migrations/001_little_chemistry.sql in the Supabase SQL editor. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel and a local .env.local file. Run `node --env-file=.env.local scripts/seed.mjs` from the repository root. The idempotent seed uploads the periodic table, catalog and recipes. Generated products and their unordered pair are persisted in one transaction. Owner-only row policies protect the optional account tables.

Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from Upstash Redis. Hot combinations expire after one day. Vercel requires Redis for inference limits of six generations per client per minute. Local development uses a process counter. Without Supabase generated items are reusable only while the server retains their catalog entries.

## Isolated Ollama computer

1. Install Ollama and run `ollama pull llama3.1:8b`. Bind Ollama to 127.0.0.1:11434 and warm the model before testing.
2. Install the project dependencies on that machine. Generate a random bearer token of at least 32 characters and put it in CHEM_GATEWAY_TOKEN in .env.local. Run `node --env-file=.env.local scripts/gateway.mjs`. The gateway listens on 127.0.0.1:8787.
3. Create a Cloudflare Tunnel for a dedicated hostname pointing to http://127.0.0.1:8787. Run the outbound tunnel connector on the isolated machine. Keep incoming firewall ports closed. Configure a Cloudflare Access self-hosted application with a Service Auth policy scoped to one service token.
4. Set CHEM_GATEWAY_URL in Vercel to the tunnel HTTPS URL ending in /candidate. Configure CHEM_GATEWAY_TOKEN, CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET. Keep all credentials server-side.
5. Combine an unrecognized pair. The server accepts a single neutral hypothetical product only after validation of atom counts, coefficients and icon metadata. Timeouts and unsupported proposals return an explanation. The gateway admits one generation at a time.

[Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs) · [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/) · [Service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/) · [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) · [Upstash Redis REST](https://upstash.com/docs/redis/features/restapi)
