import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { SwissTrademarkCorpus } from "../src/db.js";
import { defaultDbPath, defaultManifestPath } from "../src/paths.js";

function corpus(): SwissTrademarkCorpus {
  if (!existsSync(defaultDbPath())) {
    throw new Error("Test database is missing. Run npm run ingest before npm test.");
  }
  return new SwissTrademarkCorpus();
}

describe("ingested corpus", () => {
  it("matches expected source counts and keeps source paths relative", () => {
    const c = corpus();
    const stats = c.corpusStats();
    c.close();

    expect(stats.counts.nice_headings).toBe(45);
    expect(stats.counts.wdl_terms).toBe(41539);
    expect(stats.counts.swissreg_goods_services).toBe(75155);
    expect(stats.counts.class_examples).toBe(1346);
    expect(stats.counts.taf_entries).toBe(549);
    expect(stats.nice_classification_version).toBe("NCL(13-2026)");
    const tafExtraction = stats.document_understanding.taf_extraction;
    expect(tafExtraction).not.toBeNull();
    if (!tafExtraction) throw new Error("TAF extraction metadata is missing.");
    expect(tafExtraction.parser).toBe("swiss-trademark-langextract");
    expect(tafExtraction.average_confidence).toBeGreaterThan(0.85);
    expect(tafExtraction.low_confidence_entries).toBe(0);

    const manifest = JSON.parse(readFileSync(defaultManifestPath(), "utf8"));
    expect(manifest.sources.find((source: any) => source.name === "WDL IPI").rows).toBe(41539);
    const tafSource = manifest.sources.find((source: any) => source.name === "TAF precedents");
    expect(tafSource.metadata.extraction.parser).toBe("swiss-trademark-langextract");
    expect(tafSource.metadata.extraction.entries).toBe(549);
    for (const source of manifest.sources) {
      expect(source.path.startsWith("/")).toBe(false);
    }
  });

  it("rejects malformed source manifests with a focused error", () => {
    const directory = mkdtempSync(join(tmpdir(), "swiss-trademark-manifest-"));
    const manifestPath = join(directory, "source-manifest.json");
    writeFileSync(manifestPath, JSON.stringify({ generated_at: "today", sources: [{ name: "broken" }], warnings: [] }));
    const c = new SwissTrademarkCorpus(defaultDbPath(), manifestPath);
    try {
      expect(() => c.manifest()).toThrow(/Invalid source manifest/);
    } finally {
      c.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects a valid-looking manifest that is not bound to the database", () => {
    const directory = mkdtempSync(join(tmpdir(), "swiss-trademark-manifest-binding-"));
    const manifestPath = join(directory, "source-manifest.json");
    const manifest = JSON.parse(readFileSync(defaultManifestPath(), "utf8"));
    manifest.sources[0].sha256 = "b".repeat(64);
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const c = new SwissTrademarkCorpus(defaultDbPath(), manifestPath);
    try {
      expect(() => c.manifest()).toThrow(/source-set digest/);
    } finally {
      c.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects incompatible database schemas before serving tools", () => {
    const directory = mkdtempSync(join(tmpdir(), "swiss-trademark-db-"));
    const dbPath = join(directory, "incompatible.sqlite");
    const db = new Database(dbPath);
    db.exec("CREATE TABLE unrelated (id INTEGER PRIMARY KEY)");
    db.close();
    try {
      expect(() => new SwissTrademarkCorpus(dbPath)).toThrow(/Incompatible Swiss trademark database/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("MCP tool contracts", () => {
  it("returns Nice class headings and rejects invalid classes", () => {
    const c = corpus();
    const headings = c.niceGetHeadings({ classes: [43] });
    expect(headings.classification_version).toBe("NCL(13-2026)");
    expect(headings.headings[0].heading).toContain("restauration");
    expect(c.getNiceHeading({ class_number: 43 }).heading.heading).toContain("restauration");
    expect(c.listNiceHeadings().headings).toHaveLength(45);
    expect(() => c.niceGetHeadings({ classes: [999] })).toThrow(/Invalid Nice class/);
    c.close();
  });

  it("searches and validates WDL terms", () => {
    const c = corpus();
    const search = c.wdlSearchTerms({ query: "traiteurs", classes: [43], limit: 5 });
    expect(search.results.length).toBeGreaterThan(0);
    expect(search.results[0].source_file).toContain("wdl_toutes_classes_FR.csv");
    expect(search.results.some((result) => String(result.term).includes("traiteurs"))).toBe(true);

    const validation = c.wdlValidateTerms({
      items: [{ class_number: 43, term: "services de traiteurs" }],
    });
    expect(validation.items[0].status).toBe("exact");
    expect(c.validateWdlTerm({ class_number: 43, term: "services de traiteurs" }).item.status).toBe("exact");
    expect(c.wdlTermsByClass({ class_number: 43, limit: 5 }).terms.length).toBe(5);
    expect(c.wdlSearchTerms({ query: "AI", limit: 5 }).results).toEqual([]);
    c.close();
  });

  it("searches Swissreg examples and groups combinations by mark", () => {
    const c = corpus();
    const examples = c.swissregSearchExamples({ query: "Halbleiter", classes: [9], limit: 5 });
    expect(examples.results.length).toBeGreaterThan(0);
    expect(examples.results[0].mark_id).toBe(String(examples.results[0].urn).split(":").at(-1));
    expect(examples.results[0].goods_services_id).toBe(examples.results[0].legacy_mark_id);
    expect(examples.results[0].source_date).toBe("2026-05-05");
    expect(examples.corpus_notice).toMatch(/not a complete anteriority search/);
    expect(() =>
      c.swissregSearchExamples({ query: "Halbleiter", classes: [9], mandataire_groups: ["Bugnion"], limit: 5 }),
    ).toThrow(/mandataire_groups cannot be applied/);
    expect(c.swissregMandataireMetadata({ mandataire_group: "Bugnion", limit: 2 }).results.length).toBeGreaterThan(0);
    expect(c.listSwissregMandataires().mandataires.map((row: any) => row.mandataire_group)).toContain("Bugnion");
    const mandataireSearch = c.searchSwissregTerms({ query: "Halbleiter", nice_class: 9, mandataire: "Bugnion", limit: 2 });
    if (!("mandataire_filter_applied" in mandataireSearch)) throw new Error("Expected a mandataire-filter notice.");
    expect(mandataireSearch.mandataire_filter_applied).toBe(false);
    expect(mandataireSearch.mandataire_filter_notice).toMatch(/not filtered by mandataire/);
    expect(c.getSwissregSectorBenchmark({ nice_class: 9, limit: 5 }).mark_count).toBeGreaterThan(0);
    expect(c.getSwissregClassCombinations({ nice_classes: [9], limit: 3 }).matches.length).toBeGreaterThan(0);

    const combinations = c.swissregClassCombinations({ query: "Halbleiter", classes_hint: [9], limit: 3 });
    expect(combinations.combinations.length).toBeGreaterThan(0);
    expect(combinations.combinations[0].classes).toContain(9);
    expect(combinations.basis.mode).toMatch(/query_matched/);
    c.close();
  });

  it("keeps Swissreg class-combination work bounded", () => {
    const c = corpus();
    const before = process.memoryUsage().heapUsed;
    const started = performance.now();
    const matches = c.getSwissregClassCombinations({ nice_classes: [9], limit: 20 });
    const combinations = c.swissregClassCombinations({ classes_hint: [9], limit: 20 });
    const elapsed = performance.now() - started;
    const heapGrowth = process.memoryUsage().heapUsed - before;

    expect(matches.matches).toHaveLength(20);
    expect(matches.matches.every((mark) => mark.classes.includes(9))).toBe(true);
    expect(combinations.combinations).toHaveLength(20);
    expect(combinations.combinations.every((combination) => combination.classes.includes(9))).toBe(true);
    // Keep a generous wall-clock ceiling for contended cross-platform CI. The
    // heap budget is the stronger regression guard against the former full-table
    // materialization, while this still catches pathological query plans.
    expect(elapsed).toBeLessThan(5_000);
    expect(heapGrowth).toBeLessThan(96 * 1024 * 1024);
    c.close();
  });

  it("searches and retrieves TAF precedent entries", () => {
    const c = corpus();
    const precedents = c.tafSearchPrecedents({
      query: "capsule medicament",
      articles: ["Art. 2 let. a LPM"],
      classes: [5],
      risk_tags: ["shape_3d"],
      limit: 5,
    });
    expect(precedents.results.length).toBeGreaterThan(0);
    expect(precedents.results[0].taf_refs).toContain("TAF B-3601/2014");
    expect(precedents.results[0].risk_tags).toContain("shape_3d");
    expect(precedents.results[0].extraction_confidence).toBeGreaterThan(0.8);

    const detail = c.tafGetEntry({ entry_id: String(precedents.results[0].entry_id) });
    expect(detail.entry.text).toContain("capsule");
    expect(detail.entry.extraction_quality?.parser).toBe("swiss-trademark-langextract");
    expect(c.tafGetDecision({ reference: "B-3601/2014" }).entry.text).toContain("capsule");
    expect(c.tafGetDecision({ reference: " TAF B-3601/2014 " }).entry.text).toContain("capsule");
    expect(() => c.tafGetDecision({ reference: "%" })).toThrow(/Invalid TAF reference/);
    expect(() => c.tafGetDecision({ reference: "   " })).toThrow(/Invalid TAF reference/);
    const similarShape = c.findSimilarTafSigns({ sign: "capsule medicament", sign_type: "figurative", nice_classes: [5], limit: 3 });
    expect(similarShape.matching_method).toBe("local_structural_lexical_score");
    expect(similarShape.inferred_structural_tags).toContain("shape_3d");
    expect(similarShape.results[0].match_reasons).toContain("full-text hit");

    const similarWord = c.findSimilarTafSigns({ sign: "APP STORE", sign_type: "verbal", nice_classes: [9], limit: 3 });
    expect(similarWord.results[0].extracted_sign).toBe("APP STORE");
    expect(similarWord.results[0].score_components.sign_type_match).toBe(true);
    expect(() => c.tafGetEntry({ entry_id: "taf:missing" })).toThrow(/not found/);
    c.close();
  });

  it("correlates TAF class and outcome filters on the same class row", () => {
    const c = corpus();
    const result = c.tafSearchPrecedents({
      query: "VERY IMPORTANT PHARMACY",
      classes: [5],
      outcomes: ["ref"],
      limit: 5,
    });
    expect(result.results.map((entry) => entry.entry_id)).not.toContain("taf:report_2026-05-05:0520");
    c.close();
  });

  it("caps pagination at 50 and includes source metadata", () => {
    const c = corpus();
    const result = c.wdlSearchTerms({ classes: [9], limit: 100 });
    expect(result.results.length).toBe(50);
    expect(result.results[0].source_ref).toMatch(/classe=9/);
    c.close();
  });

  it("supports lawyer-facing filing checks", () => {
    const c = corpus();
    const fees = c.filingRequirementsSnapshot({ classes_count: 4, electronic: true, expedited: true });
    expect(fees.filing_fee_estimate.estimated_total).toBe(850);
    expect(fees.nice_classification_version).toBe("NCL(13-2026)");
    expect(fees.official_links.ipi_opposition).toContain("filing-an-opposition");

    const intake = c.filingIntakeCheck({
      applicant: { name: "Acme Inc.", domicile_country: "United States" },
      sign: { text: "SWISS AI", type: "word" },
      goods_services: [{ class_number: 42, terms: ["software as a service"], language: "en" }],
      planned_use: "SaaS platform",
      territories: ["CH"],
      risk_tolerance: "medium",
    });
    expect(intake.warnings.join("\n")).toMatch(/English/);
    expect(intake.warnings.join("\n")).toMatch(/Swiss representative/);

    const emptyTerms = c.filingIntakeCheck({
      applicant: { name: "Acme Inc." },
      sign: { text: "ACME", type: "word" },
      goods_services: [{ class_number: 42, terms: [] }],
      planned_use: "SaaS platform",
      territories: ["CH"],
      risk_tolerance: "medium",
    });
    expect(emptyTerms.ready_for_filing).toBe(false);
    expect(emptyTerms.missing_required.join("\n")).toMatch(/non-empty goods\/services term/);

    const unsupportedLanguage = c.filingIntakeCheck({
      applicant: { name: "Acme Inc." },
      sign: { text: "ACME", type: "word" },
      goods_services: [{ class_number: 42, terms: ["consulting services"], language: "xx" }],
      planned_use: "SaaS platform",
      territories: ["CH"],
      risk_tolerance: "medium",
    });
    expect(unsupportedLanguage.ready_for_filing).toBe(false);
    expect(unsupportedLanguage.warnings.join("\n")).toMatch(/unsupported language code/);

    const risk = c.signRiskScreen({
      sign: "SWISS AI",
      classes: [42],
      goods_services: ["conseil en intelligence artificielle"],
    });
    expect(risk.flags.some((flag) => flag.risk.includes("Swissness"))).toBe(true);

    const plan = c.clearanceSearchPlan({ sign: "SWISS AI", classes: [42], goods_services: ["logiciels en tant que service"] });
    expect(plan.searches.map((search) => search.source)).toContain("Swissreg");
    expect(plan.searches.map((search) => search.source)).toContain("Madrid Monitor");
    c.close();
  });
});

describe("plugin MCP server layout", () => {
  it("exposes the four corpus-specific MCP servers in both host manifests", () => {
    for (const manifestPath of ["../../.claude-plugin/plugin.json", "../../.codex-plugin/plugin.json"]) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      expect(Object.keys(manifest.mcpServers).sort()).toEqual(["nice-headings", "swissreg-corpus", "taf-decisions", "wdl"]);
      for (const [serverName, serverConfig] of Object.entries<any>(manifest.mcpServers)) {
        expect(serverConfig.command).toBe("node");
        expect(serverConfig.args[0]).toContain("scripts/run-mcp-server.mjs");
        expect(serverConfig.args[1]).toBe(serverName);
      }
    }
  });
});
