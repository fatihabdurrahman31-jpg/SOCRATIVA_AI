# SOCRATIVA — audit implementasi

PRD v1 adalah target penerimaan. Workspace awal hanya berisi dua lampiran; tidak ada kode lama.

## Arsitektur dan batas

Next.js App Router / TypeScript strict melalui runtime Vinext yang disediakan Sites; Drizzle untuk skema dan query; server-only HTTP adapter untuk model OpenAI-compatible; Zod untuk input/output. Hosting Sites menggunakan D1 dan R2. **D1 adalah backend demo, bukan pengganti pemenuhan PostgreSQL/pgvector dalam PRD.** Supabase belum dipilih: proyek terhubung adalah forge-trader dan siapkelas. Tidak memodifikasi keduanya. Autentikasi luar mengikuti ChatGPT Sites; token demo acak disimpan dalam cookie HttpOnly dan hash di server, terikat ke identitas Sites. Setiap demo mendapat institusi sendiri. Tidak mengklaim akun demo sebagai autentikasi institusi produksi.

AI_API_KEY, AI_MODEL_MAIN, AI_MODEL_FAST, EMBEDDING_MODEL diperlukan untuk mengaktifkan AI; AI_BASE_URL opsional. Kunci hanya di server. Tidak ada biaya provider baru yang disetujui.

## Fase

0 fondasi + skema + seed + auth. 1 sesi + analyzer/tutor + state + persistence. 2 unggah + ekstraksi + retrieval + citation. 3 pengelolaan kelas + aktivitas + analitik agregat. 4 test + build + audit.

## Matriks P0

| Requirement | Komponen          | Tabel/API                          | Verifikasi               | Status awal        |
| ----------- | ----------------- | ---------------------------------- | ------------------------ | ------------------ |
| AUTH-01/02  | demo, role guard  | users, auth_sessions, /api/demo    | token, role, tenant      | Dalam implementasi |
| CRS-01      | kelas             | courses, course_members            | akses tenant             | Dalam implementasi |
| MAT-01/02   | materi            | materials, material_chunks, R2     | MIME, state, ekstraksi   | Dalam implementasi |
| ACT-01      | activity builder  | activities, activity_materials     | validasi sumber          | Dalam implementasi |
| CHAT-01..04 | dialog            | sessions, messages                 | retry, state, escalation | Dalam implementasi |
| RAG-01/02   | retrieval, drawer | material_chunks, message_citations | citation scope           | Dalam implementasi |
| SUM-01      | refleksi          | sessions.summary                   | persistensi              | Dalam implementasi |
| ANA-01      | analitik          | learning_signals                   | cohort threshold         | Dalam implementasi |
| PRIV-01     | server ownership  | sessions.user_id                   | private default          | Dalam implementasi |
| SAFE-01/02  | guardrails        | rate_limits                        | policy, batas request    | Dalam implementasi |

Browser QA: skill control-browser tidak tersedia pada lingkungan managed Sites. Sesuai panduan Sites, tidak menjalankan preview/browser pengganti; status visual dan E2E browser belum terverifikasi.
