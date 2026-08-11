import { describe, expect, it } from "vitest";
import { goodsServicesEntrySchema, identifierSchema, niceClassesSchema, termSchema } from "../src/mcp-schemas.js";
import { sourceManifestSchema } from "../src/types.js";

describe("MCP input budgets", () => {
  it("rejects blank identifiers and oversized class lists", () => {
    expect(identifierSchema.safeParse("   ").success).toBe(false);
    expect(niceClassesSchema.safeParse(Array.from({ length: 46 }, () => 1)).success).toBe(false);
  });

  it("requires bounded non-empty filing terms and supported language codes", () => {
    expect(goodsServicesEntrySchema.safeParse({ class_number: 42, terms: [] }).success).toBe(false);
    expect(goodsServicesEntrySchema.safeParse({ class_number: 42, terms: ["consulting"], language: "xx" }).success).toBe(false);
    expect(goodsServicesEntrySchema.safeParse({ class_number: 42, terms: ["conseil"], language: "fr" }).success).toBe(true);
    expect(termSchema.safeParse("x".repeat(2_001)).success).toBe(false);
  });

  it("rejects malformed timestamps and unsafe provenance paths", () => {
    const source = {
      name: "Example",
      path: "Classification Nice/example.csv",
      source_date: "2026-05-05",
      ingested_at: "2026-08-04T19:43:26.000Z",
      sha256: "a".repeat(64),
      rows: 1,
      warnings: [],
    };
    expect(
      sourceManifestSchema.safeParse({
        generated_at: "2026-08-04T19:43:26.000Z",
        sources: [source],
        warnings: [],
      }).success,
    ).toBe(true);
    expect(
      sourceManifestSchema.safeParse({
        generated_at: "today",
        sources: [{ ...source, path: "../../secret.csv" }],
        warnings: [],
      }).success,
    ).toBe(false);
  });
});
