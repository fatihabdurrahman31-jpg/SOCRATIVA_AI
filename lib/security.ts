import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  authSessions,
  users,
  courses,
  courseMembers,
  sessions,
  rateLimits,
} from "../db/schema";
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function cookieValue(req: Request, name: string) {
  return req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + "="))
    ?.slice(name.length + 1);
}
export type RequestIdentity = {
  ownerId: string;
  ownerToken: string | null;
};
export async function identity(
  req: Request,
  allowAnonymousCreation = false,
): Promise<RequestIdentity> {
  const platformOwner = req.headers.get("oai-authenticated-user-id");
  if (platformOwner)
    return { ownerId: `platform:${platformOwner}`, ownerToken: null };
  const existing = cookieValue(req, "socrativa_owner");
  if (existing)
    return { ownerId: `anonymous:${await digest(existing)}`, ownerToken: null };
  if (!allowAnonymousCreation)
    throw new ApiError(401, "Pilih akun demo untuk melanjutkan.");
  const ownerToken = uid() + uid();
  return {
    ownerId: `anonymous:${await digest(ownerToken)}`,
    ownerToken,
  };
}
export function sameOrigin(req: Request) {
  if (!["GET", "HEAD"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (!origin || origin !== new URL(req.url).origin)
      throw new ApiError(403, "Permintaan tidak berasal dari aplikasi ini.");
  }
}
export async function actor(req: Request) {
  const { ownerId } = await identity(req);
  const token = cookieValue(req, "socrativa_session");
  if (!token) throw new ApiError(401, "Pilih akun demo untuk melanjutkan.");
  const rows = await getDb()
    .select({ user: users })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(
      and(
        eq(authSessions.id, await digest(token)),
        eq(authSessions.ownerId, ownerId),
        gt(authSessions.expiresAt, now()),
      ),
    )
    .limit(1);
  if (!rows[0])
    throw new ApiError(401, "Sesi masuk berakhir. Silakan buka demo lagi.");
  return rows[0].user;
}
export type Actor = Awaited<ReturnType<typeof actor>>;
export function lecturer(user: Actor) {
  if (user.role !== "LECTURER" && user.role !== "ADMIN")
    throw new ApiError(403, "Tindakan ini hanya tersedia untuk dosen.");
}
export async function courseAccess(user: Actor, id: string, write = false) {
  const db = getDb();
  const [course] = await db
    .select()
    .from(courses)
    .where(
      and(
        eq(courses.id, id),
        eq(courses.institutionId, user.institutionId),
        eq(courses.status, "ACTIVE"),
      ),
    )
    .limit(1);
  if (!course) throw new ApiError(404, "Kelas tidak ditemukan.");
  if (write) {
    lecturer(user);
    if (course.lecturerId !== user.id && user.role !== "ADMIN")
      throw new ApiError(404, "Kelas tidak ditemukan.");
  } else {
    if (course.lecturerId === user.id || user.role === "ADMIN") return course;
    const [member] = await db
      .select()
      .from(courseMembers)
      .where(
        and(eq(courseMembers.courseId, id), eq(courseMembers.userId, user.id)),
      )
      .limit(1);
    if (!member) throw new ApiError(404, "Kelas tidak ditemukan.");
  }
  return course;
}
export async function ownSession(user: Actor, id: string) {
  const [s] = await getDb()
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.id, id),
        eq(sessions.userId, user.id),
        eq(sessions.institutionId, user.institutionId),
        sql`${sessions.deletedAt} is null`,
      ),
    )
    .limit(1);
  if (!s) throw new ApiError(404, "Sesi tidak ditemukan.");
  await courseAccess(user, s.courseId);
  return s;
}
export async function rateLimit(key: string, limit = 30, seconds = 60) {
  const db = getDb(),
    start = Math.floor(Date.now() / 1000 / seconds) * seconds;
  const [row] = await db
    .insert(rateLimits)
    .values({ id: key, count: 1, windowStart: start })
    .onConflictDoUpdate({
      target: rateLimits.id,
      set: {
        count: sql`case when ${rateLimits.windowStart} = ${start} then ${rateLimits.count} + 1 else 1 end`,
        windowStart: start,
      },
    })
    .returning();
  if (row.count > limit)
    throw new ApiError(
      429,
      "Terlalu banyak permintaan. Tunggu sebentar, lalu coba lagi.",
    );
}
export async function readJson(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > 20000)
    throw new ApiError(413, "Isi permintaan terlalu panjang.");
  const text = await req.text();
  if (text.length > 20000)
    throw new ApiError(413, "Isi permintaan terlalu panjang.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "Format permintaan tidak valid.");
  }
}
