import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type EvaluationCase = {
  id: string;
  prompt: string;
  required_concepts: string[];
  forbidden_claims: string[];
};

describe("skill evaluation fixtures", () => {
  it("keeps a non-empty, uniquely identified adversarial regression set", () => {
    const path = resolve(import.meta.dirname, "../../../evals/cases.json");
    const payload = JSON.parse(readFileSync(path, "utf8")) as {
      schema_version: number;
      cases: EvaluationCase[];
    };

    expect(payload.schema_version).toBe(1);
    expect(payload.cases.length).toBeGreaterThanOrEqual(8);
    expect(new Set(payload.cases.map((item) => item.id)).size).toBe(payload.cases.length);

    for (const item of payload.cases) {
      expect(item.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(item.prompt.trim().length).toBeGreaterThan(20);
      expect(item.required_concepts.length).toBeGreaterThanOrEqual(2);
      expect(item.forbidden_claims.length).toBeGreaterThanOrEqual(1);
      expect(item.required_concepts.every((concept) => concept.trim().length > 3)).toBe(true);
      expect(item.forbidden_claims.every((claim) => claim.trim().length > 3)).toBe(true);
    }
  });
});
