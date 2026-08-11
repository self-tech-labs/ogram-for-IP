import { describe, expect, it } from "vitest";
import { detectLanguageHint } from "../src/normalize.js";

describe("filing language hints", () => {
  it("does not mistake common English services wording for French", () => {
    expect(detectLanguageHint("software consulting services")).toBe("en");
    expect(detectLanguageHint("retail and management services")).toBe("en");
  });

  it("recognizes representative filing wording in the three Swiss official languages", () => {
    expect(detectLanguageHint("services de formation et conseils")).toBe("fr");
    expect(detectLanguageHint("Beratung und Entwicklung von Software")).toBe("de");
    expect(detectLanguageHint("servizi di consulenza per software")).toBe("it");
  });
});
