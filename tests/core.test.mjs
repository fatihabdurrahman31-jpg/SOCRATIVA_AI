import test from "node:test";
import assert from "node:assert/strict";
import {
  nextState,
  validateCitations,
  cosine,
  chunkText,
} from "../lib/pedagogy.ts";
import { analyzerSchema, tutorSchema } from "../lib/contracts.ts";
const a = {
  intent: "answer",
  understandingLevel: 2,
  confidence: 0.9,
  hasClaim: true,
  hasReason: true,
  hasEvidence: false,
  misconceptions: [],
  stuckCount: 0,
  recommendedPhase: "PROBE_REASONING",
  recommendedHelpLevel: 0,
  requiresSource: true,
  academicIntegrityRisk: "low",
};
const s = {
  phase: "ORIENT",
  helpLevel: 0,
  stuckCount: 0,
  attempts: 0,
  visited: ["ORIENT"],
};
test("analyzer rejects invalid level, confidence and phase", () => {
  assert.ok(analyzerSchema.safeParse(a).success);
  for (const change of [
    { understandingLevel: 5 },
    { confidence: 2 },
    { recommendedPhase: "INVENTED" },
  ])
    assert.equal(analyzerSchema.safeParse({ ...a, ...change }).success, false);
});
test("hint escalates and repeated stuck gets worked example", () => {
  const one = nextState(s, a, "Guided Discovery", "REQUEST_HINT", 3);
  assert.equal(one.helpLevel, 1);
  const two = nextState(
    { ...s, ...one },
    a,
    "Guided Discovery",
    "REQUEST_HINT",
    3,
  );
  assert.equal(two.helpLevel, 2);
  const three = nextState(
    { ...s, ...two },
    a,
    "Guided Discovery",
    "REQUEST_HINT",
    3,
  );
  assert.ok(three.helpLevel >= 3);
  assert.equal(three.phase, "SCAFFOLD");
});
test("direct explanation obeys effort and risk policies", () => {
  assert.equal(
    nextState(s, a, "Guided Discovery", "REQUEST_DIRECT", 3).allowDirect,
    false,
  );
  assert.equal(
    nextState({ ...s, attempts: 1 }, a, "Guided Discovery", "REQUEST_DIRECT", 3)
      .phase,
    "CHECK",
  );
  assert.equal(nextState(s, a, "Open Tutor", "REQUEST_DIRECT", 3).helpLevel, 4);
  assert.equal(
    nextState(
      { ...s, attempts: 9 },
      { ...a, academicIntegrityRisk: "high" },
      "Open Tutor",
      "REQUEST_DIRECT",
      3,
    ).allowDirect,
    false,
  );
  assert.equal(
    nextState(
      { ...s, attempts: 9 },
      a,
      "Assessment Support",
      "REQUEST_DIRECT",
      3,
    ).allowDirect,
    false,
  );
  assert.equal(
    nextState({ ...s, attempts: 1 }, a, "Strict Socratic", "REQUEST_DIRECT", 4)
      .allowDirect,
    false,
  );
});
test("completion cannot skip transfer and reflection", () => {
  assert.notEqual(
    nextState(
      s,
      { ...a, recommendedPhase: "COMPLETE" },
      "Guided Discovery",
      null,
      3,
    ).phase,
    "COMPLETE",
  );
  assert.equal(
    nextState(
      { ...s, visited: ["ELICIT", "CHALLENGE", "CHECK", "REFLECT"] },
      { ...a, recommendedPhase: "COMPLETE" },
      "Guided Discovery",
      null,
      3,
    ).phase,
    "COMPLETE",
  );
});
test("citations must use retrieved chunk, page and exact quote", () => {
  const id = crypto.randomUUID(),
    materialId = crypto.randomUUID();
  const source = {
    id,
    materialId,
    title: "Source",
    page: 4,
    content: "Strategi belajar dapat dievaluasi.",
  };
  const tutor = tutorSchema.parse({
    message: "Respons",
    phase: "CLARIFY",
    helpLevel: 1,
    sourceCitations: [
      {
        materialId,
        chunkId: id,
        page: 4,
        label: "Invented title",
        quote: "belajar dapat dievaluasi",
      },
    ],
    reasoningMapUpdates: {
      claims: [],
      evidence: [],
      assumptions: [],
      counterpoints: [],
    },
    quickActions: [],
    sessionShouldComplete: false,
  });
  assert.equal(validateCitations(tutor, [source])[0].label, "Source");
  assert.throws(() => validateCitations(tutor, []));
  assert.throws(() =>
    validateCitations(
      { ...tutor, sourceCitations: [{ ...tutor.sourceCitations[0], page: 7 }] },
      [source],
    ),
  );
  assert.throws(() =>
    validateCitations(
      {
        ...tutor,
        sourceCitations: [{ ...tutor.sourceCitations[0], quote: "tidak ada" }],
      },
      [source],
    ),
  );
});
test("chunking overlaps and preserves tail; cosine validates dimensions", () => {
  const text = "abcdef".repeat(1500),
    chunks = chunkText(text);
  assert.equal(chunks[0].slice(-400), chunks[1].slice(0, 400));
  assert.ok(chunks.at(-1).endsWith(text.slice(-100)));
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1], [1, 2]), 0);
});

test("direct explanations always stay in CHECK despite repeated phase", () => {
  const result = nextState(
    {
      ...s,
      phase: "CHECK",
      helpLevel: 4,
      attempts: 3,
      visited: ["CHECK", "CHECK"],
    },
    { ...a, recommendedPhase: "CHECK", recommendedHelpLevel: 4 },
    "Open Tutor",
    null,
    3,
  );
  assert.equal(result.phase, "CHECK");
});
