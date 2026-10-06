import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import * as t from "../db/schema";
import { uid, now, digest, cookieValue, identity, rateLimit } from "./security";
import { emptyMap } from "./contracts";
import { demoTitle, scenario, demoObjectives, demoMaterial } from "./seed";

export async function createDemo(
  req: Request,
  role: "STUDENT" | "LECTURER",
  reset = false,
) {
  const identityResult = await identity(req, true);
  const owner = identityResult.ownerId;
  const db = getDb();
  let tenant: string | undefined;
  const old = cookieValue(req, "socrativa_session");
  let activeUser: typeof t.users.$inferSelect | undefined;

  if (old && !reset) {
    const [active] = await db
      .select({ user: t.users })
      .from(t.authSessions)
      .innerJoin(t.users, eq(t.authSessions.userId, t.users.id))
      .where(
        and(
          eq(t.authSessions.id, await digest(old)),
          eq(t.authSessions.ownerId, owner),
        ),
      )
      .limit(1);
    activeUser = active?.user;
    tenant = activeUser?.institutionId;
  }

  const expectedName = role === "STUDENT" ? "Mahasiswa Demo" : "Dosen Demo";
  if (activeUser?.role === role && activeUser.name === expectedName)
    return demoResponse(activeUser, role, identityResult.ownerToken);

  if (!tenant) {
    await rateLimit("demo-seed:" + (await digest(owner)), 5, 3600);
    tenant = await seedDemo(owner);
  }

  const [user] = await db
    .select()
    .from(t.users)
    .where(
      and(
        eq(t.users.institutionId, tenant),
        eq(t.users.role, role),
        eq(t.users.name, expectedName),
      ),
    )
    .limit(1);
  if (!user) throw new Error("Demo user seed is incomplete");

  const token = uid() + uid();
  const insertSession = db.insert(t.authSessions).values({
    id: await digest(token),
    userId: user.id,
    ownerId: owner,
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  });
  if (old)
    await db.batch([
      insertSession,
      db
        .delete(t.authSessions)
        .where(
          and(
            eq(t.authSessions.id, await digest(old)),
            eq(t.authSessions.ownerId, owner),
          ),
        ),
    ]);
  else await db.batch([insertSession]);

  return demoResponse(user, role, identityResult.ownerToken, token);
}

