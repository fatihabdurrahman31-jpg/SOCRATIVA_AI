import { and, eq, sql, desc, inArray } from "drizzle-orm";
import { getDb } from "../db";
import * as t from "../db/schema";
import { courseAccess, type Actor } from "./security";
export async function analytics(
  user: Actor,
  courseId: string,
  from?: string,
  to?: string,
  activityId?: string,
) {
  await courseAccess(user, courseId, true);
  const db = getDb();
  const filters = [
    eq(t.sessions.courseId, courseId),
    eq(t.sessions.institutionId, user.institutionId),
    sql`${t.sessions.deletedAt} is null`,
  ];
  if (from) filters.push(sql`${t.sessions.createdAt} >= ${from}`);
  if (to)
    filters.push(sql`${t.sessions.createdAt} <= ${to + "T23:59:59.999Z"}`);
  if (activityId) filters.push(eq(t.sessions.activityId, activityId));
  const sessions = await db
    .select({
      id: t.sessions.id,
      userId: t.sessions.userId,
      status: t.sessions.status,
      helpLevel: t.sessions.helpLevel,
    })
    .from(t.sessions)
    .where(and(...filters));
  const active = new Set(sessions.map((s) => s.userId)).size;
  const threshold = 5;
  const total = sessions.length,
    complete = sessions.filter((s) => s.status === "COMPLETED").length;
  if (active < threshold)
    return {
      active,
      total,
      complete,
      completionRate: total ? Math.round((complete / total) * 100) : 0,
      suppressed: true,
      threshold,
      medianTurns: null,
      citationCoverage: null,
      usefulness: null,
      helpLevels: [],
      concepts: [],
    };
  const ids = sessions.map((s) => s.id);
  const turns = await db
    .select({ sessionId: t.messages.sessionId, count: sql<number>`count(*)` })
    .from(t.messages)
    .where(and(inArray(t.messages.sessionId, ids), eq(t.messages.role, "USER")))
    .groupBy(t.messages.sessionId);
  const counts = sessions
    .map((s) => turns.find((v) => v.sessionId === s.id)?.count || 0)
    .sort((a, b) => a - b);
  const mid = Math.floor(counts.length / 2);
  const medianTurns =
    counts.length % 2 ? counts[mid] : (counts[mid - 1] + counts[mid]) / 2;
  const replies = await db
    .select({ id: t.messages.id, feedback: t.messages.feedback })
    .from(t.messages)
    .where(
      and(inArray(t.messages.sessionId, ids), eq(t.messages.role, "ASSISTANT")),
    );
  const cited = replies.length
    ? await db
        .selectDistinct({ messageId: t.messageCitations.messageId })
        .from(t.messageCitations)
        .where(
          inArray(
            t.messageCitations.messageId,
            replies.map((r) => r.id),
          ),
        )
    : [];
  const feedback = replies.filter((r) => r.feedback !== null);
  const concepts = await db
    .select({
      concept: t.learningSignals.concept,
      count: sql<number>`count(*)`,
    })
    .from(t.learningSignals)
    .where(inArray(t.learningSignals.sessionId, ids))
    .groupBy(t.learningSignals.concept)
    .orderBy(desc(sql`count(*)`))
    .limit(8);
  return {
    active,
    total,
    complete,
    completionRate: total ? Math.round((complete / total) * 100) : 0,
    suppressed: false,
    threshold,
    medianTurns,
    citationCoverage: replies.length
      ? Math.round((cited.length / replies.length) * 100)
      : 0,
    usefulness: feedback.length
      ? Math.round(
          (feedback.filter((f) => f.feedback === 1).length / feedback.length) *
            100,
        )
      : null,
    helpLevels: Array.from({ length: 6 }, (_, level) => ({
      level,
      count: sessions.filter((s) => s.helpLevel === level).length,
    })),
    concepts,
  };
}
