# SOCRATIVA

Institutional Socratic learning MVP — implementation in progress.

## Current deliverable

A full-stack demo with persistent, browser-isolated student/lecturer sandboxes, classes, activities, notes, session history, reflections, private document uploads and extraction previews, aggregate analytics, and a server-only two-stage AI adapter. Live inference needs a provider key configured in the hosting environment. The application explicitly labels this setup state and never substitutes canned answers for model output.

This is **not yet the PRD's completed production MVP**. See `docs/AUDIT.md` for the acceptance gaps.

## Stack and explicit deviations

- Next.js App Router conventions, React 19, TypeScript strict, Tailwind and custom accessible components, Lucide icons.
- Vinext compatibility runtime because the supplied Sites hosting runs Cloudflare Workers.
- Drizzle ORM with D1 and private R2 for this isolated hosted demo.
- The institutional authentication and PostgreSQL/pgvector deployment in the original PRD are not part of this demo. No Supabase project is used.
- When ChatGPT Sites identity exists, demo sessions are bound to it. Public visitors receive a second random HttpOnly/Secure owner cookie; only its hash is stored. Role switching stays inside that browser's isolated demo institution. This is a public demonstration boundary, not production institutional authentication or role assignment.
- Retrieval uses cosine similarity over stored embedding arrays in this bounded demo; the seeded demonstration text uses keyword retrieval. This is not pgvector and is not claimed to meet that infrastructure requirement.

## Setup

Use Node 24 (tests use `node:sqlite`) and the pinned pnpm version in `packageManager`.

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
```

Sites setup/build/deployment use the installed Sites helper scripts. The hosting manifest declares `DB` and `BUCKET`; deployment applies tracked Drizzle migrations. No runtime schema creation is performed. To change the schema: edit `db/schema.ts`, run `pnpm run db:generate`, inspect generated SQL and preserve already-applied migrations.

### Uploading the source to GitHub

Upload the whole source tree, including `.openai/hosting.json`, `drizzle/`, `build/`, `scripts/`, `app/`, `components/`, `db/`, `lib/`, `tests/`, `package.json`, and `pnpm-lock.yaml`. Do **not** upload `node_modules`, `.env.local`, `.wrangler`, `.next`, `.vinext`, or `dist`. This repository is a Cloudflare Worker app with D1 and R2 bindings. GitHub Pages cannot run the API, database, and private uploads; a GitHub repository also does not deploy the app by itself. The current source is **not Vercel-ready** because it imports `cloudflare:workers` and uses D1/R2. Use the existing Sites hosting workflow or adapt and provision equivalent resources before deploying to another host.

The first demo selection transaction seeds a new isolated institution, a primary student/dosen pair, an educational psychology course, a mindset activity, explicitly labeled demonstration text, and five fictional learners with aggregate-only sessions. These records make the lecturer analytics demonstrable above its privacy threshold and are labeled **Data simulasi untuk demonstrasi**. Role changes keep the same sandbox. Reset is available through `POST /api/demo` with `reset: true`; it creates a new sandbox, does not erase previous records, and rotates the current cookie. A production retention/purge job is not implemented.

## Server configuration

Use server-side hosting secrets, never source code or `.openai/hosting.json` for API keys. `.env.example` has Gemini example values without a key. Set `AI_API_KEY` in the hosting dashboard; the browser never receives it.

| Variable          | Purpose                                                                   |
| ----------------- | ------------------------------------------------------------------------- |
| `AI_API_KEY`      | Server-side model credential                                              |
| `AI_BASE_URL`     | HTTPS OpenAI-compatible endpoint; Gemini example is in `.env.example`     |
| `AI_MODEL_MAIN`   | Tutor model supporting chat completions JSON-object output                |
| `AI_MODEL_FAST`   | Analyzer model supporting chat completions JSON-object output             |
| `EMBEDDING_MODEL` | Embedding model for uploaded documents                                    |

A ChatGPT subscription does not configure these runtime values. The app builds without model credentials and returns a clear 503 after saving the user's message. Google offers an OpenAI-compatible Gemini endpoint, but a live Gemini request has not been verified for this deployment. Check available models and quota in Google AI Studio when adding the key.

## Data and authorization

All APIs verify the hashed demo session and either platform identity or the hashed anonymous owner cookie. Course queries require matching institution and membership; lecturer mutations require course ownership. Transcripts, feedback and summaries require session ownership. No role/user/tenant fields from client JSON are trusted. Mutations enforce same-origin requests. Rate limits are persisted. Demo creation and message submission also rate limit trusted edge IP information when present.

Messages use unique `(session_id, request_key, role)` keys. The session has a bounded generation lease. The user message is saved before calling the provider, and the validated tutor answer, citation rows, signals and next state are committed with D1 batch transaction semantics. Retry reuses the key. The response is streamed as NDJSON **after** complete structured-output validation and persistence. This favors correctness but does not yet meet the PRD's target time to first token. Stop cancels the client request; the provider may finish before cancellation is observed.

Citations must refer to an actually retrieved chunk with exact material ID, page metadata and a quote that is a substring of its source. This establishes provenance; it cannot by itself guarantee semantic entailment of every model claim.

## Documents

PDF/TXT, maximum 5 MB, PDF maximum 60 pages, at most 200,000 extracted characters / 90 chunks. PDF.js via unpdf extracts pages sequentially, with eval and image rendering disabled. Scanned PDFs without text return a clear failure. DOCX and OCR are not implemented. Chunks currently use a 2,800-character target and 400-character overlap, approximately 700/100 tokens; an exact model tokenizer remains an acceptance gap.

Uploads are PRIVATE by default. Failed embeddings leave extraction previews available for the lecturer but exclude the document from retrieval. READY is set only after embedding success, except the explicit seed demonstration text. Publishing the material is a separate lecturer action. READY documents are immutable in this version; replacement requires a new upload.

## Tests and limits

`pnpm test` executes real API handlers and Drizzle queries against a SQLite-backed D1 test adapter and a private-object-storage test adapter. External AI responses are explicitly mocked. Twenty-six tests cover anonymous public entry, repeated role switching, role/tenant isolation, CSRF, private transcripts, atomic persistence, retry idempotency, notes/reflections, PDF page extraction, upload rejection, document readiness, lecturer mutations, audit logs, aggregate cohort behavior, rate limits, pedagogy and citation validation.

This is not a live Gemini or browser end-to-end test. Desktop/mobile layouts are implemented in CSS but require visual/device verification. Primary links use native browser navigation so they do not depend on the beta client router.

## Source map

- `app/api/[...path]/route.ts`: API routing and authorization.
- `lib/security.ts`, `lib/demo.ts`: authentication, scopes, rate limits, isolated seed.
- `lib/ai.ts`, `lib/pedagogy.ts`, `lib/learning.ts`: model adapter, policy state, sessions, retrieval.
- `lib/documents.ts`: private upload, extraction, embedding and publication state.
- `lib/analytics.ts`: persisted aggregates and minimum cohort threshold.
- `components/`: landing, workspace, class management, dialogue and reflection.
- `db/schema.ts`, `drizzle/`: schema and migrations.
- `tests/`: unit and API/database integration tests.

Reference implementations consulted: https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create and https://github.com/unjs/unpdf .
#   S O C R A T I V A _ A I  
 