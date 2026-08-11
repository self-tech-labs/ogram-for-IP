import { describe, expect, it } from "vitest";
import { SwissTrademarkCorpus } from "../src/db.js";

describe("acceptance scenario data substrate", () => {
  it("supports Mosaic Cuisine with class 43 catering and class 41 training", () => {
    const c = new SwissTrademarkCorpus();
    expect(c.wdlSearchTerms({ query: "traiteurs", classes: [43], limit: 5 }).results.length).toBeGreaterThan(0);
    expect(c.wdlSearchTerms({ query: "formation culinaire", classes: [41], limit: 10 }).results.length).toBeGreaterThan(0);
    expect(c.niceGetHeadings({ classes: [43] }).headings[0].heading).toContain("restauration");
    c.close();
  });

  it("supports Alfavin with wine goods, retail, and tasting/training classes", () => {
    const c = new SwissTrademarkCorpus();
    expect(c.niceGetHeadings({ classes: [33] }).headings[0].heading).toContain("Boissons alcoolisées");
    expect(c.wdlSearchTerms({ query: "vente au detail vins", classes: [35], limit: 10 }).results.length).toBeGreaterThan(0);
    expect(c.wdlSearchTerms({ query: "degustation vins", classes: [41], limit: 10 }).results.length).toBeGreaterThan(0);
    c.close();
  });

  it("supports practitioner absolute-ground analysis for medical product shapes", () => {
    const c = new SwissTrademarkCorpus();
    const precedents = c.tafSearchPrecedents({
      query: "forme usuelle dispositif medical capsule",
      articles: ["Art. 2 let. a LPM"],
      classes: [5],
      outcomes: ["ref"],
      limit: 5,
    });
    expect(precedents.results.some((entry) => entry.taf_refs.includes("TAF B-3601/2014"))).toBe(true);
    c.close();
  });

  it("keeps Fresh Bakery style weak verbal marks in the TAF/manual analysis lane", () => {
    const c = new SwissTrademarkCorpus();
    const stats = c.corpusStats();
    expect(stats.warnings.join("\n")).not.toMatch(/EUIPO required/i);
    const precedents = c.tafSearchPrecedents({ query: "descriptif boulangerie", limit: 5 });
    expect(precedents.results.length).toBeGreaterThan(0);
    expect(precedents.results.some((entry) => entry.risk_tags.includes("descriptive"))).toBe(true);
    c.close();
  });
});
