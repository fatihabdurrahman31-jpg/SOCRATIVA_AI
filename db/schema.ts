import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
const id = () => text("id").primaryKey();
const time = () => text("created_at").notNull();
export const institutions = sqliteTable("institutions", {
  id: id(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  retentionDays: integer("retention_days").notNull().default(30),
  createdAt: time(),
});
export const users = sqliteTable("users", {
  id: id(),
  institutionId: text("institution_id")
    .notNull()
    .references(() => institutions.id),
  name: text("name").notNull(),
  role: text("role", { enum: ["STUDENT", "LECTURER", "ADMIN"] }).notNull(),
  createdAt: time(),
});
export const authSessions = sqliteTable("auth_sessions", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  ownerId: text("owner_id").notNull(),
  expiresAt: text("expires_at").notNull(),
});
export const courses = sqliteTable(
  "courses",
  {
    id: id(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    lecturerId: text("lecturer_id")
      .notNull()
      .references(() => users.id),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    semester: text("semester").notNull(),
    policy: text("policy").notNull().default("Guided Discovery"),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: time(),
  },
  (t) => [index("course_tenant").on(t.institutionId, t.status)],
);
export const courseMembers = sqliteTable(
  "course_members",
  {
    id: id(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull(),
    createdAt: time(),
  },
  (t) => [uniqueIndex("member_unique").on(t.courseId, t.userId)],
);
export const materials = sqliteTable("materials", {
  id: id(),
  institutionId: text("institution_id")
    .notNull()
    .references(() => institutions.id),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id),
  uploadedBy: text("uploaded_by")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  objectKey: text("object_key"),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  status: text("status").notNull(),
  visibility: text("visibility").notNull().default("COURSE"),
  error: text("error"),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  createdAt: time(),
});
export const materialChunks = sqliteTable(
  "material_chunks",
  {
    id: id(),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id),
    institutionId: text("institution_id").notNull(),
    courseId: text("course_id").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    page: integer("page"),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull(),
    embedding: text("embedding", { mode: "json" }).$type<number[]>(),
    embeddingModel: text("embedding_model"),
    createdAt: time(),
  },
  (t) => [index("chunk_scope").on(t.institutionId, t.courseId, t.materialId)],
);
export const activities = sqliteTable("activities", {
  id: id(),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id),
  title: text("title").notNull(),
  scenario: text("scenario").notNull(),
  objectives: text("objectives", { mode: "json" }).$type<string[]>().notNull(),
  mode: text("mode").notNull(),
  difficulty: text("difficulty").notNull(),
  policy: text("policy").notNull(),
  minPhases: integer("min_phases").notNull().default(3),
  reflectionQuestions: text("reflection_questions", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  status: text("status").notNull(),
  createdAt: time(),
});
export const activityMaterials = sqliteTable(
  "activity_materials",
  {
    id: id(),
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id),
  },
  (t) => [
    uniqueIndex("activity_material_unique").on(t.activityId, t.materialId),
  ],
);
export type ReasoningMap = {
  claims: string[];
  evidence: string[];
  assumptions: string[];
  counterpoints: string[];
};
export type Summary = {
  concepts: string[];
  misconceptions: string[];
  nextSteps: string[];
  reflection: string;
  initialUnderstanding: string;
  reasoningMap: ReasoningMap;
  sources: string[];
};
export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    institutionId: text("institution_id").notNull(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    mode: text("mode").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    phase: text("phase").notNull().default("ORIENT"),
    helpLevel: integer("help_level").notNull().default(0),
    stuckCount: integer("stuck_count").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    visited: text("visited", { mode: "json" }).$type<string[]>().notNull(),
    reasoningMap: text("reasoning_map", { mode: "json" })
      .$type<ReasoningMap>()
      .notNull(),
    summary: text("summary", { mode: "json" }).$type<Summary>(),
    note: text("note").notNull().default(""),
    shareWithLecturer: integer("share_with_lecturer", { mode: "boolean" })
      .notNull()
      .default(false),
    lockKey: text("lock_key"),
    lockUntil: text("lock_until"),
    createdAt: time(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("session_owner").on(t.userId, t.updatedAt),
    index("session_course").on(t.courseId, t.status),
  ],
);
export const messages = sqliteTable(
  "messages",
  {
    id: id(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    role: text("role").notNull(),
    content: text("content").notNull(),
    requestKey: text("request_key").notNull(),
    phase: text("phase"),
    helpLevel: integer("help_level"),
    structured: text("structured", { mode: "json" }).$type<
      Record<string, unknown>
    >(),
    modelName: text("model_name"),
    latencyMs: integer("latency_ms"),
    feedback: integer("feedback"),
    createdAt: time(),
  },
  (t) => [
    uniqueIndex("message_idempotency").on(t.sessionId, t.requestKey, t.role),
    index("message_session").on(t.sessionId, t.createdAt),
  ],
);
export const messageCitations = sqliteTable("message_citations", {
  id: id(),
  messageId: text("message_id")
    .notNull()
    .references(() => messages.id),
  chunkId: text("chunk_id")
    .notNull()
    .references(() => materialChunks.id),
  quoteText: text("quote_text").notNull(),
});
export const learningSignals = sqliteTable("learning_signals", {
  id: id(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  messageId: text("message_id")
    .notNull()
    .references(() => messages.id),
  concept: text("concept").notNull(),
  signalType: text("signal_type").notNull(),
  confidence: real("confidence").notNull(),
  createdAt: time(),
});
export const auditLogs = sqliteTable("audit_logs", {
  id: id(),
  institutionId: text("institution_id").notNull(),
  actorUserId: text("actor_user_id").notNull(),
  action: text("action").notNull(),
  targetId: text("target_id").notNull(),
  createdAt: time(),
});
export const rateLimits = sqliteTable("rate_limits", {
  id: id(),
  count: integer("count").notNull().default(0),
  windowStart: integer("window_start").notNull(),
});
