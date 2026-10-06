import { z } from "zod";
import { and, eq, desc, sql, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import * as t from "../../../db/schema";
import {
  actor,
  sameOrigin,
  readJson,
  ApiError,
  courseAccess,
  lecturer,
  ownSession,
  rateLimit,
  uid,
  now,
  digest,
  identity,
  cookieValue,
} from "../../../lib/security";
import { createDemo } from "../../../lib/demo";
import { aiStatus } from "../../../lib/ai";
import { activitySchema, courseSchema, policies } from "../../../lib/contracts";
import {
  createSession,
  sessionDetail,
  sendMessage,
  finishSession,
} from "../../../lib/learning";
import { analytics } from "../../../lib/analytics";
import {
  uploadMaterial,
  processMaterial,
  materialDetail,
} from "../../../lib/documents";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(req: Request, context: Context) {
  try {
    sameOrigin(req);
    const { path } = await context.params;
    const [root, id, sub] = path;
    if (req.method === "POST" && sub === "messages") {
      await identity(req);
      const ip = req.headers.get("cf-connecting-ip");
      if (ip) await rateLimit("ip:" + (await digest(ip)), 60, 60);
    }
    const method = req.method;
    if (root === "demo" && method === "POST") {
      const input = z
        .object({
          role: z.enum(["STUDENT", "LECTURER"]),
          reset: z.boolean().default(false),
        })
        .parse(await readJson(req));
      return await createDemo(req, input.role, input.reset);
    }
    const user = await actor(req),
      db = getDb();
    if (!["GET", "HEAD"].includes(method))
      await rateLimit("api:" + user.id, 150, 60);
    if (root === "logout" && method === "POST") {
      const token = cookieValue(req, "socrativa_session");
      if (token)
        await db
          .delete(t.authSessions)
          .where(eq(t.authSessions.id, await digest(token)));
      return Response.json(
        { ok: true },
        {
          headers: {
            "Set-Cookie":
              "socrativa_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
          },
        },
      );
    }
    if (root === "me" && method === "GET")
      return json({ user, ai: aiStatus() });
    if (root === "dashboard" && method === "GET") {
      const [courses, sessions] = await Promise.all([
        db
          .selectDistinct({
            id: t.courses.id,
            title: t.courses.title,
            description: t.courses.description,
            code: t.courses.code,
            semester: t.courses.semester,
            policy: t.courses.policy,
          })
          .from(t.courses)
          .innerJoin(
            t.courseMembers,
            eq(t.courseMembers.courseId, t.courses.id),
          )
          .where(
            and(
              eq(t.courses.institutionId, user.institutionId),
              eq(t.courseMembers.userId, user.id),
              eq(t.courses.status, "ACTIVE"),
            ),
          ),
        db
          .select({
            id: t.sessions.id,
            title: t.sessions.title,
            status: t.sessions.status,
            phase: t.sessions.phase,
            updatedAt: t.sessions.updatedAt,
            courseId: t.sessions.courseId,
          })
          .from(t.sessions)
          .where(
            and(
              eq(t.sessions.userId, user.id),
              eq(t.sessions.institutionId, user.institutionId),
              sql`${t.sessions.deletedAt} is null`,
            ),
          )
          .orderBy(desc(t.sessions.updatedAt))
          .limit(100),
      ]);
      const activities = courses.length
        ? await db
            .select()
            .from(t.activities)
            .where(
              and(
                inArray(
                  t.activities.courseId,
                  courses.map((c) => c.id),
                ),
                eq(t.activities.status, "PUBLISHED"),
              ),
            )
        : [];
      return json({ user, courses, sessions, activities, ai: aiStatus() });
    }
    if (root === "courses" && !id && method === "POST") {
      lecturer(user);
      const data = courseSchema.parse(await readJson(req)),
        cid = uid();
      const peers = await db
        .select()
        .from(t.users)
        .where(eq(t.users.institutionId, user.institutionId));
      await db.batch([
        db.insert(t.courses).values({
          ...data,
          id: cid,
          institutionId: user.institutionId,
          lecturerId: user.id,
          createdAt: now(),
        }),
        db.insert(t.courseMembers).values(
          peers.map((p) => ({
            id: uid(),
            courseId: cid,
            userId: p.id,
            role: p.role,
            createdAt: now(),
          })),
        ),
        db.insert(t.auditLogs).values({
          id: uid(),
          institutionId: user.institutionId,
          actorUserId: user.id,
          action: "COURSE_CREATED",
          targetId: cid,
          createdAt: now(),
        }),
      ]);
      return json({ id: cid });
    }
    if (root === "courses" && id) {
      z.string().uuid().parse(id);
      const course = await courseAccess(
        user,
        id,
        method !== "GET" || sub === "analytics",
      );
      if (sub === "analytics" && method === "GET") {
        const url = new URL(req.url);
        const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
        const from = url.searchParams.get("from") || undefined,
          to = url.searchParams.get("to") || undefined,
          activity = url.searchParams.get("activityId") || undefined;
        if (from) date.parse(from);
        if (to) date.parse(to);
        if (activity) z.string().uuid().parse(activity);
        return json(await analytics(user, id, from, to, activity));
      }
      if (sub === "materials" && method === "POST")
        return json(await uploadMaterial(user, id, req));
      if (sub === "activities" && method === "POST") {
        const input = activitySchema.parse(await readJson(req));
        if (input.materialIds.length) {
          const materials = await db
            .select()
            .from(t.materials)
            .where(
              and(
                inArray(t.materials.id, input.materialIds),
                eq(t.materials.courseId, id),
                eq(t.materials.institutionId, user.institutionId),
                eq(t.materials.status, "READY"),
              ),
            );
          if (materials.length !== new Set(input.materialIds).size)
            throw new ApiError(400, "Pilih sumber siap pakai dari kelas ini.");
        }
        const aid = uid();
        const { materialIds, ...data } = input;
        await db.batch([
          db
            .insert(t.activities)
            .values({ ...data, id: aid, courseId: id, createdAt: now() }),
          ...materialIds.map((mid) =>
            db
              .insert(t.activityMaterials)
              .values({ id: uid(), activityId: aid, materialId: mid }),
          ),
          db.insert(t.auditLogs).values({
            id: uid(),
            institutionId: user.institutionId,
            actorUserId: user.id,
            action: "ACTIVITY_CREATED",
            targetId: aid,
            createdAt: now(),
          }),
        ] as Parameters<typeof db.batch>[0]);
        return json({ id: aid });
      }
      if (sub === "policy" && method === "PATCH") {
        const { policy } = z
          .object({ policy: z.enum(policies) })
          .parse(await readJson(req));
        await db.batch([
          db.update(t.courses).set({ policy }).where(eq(t.courses.id, id)),
          db.insert(t.auditLogs).values({
            id: uid(),
            institutionId: user.institutionId,
            actorUserId: user.id,
            action: "COURSE_POLICY_UPDATED",
            targetId: id,
            createdAt: now(),
          }),
        ]);
        return json({ ok: true });
      }
      if (method === "GET" && !sub) {
        const [materials, activities, members] = await Promise.all([
          db
            .select({
              id: t.materials.id,
              title: t.materials.title,
              status: t.materials.status,
              error: t.materials.error,
              mimeType: t.materials.mimeType,
              fileSize: t.materials.fileSize,
              isDemo: t.materials.isDemo,
              visibility: t.materials.visibility,
            })
            .from(t.materials)
            .where(
              and(
                eq(t.materials.courseId, id),
                eq(t.materials.institutionId, user.institutionId),
                user.role === "STUDENT"
                  ? and(
                      eq(t.materials.status, "READY"),
                      eq(t.materials.visibility, "COURSE"),
                    )
                  : undefined,
              ),
            ),
          db
            .select()
            .from(t.activities)
            .where(
              and(
                eq(t.activities.courseId, id),
                user.role === "STUDENT"
                  ? eq(t.activities.status, "PUBLISHED")
                  : undefined,
              ),
            ),
          user.role !== "STUDENT"
            ? db
                .select({ name: t.users.name, role: t.courseMembers.role })
                .from(t.courseMembers)
                .innerJoin(t.users, eq(t.users.id, t.courseMembers.userId))
                .where(
                  and(
                    eq(t.courseMembers.courseId, id),
                    eq(t.users.institutionId, user.institutionId),
                  ),
                )
            : Promise.resolve([]),
        ]);
        return json({ course, materials, activities, members });
      }
    }
    if (root === "materials" && id) {
      z.string().uuid().parse(id);
      if (method === "GET") return json(await materialDetail(user, id));
      const [material] = await db
        .select()
        .from(t.materials)
        .where(
          and(
            eq(t.materials.id, id),
            eq(t.materials.institutionId, user.institutionId),
          ),
        );
      if (!material) throw new ApiError(404, "Materi tidak ditemukan.");
      await courseAccess(user, material.courseId, true);
      if (sub === "process" && method === "POST")
        return json(await processMaterial(user, material));
      if (method === "PATCH" || method === "DELETE") {
        const data =
          method === "DELETE"
            ? { status: "DISABLED" }
            : z
                .object({
                  visibility: z.enum(["PRIVATE", "COURSE"]).optional(),
                  status: z.enum(["DISABLED"]).optional(),
                })
                .parse(await readJson(req));
        await db.batch([
          db.update(t.materials).set(data).where(eq(t.materials.id, id)),
          db.insert(t.auditLogs).values({
            id: uid(),
            institutionId: user.institutionId,
            actorUserId: user.id,
            action:
              method === "DELETE" ? "MATERIAL_DISABLED" : "MATERIAL_UPDATED",
            targetId: id,
            createdAt: now(),
          }),
        ]);
        return json({ ok: true });
      }
    }
    if (root === "activities" && id && method === "PATCH") {
      const [activity] = await db
        .select()
        .from(t.activities)
        .where(eq(t.activities.id, z.string().uuid().parse(id)));
      if (!activity) throw new ApiError(404, "Aktivitas tidak ditemukan.");
      await courseAccess(user, activity.courseId, true);
      const { status } = z
        .object({ status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]) })
        .parse(await readJson(req));
      await db.batch([
        db.update(t.activities).set({ status }).where(eq(t.activities.id, id)),
        db.insert(t.auditLogs).values({
          id: uid(),
          institutionId: user.institutionId,
          actorUserId: user.id,
          action: "ACTIVITY_STATUS_UPDATED",
          targetId: id,
          createdAt: now(),
        }),
      ]);
      return json({ ok: true });
    }
    if (root === "sessions") {
      if (method === "POST" && !id) {
        const input = z
          .object({
            activityId: z.string().uuid(),
            mode: z
              .enum(["SOCRATIC_LEARNING", "ARGUMENT_REVIEW"])
              .default("SOCRATIC_LEARNING"),
          })
          .parse(await readJson(req));
        return json(await createSession(user, input.activityId, input.mode));
      }
      if (id) {
        z.string().uuid().parse(id);
        if (method === "GET") return json(await sessionDetail(user, id));
        if (sub === "messages" && method === "POST")
          return await sendMessage(user, id, await readJson(req), req.signal);
        if (sub === "finish" && method === "POST") {
          const { reflection } = z
            .object({ reflection: z.string().trim().min(5).max(5000) })
            .parse(await readJson(req));
          return json(await finishSession(user, id, reflection));
        }
        await ownSession(user, id);
        if (method === "PATCH") {
          const input = z
            .object({ note: z.string().max(6000).optional() })
            .parse(await readJson(req));
          await db
            .update(t.sessions)
            .set({ ...input, updatedAt: now() })
            .where(eq(t.sessions.id, id));
          return json({ ok: true });
        }
        if (method === "DELETE") {
          await db
            .update(t.sessions)
            .set({ deletedAt: now(), updatedAt: now() })
            .where(eq(t.sessions.id, id));
          return json({ ok: true });
        }
      }
    }
    if (root === "messages" && id && sub === "feedback" && method === "PATCH") {
      const [message] = await db
        .select()
        .from(t.messages)
        .where(eq(t.messages.id, z.string().uuid().parse(id)));
      if (!message) throw new ApiError(404, "Pesan tidak ditemukan.");
      await ownSession(user, message.sessionId);
      const { feedback } = z
        .object({ feedback: z.union([z.literal(1), z.literal(-1)]) })
        .parse(await readJson(req));
      await db
        .update(t.messages)
        .set({ feedback })
        .where(eq(t.messages.id, id));
      return json({ ok: true });
    }
    throw new ApiError(404, "Halaman tidak ditemukan.");
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: e.issues[0]?.message || "Data tidak valid." }, 400);
    if (e instanceof ApiError) return json({ error: e.message }, e.status);
    const incident = uid();
    console.error(
      JSON.stringify({
        event: "request_failed",
        incident,
        type: e instanceof Error ? e.name : "unknown",
      }),
    );
    return json(
      {
        error:
          "Permintaan belum berhasil. Coba lagi. Kode: " + incident.slice(0, 8),
      },
      500,
    );
  }
}
function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
