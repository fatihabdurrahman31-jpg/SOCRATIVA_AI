# PRD acceptance audit

Status: **PARTIAL — demo implementation; not a completed production MVP.**

PASS means covered in source and automated tests under local adapters. It does not mean live provider or browser validation.

| Requirement                       | Status  | Evidence / limitation                                                                                                                                                                                   |
| --------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01 institutional login/roles | PARTIAL | Server role guards tested; production institutional enrollment, email/password and Supabase Auth not implemented.                                                                                       |
| AUTH-02 isolated demo             | PASS    | Secure hashed session plus platform identity or anonymous owner cookie, transactional seed, and public one-click entry; integration tests.                                                             |
| CRS-01 classes                    | PASS    | Create/list/tenant membership checks in API and UI.                                                                                                                                                     |
| MAT-01 PDF/TXT upload             | PARTIAL | Private upload, MIME/size validation, real PDF/TXT extraction tested. Live embedding service not configured.                                                                                            |
| MAT-02 extraction preview         | PASS    | Real PDF page metadata and preserved preview after embedding failure tested.                                                                                                                            |
| ACT-01 activity builder           | PASS    | Objectives, sources, modes, policy, minimum phases, publication state; invalid source scope rejected.                                                                                                   |
| CHAT-01 persistence               | PASS    | Database-backed sessions/messages; user message preserved on provider/setup failure.                                                                                                                    |
| CHAT-02 streaming/stop            | PARTIAL | NDJSON delivery after validated persistence; browser stop and first-token latency unverified.                                                                                                           |
| CHAT-03 state                     | PARTIAL | Server-enforced effort/help/phase rules and persisted reasoning map tested. Semantic behavior requires live model evaluation.                                                                           |
| CHAT-04 quick actions             | PARTIAL | Handlers, policy confirmation and hint escalation present; live behavior awaits AI.                                                                                                                     |
| RAG-01 institutional retrieval    | PARTIAL | Tenant/course/activity filters in server. Demo uses D1 vectors/keyword fallback; PostgreSQL/pgvector not connected.                                                                                     |
| RAG-02 citation drawer            | PARTIAL | Exact retrieved IDs/page/quote validated and API tested. Drawer implemented; browser unverified.                                                                                                        |
| SUM-01 summary                    | PARTIAL | Explicit student reflection, argument map, sources and export work through API. This is a data-derived summary, not a validated mastery assessment; no automatic long-conversation summary compression. |
| ANA-01 aggregates                 | PARTIAL | Real persisted aggregates, minimum cohort threshold of five, and explicitly labeled fictional demo cohort. Production concept canonicalization needs further work.                                      |
| PRIV-01 private transcripts       | PASS    | Lecturer transcript read rejected. Explicit individual sharing is not exposed.                                                                                                                          |
| SAFE-01 integrity                 | PARTIAL | Policy caps and prompts tested; production adversarial model evaluation pending.                                                                                                                        |
| SAFE-02 rate limits               | PASS    | Persisted limits per actor and IP when supplied by trusted edge; quota test.                                                                                                                            |
| A11Y-01                           | PARTIAL | Labels, native dialog focus trap, focus styles, reduced motion, status announcements; browser/assistive-tech audit pending.                                                                             |
| EXP-01                            | PARTIAL | Client summary export implemented, browser download unverified.                                                                                                                                         |
| PostgreSQL/pgvector/Supabase      | FAIL    | Project not chosen. Existing user projects untouched.                                                                                                                                                   |
| Live AI golden path               | FAIL    | No runtime model credential/model selection; no fake AI fallback.                                                                                                                                       |
| Live embedding golden path        | FAIL    | Embedding configuration absent.                                                                                                                                                                         |
| Desktop/mobile browser QA         | FAIL    | Required managed-browser capability unavailable. CSS breakpoints cover 360 px and larger but not visually verified.                                                                                     |
| TypeScript/lint/build/tests       | PASS    | See QA section below for exact gates.                                                                                                                                                                   |

## QA

- TypeScript strict check: passed before final packaging.
- ESLint on all authored application modules: passed before final packaging.
- Production Vinext build: passed before final packaging.
- Automated tests: 26 unit/API integration checks, including public anonymous entry, repeated role switching and real two-page PDF extraction. AI and R2/D1 platform adapters are mocked; SQLite executes actual queries and transactions.
- No claim of zero errors, live-model readiness, browser verification, or full PRD completion is made.

## Phase reports

0. Foundation: schema/migration, design tokens, private demo auth and seed; initial build succeeded. Backend deviation D1 versus requested PostgreSQL documented. No live Supabase changes.
1. Learning: sessions, two-stage analyzer/tutor, Zod repair, help state, NDJSON, notes/reflections and history. Mock-provider integration tests pass; live key required.
2. Sources: private PDF/TXT upload, bounded extraction, preview, embedding adapter, filtered retrieval, citation validation. Real extraction tested; embeddings tested with mock vectors.
3. Lecturer: class/activity/material management, default policy and aggregate analytics; authorization and aggregate suppression tested. No fabricated dashboard metrics.
4. Hardening: strict typecheck, lint, build, 24 tests, source-bound citation validation, transactional idempotency, same-origin mutation protection, private default, deployment packaging. Browser and live-provider acceptance remain blocked.

## Remaining decisions / requirements

1. Activate OpenAI Developers and choose approved models/provider spending; provision server credentials through the supported secret flow.
2. Select a Supabase organization/project for SOCRATIVA; review actual project cost before provisioning. Migrate the demo repository layer to PostgreSQL/pgvector and institutional Auth/Storage, then test the actual deployment.
3. Enable the supported managed-browser capability and run student/lecturer golden paths at 360 px, tablet and desktop.
4. Add exact token chunking, long-session memory compression, canonical concept analytics, production retention/purge and institutional enrollment before calling the production MVP complete.
