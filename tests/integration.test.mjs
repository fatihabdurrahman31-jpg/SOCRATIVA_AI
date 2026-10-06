import test from "node:test";
import assert from "node:assert/strict";
import { env, sqlite } from "./mock-cloudflare.mjs";
import { GET, POST, PATCH, DELETE } from "../app/api/[...path]/route.ts";
const origin = "https://socrativa.test";
async function call(
  path,
  method = "GET",
  body = null,
  cookie = "",
  owner = "test-owner",
  extra = {},
) {
  const headers = { origin, ...extra };
  if (owner) headers["oai-authenticated-user-id"] = owner;
  if (cookie) headers.cookie = cookie;
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  const request = new Request(origin + "/api/" + path, {
    method,
    headers,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  return { GET, POST, PATCH, DELETE }[method](request, {
    params: Promise.resolve({ path: path.split("/") }),
  });
}
async function demo(owner = "test-owner", role = "STUDENT", cookie = "") {
  const r = await call("demo", "POST", { role }, cookie, owner);
  assert.equal(r.status, 200);
  return {
    cookie: r.headers.get("set-cookie").split(";")[0],
    data: await r.json(),
  };
}
let student, other, teacher, courseId, activityId, sessionId;
test("one-click demo issues secure opaque cookie and isolated tenants", async () => {
  student = await demo();
  other = await demo("other-owner");
  assert.notEqual(
    student.data.user.institutionId,
    other.data.user.institutionId,
  );
  const d = await call("dashboard", "GET", null, student.cookie);
  assert.equal(d.status, 200);
  const data = await d.json();
  courseId = data.courses[0].id;
  activityId = data.activities[0].id;
  assert.equal(data.courses[0].title, "Psikologi Pendidikan");
  assert.equal(data.sessions.length, 0);
  assert.equal(data.ai.configured, false);
});
test("unauthenticated access and stolen cookie owner mismatch denied", async () => {
  assert.equal((await call("dashboard")).status, 401);
  assert.equal(
    (await call("dashboard", "GET", null, student.cookie, "other-owner"))
      .status,
    401,
  );
});
test("public anonymous demo receives an isolated owner cookie", async () => {
  const response = await call("demo", "POST", { role: "STUDENT" }, "", "");
  assert.equal(response.status, 200);
  const setCookies = response.headers.getSetCookie();
  assert.equal(setCookies.length, 2);
  assert.match(setCookies.join(";"), /socrativa_owner=/);
  assert.match(setCookies.join(";"), /socrativa_session=/);
  const cookie = setCookies.map((value) => value.split(";")[0]).join("; ");
  const dashboard = await call("dashboard", "GET", null, cookie, "");
  assert.equal(dashboard.status, 200);
  assert.equal((await dashboard.json()).user.name, "Mahasiswa Demo");
});
test("role switching stays available after repeated demo navigation", async () => {
  let current = await demo("switch-owner", "STUDENT");
  for (let index = 0; index < 14; index++) {
    const role = index % 2 === 0 ? "LECTURER" : "STUDENT";
    const response = await call(
      "demo",
      "POST",
      { role },
      current.cookie,
      "switch-owner",
    );
    assert.equal(response.status, 200);
    current = {
      cookie: response.headers.get("set-cookie").split(";")[0],
      data: await response.json(),
    };
    assert.equal(current.data.user.role, role);
  }
});
test("cross tenant course and material metadata are not exposed", async () => {
  const r = await call(
    "courses/" + courseId,
    "GET",
    null,
    other.cookie,
    "other-owner",
  );
  assert.equal(r.status, 404);
  const material = sqlite
    .prepare("select id from materials where course_id=?")
    .get(courseId);
  assert.equal(
    (
      await call(
        "materials/" + material.id,
        "GET",
        null,
        other.cookie,
        "other-owner",
      )
    ).status,
    404,
  );
});
test("student cannot create courses, edit policy or inspect lecturer analytics", async () => {
  assert.equal(
    (await call("courses", "POST", { title: "Malicious" }, student.cookie))
      .status,
    403,
  );
  assert.equal(
    (
      await call(
        "courses/" + courseId + "/policy",
        "PATCH",
        { policy: "Open Tutor" },
        student.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "courses/" + courseId + "/analytics",
        "GET",
        null,
        student.cookie,
      )
    ).status,
    403,
  );
});
test("cross-origin mutation is rejected", async () => {
  assert.equal(
    (
      await call(
        "sessions",
        "POST",
        { activityId },
        student.cookie,
        "test-owner",
        { origin: "https://attacker.test" },
      )
    ).status,
    403,
  );
});
test("session persists with private default", async () => {
  const r = await call("sessions", "POST", { activityId }, student.cookie);
  assert.equal(r.status, 200);
  sessionId = (await r.json()).id;
  const details = await (
    await call("sessions/" + sessionId, "GET", null, student.cookie)
  ).json();
  assert.equal(details.session.shareWithLecturer, false);
  assert.equal(details.session.phase, "ORIENT");
  assert.equal(
    (
      await call(
        "sessions/" + sessionId,
        "GET",
        null,
        other.cookie,
        "other-owner",
      )
    ).status,
    404,
  );
});
let requestKey;
test("AI setup failure preserves user message and retry is idempotent", async () => {
  requestKey = crypto.randomUUID();
  const body = {
    content: "Raka menganggap kemampuan tetap, Nisa mengevaluasi strategi.",
    key: requestKey,
  };
  for (let i = 0; i < 2; i++) {
    const r = await call(
      "sessions/" + sessionId + "/messages",
      "POST",
      body,
      student.cookie,
    );
    assert.equal(r.status, 503);
  }
  const detail = await (
    await call("sessions/" + sessionId, "GET", null, student.cookie)
  ).json();
  assert.equal(detail.messages.length, 1);
  assert.equal(detail.messages[0].role, "USER");
  assert.equal(
    sqlite.prepare("select lock_key from sessions where id=?").get(sessionId)
      .lock_key,
    null,
  );
});
test("two-stage model adapter validates, saves and streams with real-source citation (mock provider)", async () => {
  env.AI_API_KEY = "test-only";
  env.AI_MODEL_MAIN = "test-main";
  env.AI_MODEL_FAST = "test-fast";
  const original = global.fetch;
  let count = 0;
  global.fetch = async (_url, options) => {
    count++;
    const request = JSON.parse(options.body);
    const input = JSON.parse(request.messages[1].content);
    const analyzer = {
      intent: "answer",
      understandingLevel: 3,
      confidence: 0.9,
      hasClaim: true,
      hasReason: true,
      hasEvidence: true,
      misconceptions: [],
      stuckCount: 0,
      recommendedPhase: "PROBE_REASONING",
      recommendedHelpLevel: 0,
      requiresSource: true,
      academicIntegrityRisk: "low",
    };
    const src = input.sources[0];
    const output =
      request.model === "test-fast"
        ? analyzer
        : {
            message:
              "Evaluasi strategi menjadi bagian penting. Apa alasanmu membedakan respons keduanya?",
            phase: "PROBE_REASONING",
            helpLevel: 0,
            sourceCitations: src
              ? [
                  {
                    materialId: src.materialId,
                    chunkId: src.id,
                    page: src.page,
                    label: src.title,
                    quote: src.content.slice(0, 70),
                  },
                ]
              : [],
            reasoningMapUpdates: {
              claims: ["Nisa mengevaluasi strategi."],
              evidence: [],
              assumptions: [],
              counterpoints: [],
            },
            quickActions: [],
            sessionShouldComplete: false,
          };
    return Response.json({
      choices: [{ message: { content: JSON.stringify(output) } }],
    });
  };
  try {
    const body = {
      content: "Raka menganggap kemampuan tetap, Nisa mengevaluasi strategi.",
      key: requestKey,
    };
    const r = await call(
      "sessions/" + sessionId + "/messages",
      "POST",
      body,
      student.cookie,
    );
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /ndjson/);
    assert.match(await r.text(), /Evaluasi strategi/);
    assert.equal(count, 2);
    const repeat = await call(
      "sessions/" + sessionId + "/messages",
      "POST",
      body,
      student.cookie,
    );
    assert.equal(repeat.status, 200);
    assert.equal(count, 2);
    const d = await (
      await call("sessions/" + sessionId, "GET", null, student.cookie)
    ).json();
    assert.equal(d.messages.length, 2);
    assert.equal(d.citations.length, 1);
    assert.equal(d.session.phase, "PROBE_REASONING");
    assert.equal(
      d.session.reasoningMap.claims[0],
      "Nisa mengevaluasi strategi.",
    );
  } finally {
    global.fetch = original;
    delete env.AI_API_KEY;
    delete env.AI_MODEL_MAIN;
    delete env.AI_MODEL_FAST;
  }
});
test("notes, feedback, and reflection are persisted", async () => {
  assert.equal(
    (
      await call(
        "sessions/" + sessionId,
        "PATCH",
        { note: "Ganti strategi, bukan sekadar usaha." },
        student.cookie,
      )
    ).status,
    200,
  );
  let d = await (
    await call("sessions/" + sessionId, "GET", null, student.cookie)
  ).json();
  const mid = d.messages.find((m) => m.role === "ASSISTANT").id;
  assert.equal(
    (
      await call(
        "messages/" + mid + "/feedback",
        "PATCH",
        { feedback: 1 },
        student.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "sessions/" + sessionId + "/finish",
        "POST",
        {
          reflection: "Aku belajar mengevaluasi strategi dan meminta feedback.",
        },
        student.cookie,
      )
    ).status,
    200,
  );
  d = await (
    await call("sessions/" + sessionId, "GET", null, student.cookie)
  ).json();
  assert.equal(d.session.status, "COMPLETED");
  assert.equal(d.session.note, "Ganti strategi, bukan sekadar usaha.");
  assert.ok(d.session.summary.sources.length);
});
test("lecturer role has aggregate access but no private transcript", async () => {
  teacher = await demo("test-owner", "LECTURER", student.cookie);
  assert.equal(
    teacher.data.user.institutionId,
    student.data.user.institutionId,
  );
  assert.equal(
    (await call("sessions/" + sessionId, "GET", null, teacher.cookie)).status,
    404,
  );
  const r = await call(
    "courses/" + courseId + "/analytics",
    "GET",
    null,
    teacher.cookie,
  );
  assert.equal(r.status, 200);
  const a = await r.json();
  assert.equal(a.total, 6);
  assert.equal(a.active, 6);
  assert.equal(a.suppressed, false);
  assert.ok(a.concepts.length > 0);
  assert.equal(a.medianTurns, 2);
});
let uploadId;
test("TXT uploads privately; failed embeddings retain preview and exclude retrieval", async () => {
  const form = new FormData();
  form.set(
    "file",
    new File(
      ["Materi ini membahas strategi belajar dan evaluasi umpan balik."],
      "contoh.txt",
      { type: "text/plain" },
    ),
  );
  const upload = await call(
    "courses/" + courseId + "/materials",
    "POST",
    form,
    teacher.cookie,
  );
  assert.equal(upload.status, 200);
  uploadId = (await upload.json()).id;
  const process = await call(
    "materials/" + uploadId + "/process",
    "POST",
    {},
    teacher.cookie,
  );
  assert.equal(process.status, 200);
  const p = await process.json();
  assert.equal(p.status, "FAILED");
  const preview = await (
    await call("materials/" + uploadId, "GET", null, teacher.cookie)
  ).json();
  assert.equal(preview.chunks.length, 1);
  assert.equal(preview.material.visibility, "PRIVATE");
});
test("ready processing requires successful embedding; publication is explicit", async () => {
  env.AI_API_KEY = "test-only";
  env.AI_MODEL_MAIN = "test-main";
  env.AI_MODEL_FAST = "test-fast";
  env.EMBEDDING_MODEL = "test-embed";
  const original = global.fetch;
  global.fetch = async (_url, options) => {
    const req = JSON.parse(options.body);
    return Response.json({
      data: req.input.map((_, index) => ({
        index,
        embedding: [0.1, 0.2, 0.3],
      })),
    });
  };
  try {
    const p = await (
      await call(
        "materials/" + uploadId + "/process",
        "POST",
        {},
        teacher.cookie,
      )
    ).json();
    assert.equal(p.status, "READY");
    assert.equal(
      (
        await call(
          "materials/" + uploadId,
          "PATCH",
          { visibility: "COURSE" },
          teacher.cookie,
        )
      ).status,
      200,
    );
  } finally {
    global.fetch = original;
    for (const key of [
      "AI_API_KEY",
      "AI_MODEL_MAIN",
      "AI_MODEL_FAST",
      "EMBEDDING_MODEL",
    ])
      delete env[key];
  }
});
test("file validation rejects disguised PDF and unsupported format", async () => {
  for (const [name, type, content] of [
    ["fake.pdf", "application/pdf", "not pdf"],
    ["script.html", "text/html", "<h1>x</h1>"],
  ]) {
    const form = new FormData();
    form.set("file", new File([content], name, { type }));
    assert.equal(
      (
        await call(
          "courses/" + courseId + "/materials",
          "POST",
          form,
          teacher.cookie,
        )
      ).status,
      400,
    );
  }
});
test("lecturer creates course, activity and default policy with audit events", async () => {
  const c = await call(
    "courses",
    "POST",
    {
      title: "Kelas Baru",
      code: "TES01",
      description: "Ruang untuk menguji alasan",
      semester: "2026",
    },
    teacher.cookie,
  );
  assert.equal(c.status, 200);
  const id = (await c.json()).id;
  const a = await call(
    "courses/" + id + "/activities",
    "POST",
    {
      title: "Uji alasan pada kasus baru",
      scenario:
        "Jelaskan alasan mengapa sebuah kesimpulan perlu didukung bukti.",
      objectives: ["Mengidentifikasi bukti yang relevan"],
      mode: "ARGUMENT_REVIEW",
      difficulty: "BASIC",
      policy: "Strict Socratic",
      minPhases: 4,
      reflectionQuestions: ["Apa yang berubah?"],
      status: "PUBLISHED",
      materialIds: [],
    },
    teacher.cookie,
  );
  assert.equal(a.status, 200);
  assert.equal(
    (
      await call(
        "courses/" + id + "/policy",
        "PATCH",
        { policy: "Open Tutor" },
        teacher.cookie,
      )
    ).status,
    200,
  );
  assert.ok(
    sqlite
      .prepare("select count(*) n from audit_logs where target_id=?")
      .get(id).n >= 2,
  );
});
test("soft deletion removes session from student history and analytics", async () => {
  student = await demo("test-owner", "STUDENT", teacher.cookie);
  assert.equal(
    (await call("sessions/" + sessionId, "DELETE", null, student.cookie))
      .status,
    200,
  );
  assert.equal(
    (await call("sessions/" + sessionId, "GET", null, student.cookie)).status,
    404,
  );
  const d = await (await call("dashboard", "GET", null, student.cookie)).json();
  assert.equal(d.sessions.length, 0);
});

test("PDF extraction retains real page metadata even without embeddings", async () => {
  const { readFile } = await import("node:fs/promises");
  const t = await demo("pdf-owner", "LECTURER");
  const d = await (
    await call("dashboard", "GET", null, t.cookie, "pdf-owner")
  ).json();
  const form = new FormData();
  form.set(
    "file",
    new File(
      [await readFile(new URL("./fixtures/source.pdf", import.meta.url))],
      "source.pdf",
      { type: "application/pdf" },
    ),
  );
  const u = await call(
    "courses/" + d.courses[0].id + "/materials",
    "POST",
    form,
    t.cookie,
    "pdf-owner",
  );
  assert.equal(u.status, 200);
  const id = (await u.json()).id;
  await call("materials/" + id + "/process", "POST", {}, t.cookie, "pdf-owner");
  const detail = await (
    await call("materials/" + id, "GET", null, t.cookie, "pdf-owner")
  ).json();
  assert.equal(detail.chunks.length, 2);
  assert.equal(detail.chunks[0].page, 1);
  assert.equal(detail.chunks[1].page, 2);
  assert.match(detail.chunks[0].content, /Growth mindset/);
  assert.equal(detail.material.status, "FAILED");
});
test("rate limiter enforces persisted quota", async () => {
  const { rateLimit } = await import("../lib/security.ts");
  await rateLimit("quota-test", 2, 60);
  await rateLimit("quota-test", 2, 60);
  await assert.rejects(
    () => rateLimit("quota-test", 2, 60),
    (e) => e.status === 429,
  );
});
