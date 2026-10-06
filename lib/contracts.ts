import { z } from "zod";
export const phases = [
  "ORIENT",
  "ELICIT",
  "CLARIFY",
  "PROBE_REASONING",
  "CHALLENGE",
  "SCAFFOLD",
  "SYNTHESIZE",
  "CHECK",
  "REFLECT",
  "COMPLETE",
] as const;
export const phaseSchema = z.enum(phases);
export const policies = [
  "Guided Discovery",
  "Strict Socratic",
  "Open Tutor",
  "Assessment Support",
] as const;
export const analyzerSchema = z.object({
  intent: z.enum([
    "answer",
    "question",
    "request_hint",
    "request_direct_explanation",
    "off_topic",
  ]),
  understandingLevel: z.number().int().min(0).max(4),
  confidence: z.number().min(0).max(1),
  hasClaim: z.boolean(),
  hasReason: z.boolean(),
  hasEvidence: z.boolean(),
  misconceptions: z.array(z.string().max(200)).max(8),
  stuckCount: z.number().int().min(0).max(100),
  recommendedPhase: phaseSchema,
  recommendedHelpLevel: z.number().int().min(0).max(5),
  requiresSource: z.boolean(),
  academicIntegrityRisk: z.enum(["low", "medium", "high"]),
});
export const reasoningSchema = z.object({
  claims: z.array(z.string().max(600)).max(12),
  evidence: z.array(z.string().max(600)).max(12),
  assumptions: z.array(z.string().max(600)).max(12),
  counterpoints: z.array(z.string().max(600)).max(12),
});
export const tutorSchema = z.object({
  message: z.string().min(1).max(12000),
  phase: phaseSchema,
  helpLevel: z.number().int().min(0).max(5),
  sourceCitations: z
    .array(
      z.object({
        materialId: z.string().uuid(),
        chunkId: z.string().uuid(),
        page: z.number().int().positive().nullable(),
        label: z.string().max(200),
        quote: z.string().min(1).max(1500),
      }),
    )
    .max(6),
  reasoningMapUpdates: reasoningSchema,
  quickActions: z.array(z.string().max(100)).max(4),
  sessionShouldComplete: z.boolean(),
});
export const sendSchema = z
  .object({
    content: z.string().trim().max(8000).default(""),
    action: z
      .enum(["REQUEST_HINT", "REQUEST_DIRECT", "CHALLENGE"])
      .nullable()
      .default(null),
    key: z.string().uuid(),
  })
  .refine(
    (x) => x.content.length > 0 || x.action !== null,
    "Tulis jawaban terlebih dahulu.",
  );
export const courseSchema = z.object({
  title: z.string().trim().min(3).max(150),
  code: z.string().trim().min(2).max(30),
  description: z.string().trim().min(5).max(2000),
  semester: z.string().trim().min(2).max(100),
});
export const activitySchema = z.object({
  title: z.string().trim().min(5).max(200),
  scenario: z.string().trim().min(20).max(8000),
  objectives: z.array(z.string().trim().min(3).max(500)).min(1).max(10),
  mode: z.enum(["SOCRATIC_LEARNING", "ARGUMENT_REVIEW"]),
  difficulty: z.enum(["BASIC", "INTERMEDIATE", "ADVANCED"]),
  policy: z.enum(policies),
  minPhases: z.number().int().min(3).max(8),
  reflectionQuestions: z.array(z.string().max(500)).max(5),
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]),
  materialIds: z.array(z.string().uuid()).max(20),
});
export type Analyzer = z.infer<typeof analyzerSchema>;
export type Tutor = z.infer<typeof tutorSchema>;
export const emptyMap = () => ({
  claims: [],
  evidence: [],
  assumptions: [],
  counterpoints: [],
});
export const phaseLabels: Record<string, string> = {
  ORIENT: "Orientasi",
  ELICIT: "Pemahaman awal",
  CLARIFY: "Perjelas konsep",
  PROBE_REASONING: "Telusuri alasan",
  CHALLENGE: "Uji argumen",
  SCAFFOLD: "Petunjuk",
  SYNTHESIZE: "Rangkai kesimpulan",
  CHECK: "Uji pemahaman",
  REFLECT: "Refleksi",
  COMPLETE: "Selesai",
};