function demoResponse(
  user: typeof t.users.$inferSelect,
  role: "STUDENT" | "LECTURER",
  ownerToken: string | null,
  sessionToken?: string,
) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (sessionToken)
    headers.append(
      "Set-Cookie",
      `socrativa_session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
    );
  if (ownerToken)
    headers.append(
      "Set-Cookie",
      `socrativa_owner=${ownerToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`,
    );

  return Response.json(
    { user, redirect: role === "STUDENT" ? "/student" : "/lecturer" },
    { headers },
  );
}

async function seedDemo(owner: string) {
  const db = getDb();
  const tenant = uid();
  const student = uid();
  const teacher = uid();
  const course = uid();
  const material = uid();
  const chunk = uid();
  const activity = uid();
  const date = now();
  const cohort = Array.from({ length: 5 }, (_, index) => ({
    id: uid(),
    name: `Mahasiswa Simulasi ${index + 1}`,
  }));
  const simulatedSessions = cohort.map((member, index) => ({
    id: uid(),
    member,
    completed: index < 4,
    helpLevel: index % 4,
    concept:
      index < 2
        ? "growth mindset dan usaha"
        : index < 4
          ? "evaluasi strategi belajar"
          : "makna kegagalan",
  }));
  const simulatedMessages = simulatedSessions.flatMap((item, index) => [
    {
      id: `${item.id}-user-1`,
      sessionId: item.id,
      role: "USER",
      content:
        "Nisa mengevaluasi strategi, sedangkan Raka menganggap kemampuannya tetap.",
      requestKey: `${item.id}-turn-1`,
      phase: "ELICIT",
      helpLevel: 0,
      createdAt: date,
    },
    {
      id: `${item.id}-assistant-1`,
      sessionId: item.id,
      role: "ASSISTANT",
      content:
        "Apa yang membuat perubahan strategi berbeda dari sekadar berusaha lebih keras?",
      requestKey: `${item.id}-turn-1`,
      phase: "PROBE_REASONING",
      helpLevel: item.helpLevel,
      feedback: index === 4 ? -1 : 1,
      createdAt: date,
    },
    {
      id: `${item.id}-user-2`,
      sessionId: item.id,
      role: "USER",
      content:
        "Perubahan strategi memakai kegagalan sebagai informasi untuk belajar.",
      requestKey: `${item.id}-turn-2`,
      phase: "PROBE_REASONING",
      helpLevel: item.helpLevel,
      createdAt: date,
    },
    {
      id: `${item.id}-assistant-2`,
      sessionId: item.id,
      role: "ASSISTANT",
      content: "Terapkan gagasan itu pada kasus belajar yang berbeda.",
      requestKey: `${item.id}-turn-2`,
      phase: "CHECK",
      helpLevel: item.helpLevel,
      feedback: 1,
      createdAt: date,
    },
  ]);

  await db.batch([
    db.insert(t.institutions).values({
      id: tenant,
      name: "Universitas Demo SOCRATIVA",
      ownerId: owner,
      createdAt: date,
    }),
    db.insert(t.users).values([
      {
        id: student,
        institutionId: tenant,
        name: "Mahasiswa Demo",
        role: "STUDENT",
        createdAt: date,
      },
      {
        id: teacher,
        institutionId: tenant,
        name: "Dosen Demo",
        role: "LECTURER",
        createdAt: date,
      },
      ...cohort.map((member) => ({
        id: member.id,
        institutionId: tenant,
        name: member.name,
        role: "STUDENT" as const,
        createdAt: date,
      })),
    ]),
    db.insert(t.courses).values({
      id: course,
      institutionId: tenant,
      lecturerId: teacher,
      code: "PSI 204",
      title: "Psikologi Pendidikan",
      description:
        "Mengenali cara kita belajar, membangun alasan, dan berkembang melalui pengalaman.",
      semester: "Semester Ganjil · 2026/2027",
      createdAt: date,
    }),
    db.insert(t.courseMembers).values([
      {
        id: uid(),
        courseId: course,
        userId: student,
        role: "STUDENT",
        createdAt: date,
      },
      {
        id: uid(),
        courseId: course,
        userId: teacher,
        role: "LECTURER",
        createdAt: date,
      },
      ...cohort.map((member) => ({
        id: uid(),
        courseId: course,
        userId: member.id,
        role: "STUDENT",
        createdAt: date,
      })),
    ]),
    db.insert(t.materials).values({
      id: material,
      institutionId: tenant,
      courseId: course,
      uploadedBy: teacher,
      title: "Mindset dan proses belajar",
      mimeType: "text/plain",
      fileSize: new TextEncoder().encode(demoMaterial).length,
      status: "READY",
      isDemo: true,
      createdAt: date,
    }),
    db.insert(t.materialChunks).values({
      id: chunk,
      materialId: material,
      institutionId: tenant,
      courseId: course,
      chunkIndex: 0,
      page: null,
      content: demoMaterial,
      tokenCount: Math.ceil(demoMaterial.length / 4),
      createdAt: date,
    }),
    db.insert(t.activities).values({
      id: activity,
      courseId: course,
      title: demoTitle,
      scenario,
      objectives: demoObjectives,
      mode: "SOCRATIC_LEARNING",
      difficulty: "BASIC",
      policy: "Guided Discovery",
      minPhases: 3,
      reflectionQuestions: [
        "Apa yang berubah dari pemahaman awalmu?",
        "Strategi apa yang ingin kamu coba setelah sesi ini?",
      ],
      status: "PUBLISHED",
      createdAt: date,
    }),
    db
      .insert(t.activityMaterials)
      .values({ id: uid(), activityId: activity, materialId: material }),
    db.insert(t.sessions).values(
      simulatedSessions.map((item) => ({
        id: item.id,
        institutionId: tenant,
        courseId: course,
        activityId: activity,
        userId: item.member.id,
        title: demoTitle,
        mode: "SOCRATIC_LEARNING",
        status: item.completed ? "COMPLETED" : "ACTIVE",
        phase: item.completed ? "COMPLETE" : "SCAFFOLD",
        helpLevel: item.helpLevel,
        stuckCount: item.helpLevel > 1 ? 2 : 0,
        attempts: 3,
        visited: ["ORIENT", "ELICIT", "PROBE_REASONING", "CHECK"],
        reasoningMap: {
          claims: ["Strategi belajar dapat dievaluasi setelah kegagalan."],
          evidence: ["Nisa meninjau cara belajar dan mencoba pendekatan baru."],
          assumptions: ["Kemampuan dapat berkembang melalui proses belajar."],
          counterpoints: [
            "Bertahan tanpa mengubah strategi belum tentu efektif.",
          ],
        },
        summary: item.completed
          ? {
              concepts: ["Growth mindset melibatkan evaluasi strategi."],
              misconceptions: [item.concept],
              nextSteps: ["Menguji strategi baru pada tugas berikutnya."],
              reflection: "Saya belajar membedakan usaha dan strategi.",
              initialUnderstanding: "Growth mindset berarti terus mencoba.",
              reasoningMap: emptyMap(),
              sources: ["Mindset dan proses belajar"],
            }
          : null,
        shareWithLecturer: false,
        createdAt: date,
        updatedAt: date,
        completedAt: item.completed ? date : null,
      })),
    ),
    // Keep each INSERT below D1's bound-parameter ceiling.
    ...Array.from({ length: Math.ceil(simulatedMessages.length / 4) }, (_, i) =>
      db.insert(t.messages).values(simulatedMessages.slice(i * 4, i * 4 + 4)),
    ),
    db.insert(t.messageCitations).values(
      simulatedSessions.map((item) => ({
        id: uid(),
        messageId: `${item.id}-assistant-1`,
        chunkId: chunk,
        quoteText: "Growth mindset tidak sama dengan sekadar pantang menyerah.",
      })),
    ),
    db.insert(t.learningSignals).values(
      simulatedSessions.map((item) => ({
        id: uid(),
        sessionId: item.id,
        messageId: `${item.id}-assistant-1`,
        concept: item.concept,
        signalType: "MISCONCEPTION",
        confidence: 0.88,
        createdAt: date,
      })),
    ),
    db.insert(t.auditLogs).values({
      id: uid(),
      institutionId: tenant,
      actorUserId: teacher,
      action: "DEMO_CREATED",
      targetId: tenant,
      createdAt: date,
    }),
  ]);

  return tenant;
}
