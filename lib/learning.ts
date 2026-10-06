import { and, eq, inArray, asc, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import * as t from "../db/schema";
import {
  ApiError,
  uid,
  now,
  ownSession,
  courseAccess,
  rateLimit,
  type Actor,
} from "./security";
import { sendSchema, emptyMap } from "./contracts";
import { embed, orchestrate, aiStatus, signalConcepts } from "./ai";
import { cosine, mergeMap, type Source } from "./pedagogy";
export async function sessionDetail(user: Actor, id: string) {
  const session = await ownSession(user, id),
    db = getDb();
  const [activity] = await db
    .select()
    .from(t.activities)
    .where(eq(t.activities.id, session.activityId));
  const course = await courseAccess(user, session.courseId);
  const messages = await db
    .select({
      id: t.messages.id,
      role: t.messages.role,
      content: t.messages.content,
      requestKey: t.messages.requestKey,
      phase: t.messages.phase,
      helpLevel: t.messages.helpLevel,
      feedback: t.messages.feedback,
      createdAt: t.messages.createdAt,
    })
    .from(t.messages)
    .where(eq(t.messages.sessionId, id))
    .orderBy(asc(t.messages.createdAt));
  const citations = messages.length
    ? await db
        .select({
          id: t.messageCitations.id,
          messageId: t.messageCitations.messageId,
          chunkId: t.materialChunks.id,
          title: t.materials.title,
          page: t.materialChunks.page,
          quote: t.messageCitations.quoteText,
        })
        .from(t.messageCitations)
        .innerJoin(
          t.materialChunks,
          eq(t.messageCitations.chunkId, t.materialChunks.id),
        )
        .innerJoin(t.materials, eq(t.materialChunks.materialId, t.materials.id))
        .where(
          and(
            inArray(
              t.messageCitations.messageId,
              messages.map((m) => m.id),
            ),
            eq(t.materials.institutionId, user.institutionId),
            eq(t.materials.courseId, session.courseId),
          ),
        )
    : [];
  return { session, activity, course, messages, citations, ai: aiStatus() };
}
export async function createSession(
  user: Actor,
  activityId: string,
  mode: string,
) {
  if (user.role !== "STUDENT")
    throw new ApiError(
      403,
      "Gunakan akun demo mahasiswa untuk memulai sesi belajar.",
    );
  const db = getDb();
  const [activity] = await db
    .select()
    .from(t.activities)
    .where(
      and(
        eq(t.activities.id, activityId),
        eq(t.activities.status, "PUBLISHED"),
      ),
    );
  if (!activity) throw new ApiError(404, "Aktivitas tidak ditemukan.");
  await courseAccess(user, activity.courseId);
  const id = uid();
  await db.insert(t.sessions).values({
    id,
    institutionId: user.institutionId,
    courseId: activity.courseId,
    activityId: activity.id,
    userId: user.id,
    title: activity.title,
    mode,
    visited: ["ORIENT"],
    reasoningMap: emptyMap(),
    createdAt: now(),
    updatedAt: now(),
  });
  return { id };
}
export async function retrieve(
  user: Actor,
  s: typeof t.sessions.$inferSelect,
  query: string,
): Promise<Source[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: t.materialChunks.id,
      materialId: t.materials.id,
      title: t.materials.title,
      page: t.materialChunks.page,
      content: t.materialChunks.content,
      embedding: t.materialChunks.embedding,
      embeddingModel: t.materialChunks.embeddingModel,
      isDemo: t.materials.isDemo,
    })
    .from(t.materialChunks)
    .innerJoin(t.materials, eq(t.materialChunks.materialId, t.materials.id))
    .innerJoin(
      t.activityMaterials,
      eq(t.activityMaterials.materialId, t.materials.id),
    )
    .where(
      and(
        eq(t.materialChunks.institutionId, user.institutionId),
        eq(t.materialChunks.courseId, s.courseId),
        eq(t.materials.institutionId, user.institutionId),
        eq(t.materials.courseId, s.courseId),
        eq(t.materials.status, "READY"),
        eq(t.materials.visibility, "COURSE"),
        eq(t.activityMaterials.activityId, s.activityId),
      ),
    )
    .limit(300);
  if (!rows.length) return [];
  const terms = query.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || [];
  let vector: number[] | undefined, model: string | undefined;
  if (rows.some((r) => r.embedding)) {
    const e = await embed([query]);
    vector = e.vectors[0];
    model = e.model;
  }
  return rows
    .map((r) => {
      const lexical = terms.length
        ? terms.filter((v) => r.content.toLowerCase().includes(v)).length /
          terms.length
        : 0;
      const semantic =
        vector && r.embedding && r.embeddingModel === model
          ? cosine(vector, r.embedding)
          : 0;
      return { ...r, score: semantic || lexical };
    })
    .filter((r) => r.score >= 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ id, materialId, title, page, content }) => ({
      id,
      materialId,
      title,
      page,
      content,
    }));
}
export async function sendMessage(
  user: Actor,
  id: string,
  raw: unknown,
  signal?: AbortSignal,
) {
  const input = sendSchema.parse(raw),
    db = getDb(),
    session = await ownSession(user, id);
  if (session.status !== "ACTIVE")
    throw new ApiError(
      409,
      "Sesi sudah selesai. Mulai sesi baru untuk melanjutkan belajar.",
    );
  await rateLimit("chat:" + user.id, 15, 60);
  const [old] = await db
    .select()
    .from(t.messages)
    .where(
      and(
        eq(t.messages.sessionId, id),
        eq(t.messages.requestKey, input.key),
        eq(t.messages.role, "ASSISTANT"),
      ),
    );
  if (old) return streamResult(old.content, old.id);
  const lock = uid();
  const locked = await db
    .update(t.sessions)
    .set({
      lockKey: lock,
      lockUntil: new Date(Date.now() + 600000).toISOString(),
    })
    .where(
      and(
        eq(t.sessions.id, id),
        sql`(${t.sessions.lockUntil} is null or ${t.sessions.lockUntil} < ${now()})`,
      ),
    )
    .returning();
  if (!locked.length)
    throw new ApiError(
      409,
      "Respons lain sedang disiapkan. Tunggu hingga selesai.",
    );
  try {
    const content =
      input.content ||
      {
        REQUEST_HINT: "Saya butuh petunjuk.",
        REQUEST_DIRECT: "Tolong jelaskan langsung.",
        CHALLENGE: "Tantang argumen saya.",
      }[input.action!] ||
      "";
    const previousUser = await db
      .select()
      .from(t.messages)
      .where(
        and(
          eq(t.messages.sessionId, id),
          eq(t.messages.requestKey, input.key),
          eq(t.messages.role, "USER"),
        ),
      )
      .limit(1);
    if (previousUser[0] && previousUser[0].content !== content)
      throw new ApiError(
        409,
        "Kunci pengiriman sudah dipakai untuk pesan berbeda.",
      );
    await db
      .insert(t.messages)
      .values({
        id: uid(),
        sessionId: id,
        role: "USER",
        content,
        requestKey: input.key,
        createdAt: now(),
      })
      .onConflictDoNothing();
    await db
      .update(t.sessions)
      .set({ updatedAt: now() })
      .where(eq(t.sessions.id, id));
    if (!aiStatus().configured)
      throw new ApiError(
        503,
        "AI belum diaktifkan. Pesanmu sudah tersimpan; kamu dapat melanjutkan setelah layanan model terhubung.",
      );
    const [activity] = await db
      .select()
      .from(t.activities)
      .where(eq(t.activities.id, session.activityId));
    const recent = await db
      .select({ role: t.messages.role, content: t.messages.content })
      .from(t.messages)
      .where(eq(t.messages.sessionId, id))
      .orderBy(desc(t.messages.createdAt))
      .limit(24);
    const sources = await retrieve(
      user,
      session,
      content + " " + activity.title,
    );
    const started = Date.now();
    const result = await orchestrate(
      {
        state: session,
        policy: activity.policy,
        minPhases: activity.minPhases,
        action: input.action,
        content,
        objectives: activity.objectives,
        scenario: activity.scenario,
        mode: session.mode,
        history: recent.reverse(),
        memory: session.reasoningMap,
        sources,
      },
      signal,
    );
    const messageId = uid(),
      date = now(),
      map = mergeMap(session.reasoningMap, result.tutor.reasoningMapUpdates),
      visited = [...session.visited, result.state.phase].slice(-60);
    const base = [
      db.insert(t.messages).values({
        id: messageId,
        sessionId: id,
        role: "ASSISTANT",
        content: result.tutor.message,
        requestKey: input.key,
        phase: result.state.phase,
        helpLevel: result.state.helpLevel,
        structured: result.tutor as unknown as Record<string, unknown>,
        modelName: result.model,
        latencyMs: Date.now() - started,
        createdAt: date,
      }),
      db
        .update(t.sessions)
        .set({
          phase: result.state.phase,
          helpLevel: result.state.helpLevel,
          stuckCount: result.state.stuckCount,
          attempts: result.state.attempts,
          reasoningMap: map,
          visited,
          updatedAt: date,
          lockKey: null,
          lockUntil: null,
        })
        .where(and(eq(t.sessions.id, id), eq(t.sessions.lockKey, lock))),
    ];
    const citations = result.tutor.sourceCitations.map((c) =>
      db.insert(t.messageCitations).values({
        id: uid(),
        messageId,
        chunkId: c.chunkId,
        quoteText: c.quote,
      }),
    );
    const signals = signalConcepts(result.analyzer).map((concept) =>
      db.insert(t.learningSignals).values({
        id: uid(),
        sessionId: id,
        messageId,
        concept,
        signalType: "MISCONCEPTION",
        confidence: result.analyzer.confidence,
        createdAt: date,
      }),
    );
    await db.batch([...base, ...citations, ...signals] as [
      (typeof base)[number],
      ...(typeof base)[number][],
    ]);
    return streamResult(result.tutor.message, messageId);
  } finally {
    await db
      .update(t.sessions)
      .set({ lockKey: null, lockUntil: null })
      .where(and(eq(t.sessions.id, id), eq(t.sessions.lockKey, lock)));
  }
}
function streamResult(content: string, messageId: string) {
  const encoder = new TextEncoder();
  const chunks = content.match(/.{1,90}(?:\s|$)|.{1,90}/gs) || [content];
  let i = 0;
  return new Response(
    new ReadableStream({
      pull(controller) {
        if (i < chunks.length) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: "text", text: chunks[i++] }) + "\n",
            ),
          );
        } else {
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "done", messageId }) + "\n"),
          );
          controller.close();
        }
      },
    }),
    {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-store",
      },
    },
  );
}
export async function finishSession(
  user: Actor,
  id: string,
  reflection: string,
) {
  const db = getDb(),
    s = await ownSession(user, id);
  if (s.lockUntil && s.lockUntil > now())
    throw new ApiError(
      409,
      "Tunggu respons selesai sebelum menyimpan refleksi.",
    );
  const messages = await db
    .select()
    .from(t.messages)
    .where(eq(t.messages.sessionId, id))
    .orderBy(asc(t.messages.createdAt));
  const signals = await db
    .select()
    .from(t.learningSignals)
    .where(eq(t.learningSignals.sessionId, id));
  const citations = messages.length
    ? await db
        .select({ title: t.materials.title })
        .from(t.messageCitations)
        .innerJoin(
          t.materialChunks,
          eq(t.materialChunks.id, t.messageCitations.chunkId),
        )
        .innerJoin(t.materials, eq(t.materials.id, t.materialChunks.materialId))
        .where(
          inArray(
            t.messageCitations.messageId,
            messages.map((m) => m.id),
          ),
        )
    : [];
  const summary: t.Summary = {
    concepts: s.reasoningMap.claims,
    misconceptions: [...new Set(signals.map((v) => v.concept))],
    nextSteps: [
      "Tinjau kembali alasan dan bukti dalam peta penalaran.",
      "Coba terapkan konsep pada situasi belajar yang berbeda.",
    ],
    reflection,
    initialUnderstanding:
      messages.find((m) => m.role === "USER")?.content ||
      "Belum ada jawaban awal.",
    reasoningMap: s.reasoningMap,
    sources: [...new Set(citations.map((v) => v.title))],
  };
  await db
    .update(t.sessions)
    .set({
      summary,
      status: "COMPLETED",
      completedAt: now(),
      updatedAt: now(),
      phase: "COMPLETE",
    })
    .where(eq(t.sessions.id, id));
  return { summary };
}
