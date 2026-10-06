import type { Analyzer, Tutor } from "./contracts";
import type { ReasoningMap } from "../db/schema";
export type State = {
  phase: string;
  helpLevel: number;
  stuckCount: number;
  attempts: number;
  visited: string[];
};
export function nextState(
  s: State,
  a: Analyzer,
  policy: string,
  action: string | null,
  minPhases: number,
) {
  const hint = action === "REQUEST_HINT" || a.intent === "request_hint";
  const direct =
    action === "REQUEST_DIRECT" || a.intent === "request_direct_explanation";
  const stuck = hint || a.understandingLevel <= 1 ? s.stuckCount + 1 : 0;
  const attempts =
    s.attempts + (a.intent === "answer" && !hint && !direct ? 1 : 0);
  let level = a.recommendedHelpLevel;
  if (hint || stuck >= 2) level = Math.max(level, s.helpLevel + 1);
  if (stuck >= 3) level = Math.max(level, 3);
  const risk =
    a.academicIntegrityRisk === "high" || policy === "Assessment Support";
  const allowDirect =
    !risk &&
    (policy === "Open Tutor" ||
      (policy === "Strict Socratic"
        ? s.attempts >= 2 || stuck >= 2
        : s.attempts >= 1));
  if (direct && allowDirect) level = Math.max(level, 4);
  if (!allowDirect) level = Math.min(level, 3);
  level = Math.max(0, Math.min(level, 5));
  let phase = a.recommendedPhase;
  if (hint || stuck >= 2) phase = "SCAFFOLD";
  if (action === "CHALLENGE") phase = "CHALLENGE";
  if (level >= 4) phase = "CHECK";
  if (s.helpLevel >= 4 && phase !== "REFLECT" && phase !== "COMPLETE")
    phase = "CHECK";
  if (
    s.phase === phase &&
    s.visited.slice(-2).every((p) => p === phase) &&
    s.visited.length >= 2
  )
    phase = stuck >= 2 ? "SCAFFOLD" : "CHALLENGE";
  const distinct = new Set(
    s.visited.filter((p) => !["ORIENT", "COMPLETE"].includes(p)),
  );
  if (
    phase === "COMPLETE" &&
    (!s.visited.includes("CHECK") ||
      !s.visited.includes("REFLECT") ||
      distinct.size < Math.max(minPhases, policy === "Strict Socratic" ? 4 : 3))
  )
    phase = s.visited.includes("CHECK") ? "REFLECT" : "CHECK";
  if (level >= 4) phase = "CHECK";
  return {
    phase,
    helpLevel: level,
    stuckCount: stuck,
    attempts,
    allowDirect,
    risk,
  };
}
export function mergeMap(
  old: ReasoningMap,
  update: ReasoningMap,
): ReasoningMap {
  return Object.fromEntries(
    Object.keys(old).map((k) => [
      k,
      [
        ...new Set([
          ...old[k as keyof ReasoningMap],
          ...update[k as keyof ReasoningMap],
        ]),
      ].slice(-30),
    ]),
  ) as ReasoningMap;
}
export type Source = {
  id: string;
  materialId: string;
  title: string;
  page: number | null;
  content: string;
};
export function validateCitations(t: Tutor, sources: Source[]) {
  return t.sourceCitations.map((c) => {
    const s = sources.find(
      (s) => s.id === c.chunkId && s.materialId === c.materialId,
    );
    if (!s || s.page !== c.page || !s.content.includes(c.quote))
      throw new Error("Citation does not match retrieved source");
    return { ...c, label: s.title };
  });
}
export function cosine(a: number[], b: number[]) {
  if (a.length !== b.length || !a.length) return 0;
  const dot = a.reduce((v, x, i) => v + x * b[i], 0);
  const mag = Math.sqrt(
    a.reduce((v, x) => v + x * x, 0) * b.reduce((v, x) => v + x * x, 0),
  );
  return mag ? dot / mag : 0;
}
export function chunkText(text: string, size = 2800, overlap = 400) {
  const clean = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!clean) return [];
  const chunks: string[] = [];
  for (let start = 0; start < clean.length; start += size - overlap) {
    chunks.push(clean.slice(start, start + size));
    if (start + size >= clean.length) break;
  }
  return chunks;
}
