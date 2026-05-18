import { describe, expect, it } from "vitest";
import { extractTafEntry, segmentTafReport } from "../src/langextract.js";

describe("TAF langextract utilities", () => {
  it("segments and extracts source-backed TAF fields with quality evidence", () => {
    const fullText = `
[[PAGE:1]]
N° de demande CH 57945/2013 / marque figurative:
Art. 2 let. a LPM : Le signe consiste en la représentation d'une capsule de médicament d'une forme usuelle.
Le Tribunal administratif fédéral a confirmé cette décision (TAF B-3601/2014).
Classes concernées: 5 (ref)
`;
    const segments = segmentTafReport(fullText);
    expect(segments).toHaveLength(1);

    const entry = extractTafEntry(fullText, segments[0], 0);
    expect(entry.title).toBe("N° de demande CH 57945/2013 / marque figurative");
    expect(entry.sign_type).toBe("marque figurative");
    expect(entry.articles).toContain("Art. 2 let. a LPM");
    expect(entry.classes).toEqual([{ class_number: 5, outcome: "ref" }]);
    expect(entry.taf_refs).toContain("TAF B-3601/2014");
    expect(entry.risk_tags).toContain("shape_3d");
    expect(entry.page_start).toBe(1);
    expect(entry.extraction_quality.parser).toBe("swiss-trademark-langextract");
    expect(entry.extraction_quality.confidence).toBeGreaterThan(0.8);
    expect(entry.extraction_quality.evidence.class_line).toBe("5 (ref)");
  });
});
