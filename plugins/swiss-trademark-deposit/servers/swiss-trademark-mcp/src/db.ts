import { existsSync, readFileSync, statSync } from "node:fs";
import Database from "better-sqlite3";
import { configuredDbPath, configuredManifestPath } from "./paths.js";
import { detectLanguageHint, normalizeText, similarity, toFtsAnyQuery, toFtsQuery, truncate } from "./normalize.js";
import { classifyRequestedSignType, extractTafSignCandidate, inferStructuralTags, scoreExtractedSign } from "./langextract.js";
import { assertCompatibleDatabase } from "./schema.js";
import { sourceManifestSchema, sourceSetDigest } from "./types.js";
import type { ClassOutcome, SourceManifest, TafEntry } from "./types.js";

type DbRow = Record<string, unknown>;

const CORPUS_DATE = "2026-05-05";
const NICE_VERSION = "NCL(13-2026)";
const OFFICIAL_SOURCE_CHECKED_AT = "2026-08-04";
const MAX_SOURCE_MANIFEST_BYTES = 1024 * 1024;

const OFFICIAL_LINKS = {
  ipi_requirements: "https://www.ige.ch/en/protecting-your-ip/trade-marks/before-you-apply/requirements-for-protection",
  ipi_goods_services:
    "https://www.ige.ch/en/protecting-your-ip/trade-marks/before-you-apply/your-ip-protection-strategy/list-of-goods-and-services",
  ipi_national_application: "https://www.ige.ch/en/protecting-your-ip/trade-marks/national-applications",
  ipi_fees: "https://www.ige.ch/en/protecting-your-ip/trade-marks/national-applications/costs-and-fees",
  ipi_duration: "https://www.ige.ch/en/protecting-your-ip/trade-marks/national-applications/duration-of-procedure",
  ipi_opposition:
    "https://www.ige.ch/en/protecting-your-ip/trade-marks/after-registration/monitor-and-defend-your-trade-mark/filing-an-opposition",
  ipi_public_signs:
    "https://www.ige.ch/en/protecting-your-ip/trade-marks/before-you-apply/requirements-for-protection/grounds-for-refusal/protected-public-signs",
  ipi_use: "https://www.ige.ch/en/protecting-your-ip/trade-marks/after-registration/use-your-trade-mark",
  wipo_nice_2026: "https://www.wipo.int/en/web/madrid-system/w/news/2025/coming-on-january-1-2026-thirteenth-edition-of-the-nice-classification",
  swissreg: "https://www.swissreg.ch",
  tmview: "https://www.tmdn.org/tmview",
  global_brand_database: "https://branddb.wipo.int",
  madrid_monitor: "https://www3.wipo.int/madrid/monitor/en/",
  zefix: "https://www.zefix.ch",
  article_6ter: "https://6ter.wipo.int",
};

function pagination(limit?: number, offset?: number): { limit: number; offset: number } {
  const normalizedLimit = Math.min(Math.max(Number(limit ?? 10), 1), 50);
  const normalizedOffset = Math.max(Number(offset ?? 0), 0);
  return { limit: normalizedLimit, offset: normalizedOffset };
}

function requireClasses(classes?: number[]): number[] | undefined {
  if (!classes) return undefined;
  const normalized = classes.map((value) => Number(value));
  const invalid = normalized.find((value) => !Number.isInteger(value) || value < 1 || value > 45);
  if (invalid !== undefined) throw new Error(`Invalid Nice class ${invalid}; expected an integer from 1 to 45.`);
  return [...new Set(normalized)].sort((a, b) => a - b);
}

function classWhere(classes: number[] | undefined, column = "class_number"): { sql: string; params: number[] } {
  if (!classes?.length) return { sql: "", params: [] };
  return {
    sql: ` AND ${column} IN (${classes.map(() => "?").join(", ")})`,
    params: classes,
  };
}

function parseJsonArray<T>(value: unknown, fallback: T): T {
  try {
    return JSON.parse(String(value ?? "")) as T;
  } catch {
    return fallback;
  }
}

function sourceRef(row: DbRow): string {
  const parts = [];
  if (row.class_number) parts.push(`classe=${row.class_number}`);
  if (row.page) parts.push(`page=${row.page}`);
  if (row.line_page) parts.push(`ligne=${row.line_page}`);
  return parts.join(";") || "local";
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function words(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 2);
}

function ratio(part: number, whole: number): number {
  if (!whole) return 0;
  return part / whole;
}

function sourceAgeDays(sourceDate: string | null, now = new Date()): number | null {
  if (!sourceDate) return null;
  const parsed = new Date(`${sourceDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - parsed.getTime()) / 86_400_000));
}

function officialLanguageWarnings(labels: Array<{ class_number?: number; term: string; language?: string }>) {
  return labels
    .map((label) => {
      const declared = label.language?.trim().toLowerCase();
      const detected = detectLanguageHint(label.term);
      const language = declared || detected || "unknown";
      const classPart = label.class_number ? `Class ${label.class_number}: ` : "";
      if (declared && !["de", "fr", "it", "en"].includes(declared)) {
        return `${classPart}"${truncate(label.term, 90)}" declares unsupported language code "${truncate(declared, 20)}"; use de, fr, it, or en.`;
      }
      if (language === "en") {
        return `${classPart}"${truncate(label.term, 90)}" appears to be English; Swiss national filings require German, French, or Italian labels.`;
      }
      if (language === "unknown") {
        return `${classPart}"${truncate(label.term, 90)}" could not be matched to an official Swiss filing language; verify the wording.`;
      }
      return null;
    })
    .filter((warning): warning is string => Boolean(warning));
}

function feeEstimate(classesCount = 1, electronic = true, expedited = false) {
  const normalizedClasses = Math.max(1, Math.floor(Number(classesCount) || 1));
  const base = 450;
  const electronicDiscount = electronic ? 100 : 0;
  const classSurcharge = Math.max(0, normalizedClasses - 3) * 100;
  const expeditedFee = expedited ? 400 : 0;
  return {
    currency: "CHF",
    classes_count: normalizedClasses,
    base_filing_fee: base,
    electronic_discount: electronicDiscount,
    class_surcharge_from_4th_class: classSurcharge,
    expedited_examination_fee: expeditedFee,
    estimated_total: base - electronicDiscount + classSurcharge + expeditedFee,
    verify_current_at_filing: true,
  };
}

function isSwissDomicile(value: string): boolean {
  return ["ch", "switzerland", "suisse", "schweiz", "svizzera", "swiss confederation", "confederation suisse"].includes(normalizeText(value));
}

function collapseForPlan(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function canonicalTafReference(value: string): string {
  const reference = collapseForPlan(value);
  const tafMatch = reference.match(/^(?:TAF\s+)?B-(\d{1,5})\/(\d{4})$/i);
  if (tafMatch) return `TAF B-${tafMatch[1]}/${tafMatch[2]}`;

  const atfMatch = reference.match(/^ATF\s+(\d+)\s+([IVX]+)\s+(\d+)$/i);
  if (atfMatch) return `ATF ${atfMatch[1]} ${atfMatch[2].toUpperCase()} ${atfMatch[3]}`;

  throw new Error(`Invalid TAF reference "${truncate(reference, 80)}"; expected B-3601/2014, TAF B-3601/2014, or ATF 123 IV 45.`);
}

function translateSearchTokens(tokens: string[]): string[] {
  const dictionary: Record<string, string[]> = {
    ai: ["ia", "ki", "intelligence artificielle", "kunstliche intelligenz", "intelligenza artificiale"],
    bakery: ["boulangerie", "backerei", "panetteria"],
    chocolate: ["chocolat", "schokolade", "cioccolato"],
    fresh: ["frais", "frisch", "fresco"],
    suisse: ["swiss", "schweiz", "svizzera"],
    swiss: ["suisse", "schweiz", "svizzera"],
    technology: ["technologie", "technologie", "tecnologia"],
    wine: ["vin", "wein", "vino"],
    zurich: ["zuerich", "zurigo"],
  };
  return unique(tokens.flatMap((token) => dictionary[token] ?? []));
}

function classifyTafEntrySignType(row: DbRow): "verbal" | "figurative" | "combined" | "other" {
  const text = normalizeText(`${row.sign_type ?? ""} ${row.title ?? ""}`);
  if (text.includes("combin")) return "combined";
  if (text.includes("figurat")) return "figurative";
  if (text.includes("tridimension") || text.includes("position") || text.includes("sonore") || text.includes("mouvement") || text.includes("motif")) {
    return "other";
  }
  return "verbal";
}

export class SwissTrademarkCorpus {
  readonly db: Database.Database;
  readonly manifestPath: string;

  constructor(dbPath = configuredDbPath(), manifestPath = configuredManifestPath()) {
    if (!existsSync(dbPath)) {
      throw new Error(`Swiss trademark database not found at ${dbPath}. Run npm run ingest first.`);
    }
    this.db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      assertCompatibleDatabase(this.db);
    } catch (error) {
      this.db.close();
      throw error;
    }
    this.manifestPath = manifestPath;
  }

  close(): void {
    this.db.close();
  }

  manifest(): SourceManifest {
    if (!existsSync(this.manifestPath)) {
      return { generated_at: new Date(0).toISOString(), sources: [], warnings: ["source-manifest.json not found"] };
    }
    const manifestBytes = statSync(this.manifestPath).size;
    if (manifestBytes > MAX_SOURCE_MANIFEST_BYTES) {
      throw new Error(
        `Source manifest at ${this.manifestPath} is ${manifestBytes} bytes; maximum is ${MAX_SOURCE_MANIFEST_BYTES}.`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.manifestPath, "utf8"));
    } catch (error) {
      throw new Error(`Invalid source manifest JSON at ${this.manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    const result = sourceManifestSchema.safeParse(parsed);
    if (!result.success) {
      const issue = result.error.issues[0];
      const location = issue?.path.length ? issue.path.join(".") : "manifest";
      throw new Error(`Invalid source manifest at ${this.manifestPath}: ${location}: ${issue?.message ?? "schema validation failed"}`);
    }
    const schemaVersion = Number(this.db.pragma("user_version", { simple: true }));
    if (schemaVersion >= 1) {
      const metadata = new Map(
        (this.db.prepare("SELECT key, value FROM corpus_metadata").all() as Array<{ key: string; value: string }>).map(
          (row) => [row.key, row.value],
        ),
      );
      if (metadata.get("manifest_generated_at") !== result.data.generated_at) {
        throw new Error("Source manifest timestamp does not match the bundled database metadata.");
      }
      if (metadata.get("source_set_sha256") !== sourceSetDigest(result.data.sources)) {
        throw new Error("Source manifest inputs do not match the bundled database source-set digest.");
      }
    }
    return result.data;
  }

  private tafExtractionStats() {
    try {
      const rows = this.db.prepare("SELECT extraction_quality_json FROM taf_entries").all() as DbRow[];
      const qualities = rows.map((row) => parseJsonArray<Record<string, any>>(row.extraction_quality_json, {})).filter((row) => row.parser);
      const count = qualities.length || 1;
      return {
        parser: qualities[0]?.parser ?? "unknown",
        parser_version: qualities[0]?.parser_version ?? "unknown",
        entries: qualities.length,
        average_confidence: Math.round((qualities.reduce((total, item) => total + Number(item.confidence ?? 0), 0) / count) * 1000) / 1000,
        low_confidence_entries: qualities.filter((item) => Number(item.confidence ?? 0) < 0.55).length,
        warning_count: qualities.reduce((total, item) => total + (Array.isArray(item.warnings) ? item.warnings.length : 0), 0),
        field_coverage: {
          title: qualities.filter((item) => Boolean(item.coverage?.title)).length,
          sign_type: qualities.filter((item) => Boolean(item.coverage?.sign_type)).length,
          articles: qualities.filter((item) => Number(item.coverage?.articles ?? 0) > 0).length,
          classes: qualities.filter((item) => Number(item.coverage?.classes ?? 0) > 0).length,
          taf_refs: qualities.filter((item) => Number(item.coverage?.taf_refs ?? 0) > 0).length,
          risk_tags: qualities.filter((item) => Number(item.coverage?.risk_tags ?? 0) > 0).length,
        },
      };
    } catch {
      return null;
    }
  }

  niceGetHeadings(input: { classes?: number[] } = {}) {
    const classes = requireClasses(input.classes);
    const where = classWhere(classes);
    const rows = this.db
      .prepare(
        `SELECT class_number, heading, source_file, source_date
                , classification_version
         FROM nice_headings
         WHERE 1=1${where.sql}
         ORDER BY class_number`,
      )
      .all(...where.params) as DbRow[];
    return { classification_version: NICE_VERSION, headings: rows };
  }

  getNiceHeading(input: { class_number: number }) {
    const result = this.niceGetHeadings({ classes: [input.class_number] });
    const heading = result.headings[0];
    if (!heading) throw new Error(`Nice heading not found for class ${input.class_number}.`);
    return { classification_version: result.classification_version, heading };
  }

  listNiceHeadings() {
    return this.niceGetHeadings();
  }

  wdlSearchTerms(input: { query?: string; classes?: number[]; source?: string | null; limit?: number; offset?: number } = {}) {
    const classes = requireClasses(input.classes);
    const { limit, offset } = pagination(input.limit, input.offset);
    const query = String(input.query ?? "").trim();
    const source = input.source ? String(input.source) : null;
    const where = classWhere(classes, "w.class_number");
    const sourceSql = source ? " AND w.source = ?" : "";
    const baseParams = [...where.params, ...(source ? [source] : [])];
    const limitPlusOne = limit + 1;
    let rows: DbRow[];

    const ftsQuery = toFtsQuery(query);
    if (query && !ftsQuery) {
      return {
        results: [],
        has_more: false,
        query_notice: "Search query is too short after normalization; use at least one token with three or more characters.",
      };
    }
    if (ftsQuery) {
      rows = this.db
        .prepare(
          `SELECT w.id AS term_id, w.class_number, w.term, w.admissible, w.comment, w.source,
                  w.privileged, w.page, w.line_page, bm25(wdl_terms_fts) AS raw_score
           FROM wdl_terms_fts
           JOIN wdl_terms w ON w.rowid = wdl_terms_fts.rowid
           WHERE wdl_terms_fts MATCH ?${where.sql}${sourceSql}
           ORDER BY raw_score
           LIMIT ? OFFSET ?`,
        )
        .all(ftsQuery, ...baseParams, limitPlusOne, offset) as DbRow[];
      if (rows.length === 0) {
        const anyQuery = toFtsAnyQuery(query);
        if (anyQuery && anyQuery !== ftsQuery) {
          rows = this.db
            .prepare(
              `SELECT w.id AS term_id, w.class_number, w.term, w.admissible, w.comment, w.source,
                      w.privileged, w.page, w.line_page, bm25(wdl_terms_fts) AS raw_score
               FROM wdl_terms_fts
               JOIN wdl_terms w ON w.rowid = wdl_terms_fts.rowid
               WHERE wdl_terms_fts MATCH ?${where.sql}${sourceSql}
               ORDER BY raw_score
               LIMIT ? OFFSET ?`,
            )
            .all(anyQuery, ...baseParams, limitPlusOne, offset) as DbRow[];
        }
      }
    } else {
      rows = this.db
        .prepare(
          `SELECT w.id AS term_id, w.class_number, w.term, w.admissible, w.comment, w.source,
                  w.privileged, w.page, w.line_page, 0 AS raw_score
           FROM wdl_terms w
           WHERE 1=1${where.sql}${sourceSql}
           ORDER BY w.class_number, w.term
           LIMIT ? OFFSET ?`,
        )
        .all(...baseParams, limitPlusOne, offset) as DbRow[];
    }

    if (ftsQuery && rows.length === 0) {
      const normalized = normalizeText(query);
      rows = this.db
        .prepare(
          `SELECT w.id AS term_id, w.class_number, w.term, w.admissible, w.comment, w.source,
                  w.privileged, w.page, w.line_page, 0 AS raw_score
           FROM wdl_terms w
           WHERE w.normalized_term LIKE ?${where.sql}${sourceSql}
           ORDER BY w.class_number, w.term
           LIMIT ? OFFSET ?`,
        )
        .all(`%${normalized}%`, ...baseParams, limitPlusOne, offset) as DbRow[];
    }

    const hasMore = rows.length > limit;
    return {
      results: rows.slice(0, limit).map((row) => ({
        term_id: row.term_id,
        class_number: row.class_number,
        term: row.term,
        admissible: row.admissible,
        comment: row.comment,
        source: row.source,
        privileged: row.privileged,
        score: typeof row.raw_score === "number" ? Math.round(Math.abs(row.raw_score) * 1000) / 1000 : 0,
        source_file: "Classification Nice/wdl_toutes_classes_FR.csv",
        source_date: CORPUS_DATE,
        source_ref: sourceRef(row),
      })),
      has_more: hasMore,
    };
  }

  wdlValidateTerms(input: { items: Array<{ class_number: number; term: string }>; fuzzy?: boolean }) {
    const fuzzy = input.fuzzy !== false;
    return {
      items: input.items.map((item) => {
        const [classNumber] = requireClasses([item.class_number]) ?? [];
        const normalized = normalizeText(item.term);
        const exact = this.db
          .prepare("SELECT class_number, term, source, comment FROM wdl_terms WHERE class_number = ? AND normalized_term = ? LIMIT 1")
          .get(classNumber, normalized) as DbRow | undefined;
        if (exact) {
          return {
            class_number: classNumber,
            term: item.term,
            status: "exact",
            exact_match: exact,
            closest_matches: [],
            comment: "Exact WDL match in the requested class.",
          };
        }

        const wrongClass = this.db
          .prepare("SELECT class_number, term, source, comment FROM wdl_terms WHERE normalized_term = ? LIMIT 5")
          .all(normalized) as DbRow[];
        if (wrongClass.length > 0) {
          return {
            class_number: classNumber,
            term: item.term,
            status: "wrong_class",
            exact_match: null,
            closest_matches: wrongClass.map((row) => ({ ...row, score: similarity(item.term, String(row.term)) })),
            comment: "The term exists in WDL, but not in the requested class.",
          };
        }

        const closest = fuzzy
          ? this.wdlSearchTerms({ query: item.term, classes: [classNumber], limit: 8 }).results
              .map((row) => ({
                term: row.term,
                class_number: row.class_number,
                score: Math.round(similarity(item.term, String(row.term)) * 100) / 100,
              }))
              .sort((a, b) => b.score - a.score)
              .slice(0, 5)
          : [];
        const topScore = closest[0]?.score ?? 0;
        return {
          class_number: classNumber,
          term: item.term,
          status: topScore >= 0.55 ? "derived_or_close" : "not_found",
          exact_match: null,
          closest_matches: closest,
          comment:
            topScore >= 0.55
              ? "The wording appears close to a WDL term and should be treated as a possible limitation or derivation."
              : "No WDL support found in the requested class.",
        };
      }),
    };
  }

  wdlTermsByClass(input: { class_number: number; limit?: number; offset?: number }) {
    const [classNumber] = requireClasses([input.class_number]) ?? [];
    const limit = Math.min(Math.max(Number(input.limit ?? 200), 1), 500);
    const offset = Math.max(Number(input.offset ?? 0), 0);
    const rows = this.db
      .prepare(
        `SELECT id AS term_id, class_number, term, admissible, comment, source, privileged, page, line_page
         FROM wdl_terms
         WHERE class_number = ?
         ORDER BY term
         LIMIT ? OFFSET ?`,
      )
      .all(classNumber, limit + 1, offset) as DbRow[];
    return {
      class_number: classNumber,
      terms: rows.slice(0, limit).map((row) => ({
        term_id: row.term_id,
        class_number: row.class_number,
        term: row.term,
        admissible: row.admissible,
        comment: row.comment,
        source: row.source,
        privileged: row.privileged,
        source_file: "Classification Nice/wdl_toutes_classes_FR.csv",
        source_date: CORPUS_DATE,
        source_ref: sourceRef(row),
      })),
      has_more: rows.length > limit,
      output_notice: "Paginated output: use limit/offset to retrieve additional WDL terms for this class.",
    };
  }

  validateWdlTerm(input: { class_number: number; term: string; fuzzy?: boolean }) {
    const result = this.wdlValidateTerms({
      items: [{ class_number: input.class_number, term: input.term }],
      fuzzy: input.fuzzy,
    });
    return { item: result.items[0] };
  }

  swissregSearchExamples(input: {
    query?: string;
    classes?: number[];
    mandataire_groups?: string[];
    limit?: number;
    offset?: number;
  } = {}) {
    const classes = requireClasses(input.classes);
    const { limit, offset } = pagination(input.limit, input.offset);
    const query = String(input.query ?? "").trim();
    if (input.mandataire_groups?.length) {
      throw new Error(
        "mandataire_groups cannot be applied to Swissreg example rows in this corpus: the source only provides filter metadata, not row-level mandataire mapping. Use swissreg_mandataire_metadata for the available metadata.",
      );
    }
    const where = classWhere(classes, "g.class_number");
    const limitPlusOne = limit + 1;
    let rows: DbRow[];
    const ftsQuery = toFtsQuery(query);
    if (query && !ftsQuery) {
      return {
        results: [],
        has_more: false,
        corpus_notice: "Corpus Swissreg partiel; examples are not a complete anteriority search.",
        query_notice: "Search query is too short after normalization; use at least one token with three or more characters.",
      };
    }

    if (ftsQuery) {
      rows = this.db
        .prepare(
          `SELECT g.id, g.urn, m.internal_id, m.title, m.trademark_number, m.application_number, m.status, m.stage,
                  g.class_number, g.goods_services, g.language_hint, g.source_date,
                  bm25(swissreg_goods_fts) AS raw_score
           FROM swissreg_goods_fts
           JOIN swissreg_goods_services g ON g.rowid = swissreg_goods_fts.rowid
           JOIN swissreg_marks m ON m.urn = g.urn
           WHERE swissreg_goods_fts MATCH ?${where.sql}
           ORDER BY raw_score
           LIMIT ? OFFSET ?`,
        )
        .all(ftsQuery, ...where.params, limitPlusOne, offset) as DbRow[];
      if (rows.length === 0) {
        const anyQuery = toFtsAnyQuery(query);
        if (anyQuery && anyQuery !== ftsQuery) {
          rows = this.db
            .prepare(
              `SELECT g.id, g.urn, m.internal_id, m.title, m.trademark_number, m.application_number, m.status, m.stage,
                      g.class_number, g.goods_services, g.language_hint, g.source_date,
                      bm25(swissreg_goods_fts) AS raw_score
               FROM swissreg_goods_fts
               JOIN swissreg_goods_services g ON g.rowid = swissreg_goods_fts.rowid
               JOIN swissreg_marks m ON m.urn = g.urn
               WHERE swissreg_goods_fts MATCH ?${where.sql}
               ORDER BY raw_score
               LIMIT ? OFFSET ?`,
            )
            .all(anyQuery, ...where.params, limitPlusOne, offset) as DbRow[];
        }
      }
    } else {
      rows = this.db
        .prepare(
          `SELECT g.id, g.urn, m.internal_id, m.title, m.trademark_number, m.application_number, m.status, m.stage,
                  g.class_number, g.goods_services, g.language_hint, g.source_date, 0 AS raw_score
           FROM swissreg_goods_services g
           JOIN swissreg_marks m ON m.urn = g.urn
           WHERE 1=1${where.sql}
           ORDER BY g.class_number, m.title
           LIMIT ? OFFSET ?`,
        )
        .all(...where.params, limitPlusOne, offset) as DbRow[];
    }

    const hasMore = rows.length > limit;
    return {
      results: rows.slice(0, limit).map((row) => ({
        mark_id: row.internal_id ?? row.urn,
        goods_services_id: row.id,
        legacy_mark_id: row.id,
        urn: row.urn,
        title: row.title,
        trademark_number: row.trademark_number,
        application_number: row.application_number,
        status: row.status,
        stage: row.stage,
        class_number: row.class_number,
        goods_services: truncate(row.goods_services, 600),
        language_hint: row.language_hint,
        score: typeof row.raw_score === "number" ? Math.round(Math.abs(row.raw_score) * 1000) / 1000 : 0,
        source_file: "Exemples marques/swissreg_mandataires_produits_services_PARTIEL_2026-05-05.xlsx",
        source_date: row.source_date,
      })),
      has_more: hasMore,
      corpus_notice: "Corpus Swissreg partiel; examples are not a complete anteriority search.",
    };
  }

  swissregMandataireMetadata(input: { mandataire_group?: string; query?: string; limit?: number; offset?: number } = {}) {
    const { limit, offset } = pagination(input.limit, input.offset);
    const filters: string[] = [];
    const params: unknown[] = [];
    if (input.mandataire_group) {
      filters.push("mandataire_group = ?");
      params.push(String(input.mandataire_group));
    }
    if (input.query) {
      filters.push("(query LIKE ? OR facet_value LIKE ?)");
      params.push(`%${input.query}%`, `%${input.query}%`);
    }
    const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = this.db
      .prepare(
        `SELECT mandataire_group, query, facet_value, result_count
         FROM swissreg_filter_values
         ${whereSql}
         ORDER BY mandataire_group, result_count DESC, query
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit + 1, offset) as DbRow[];
    return {
      results: rows.slice(0, limit),
      has_more: rows.length > limit,
      corpus_notice:
        "These are Swissreg filter metadata values only. They cannot be used as row-level filters for goods/services examples in the current corpus.",
    };
  }

  searchSwissregTerms(input: { query?: string; nice_class?: number; mandataire?: string; limit?: number; offset?: number } = {}) {
    const result = this.swissregSearchExamples({
      query: input.query,
      classes: input.nice_class ? [input.nice_class] : undefined,
      limit: input.limit,
      offset: input.offset,
    });
    if (!input.mandataire) return result;
    return {
      ...result,
      mandataire_filter_applied: false,
      mandataire_filter_notice:
        "The source workbook does not provide row-level mandataire attribution in the Produits-services sheet, and Valeurs filtre facet IDs do not join to mark IDs. Results are not filtered by mandataire; use list_mandataires or swissreg_mandataire_metadata for available filter metadata.",
      requested_mandataire: input.mandataire,
    };
  }

  listSwissregMandataires() {
    const rows = this.db
      .prepare(
        `SELECT mandataire_group, COUNT(*) AS metadata_rows, SUM(COALESCE(result_count, 0)) AS total_result_count
         FROM swissreg_filter_values
         WHERE mandataire_group IS NOT NULL AND mandataire_group != ''
         GROUP BY mandataire_group
         ORDER BY mandataire_group`,
      )
      .all() as DbRow[];
    return {
      mandataires: rows,
      corpus_notice:
        "Mandataire groups are available as Swissreg filter metadata only. The current source does not map each goods/services row to a mandataire; Valeurs filtre facet IDs are not Swissreg mark IDs.",
    };
  }

  getSwissregClassCombinations(input: { nice_classes: number[]; mode?: "superset" | "exact"; limit?: number }) {
    const requested = requireClasses(input.nice_classes) ?? [];
    if (!requested.length) throw new Error("At least one Nice class is required.");
    const mode = input.mode ?? "superset";
    const limit = Math.min(Math.max(Number(input.limit ?? 20), 1), 50);
    const requestedPlaceholders = requested.map(() => "?").join(", ");
    const exactHaving = mode === "exact" ? " AND COUNT(DISTINCT g.class_number) = ?" : "";
    const candidates = this.db
      .prepare(
        `SELECT g.urn, m.internal_id, m.title, m.trademark_number, m.application_number, m.status, m.stage,
                COUNT(DISTINCT g.class_number) AS class_count
         FROM swissreg_goods_services g
         JOIN swissreg_marks m ON m.urn = g.urn
         GROUP BY g.urn, m.internal_id, m.title, m.trademark_number, m.application_number, m.status, m.stage
         HAVING COUNT(DISTINCT CASE WHEN g.class_number IN (${requestedPlaceholders}) THEN g.class_number END) = ?${exactHaving}
         ORDER BY class_count, m.title, g.urn
         LIMIT ?`,
      )
      .all(...requested, requested.length, ...(mode === "exact" ? [requested.length] : []), limit) as DbRow[];

    if (candidates.length === 0) {
      return {
        requested_classes: requested,
        mode,
        matches: [],
        corpus_notice: "Swissreg corpus is partial and is not a complete anteriority search.",
      };
    }

    const urns = candidates.map((row) => String(row.urn));
    const detailRows = this.db
      .prepare(
        `SELECT urn, class_number, goods_services
         FROM swissreg_goods_services
         WHERE urn IN (${urns.map(() => "?").join(", ")})
         ORDER BY urn, class_number, id`,
      )
      .all(...urns) as DbRow[];

    const detailsByUrn = new Map<string, { classes: number[]; examples: Record<string, string[]> }>();
    for (const row of detailRows) {
      const urn = String(row.urn);
      const current = detailsByUrn.get(urn) ?? { classes: [], examples: {} };
      const classNumber = Number(row.class_number);
      if (!current.classes.includes(classNumber)) current.classes.push(classNumber);
      const bucket = current.examples[String(classNumber)] ?? [];
      if (bucket.length < 2) bucket.push(truncate(String(row.goods_services ?? ""), 180));
      current.examples[String(classNumber)] = bucket;
      detailsByUrn.set(urn, current);
    }

    const requestedKey = requested.join(",");
    const matches = candidates.map((mark) => {
      const urn = String(mark.urn);
      const details = detailsByUrn.get(urn) ?? { classes: [], examples: {} };
      details.classes.sort((a, b) => a - b);
      return {
        urn,
        mark_id: mark.internal_id ?? urn,
        title: String(mark.title ?? ""),
        trademark_number: mark.trademark_number,
        application_number: mark.application_number,
        status: mark.status,
        stage: mark.stage,
        classes: details.classes,
        match_type: details.classes.join(",") === requestedKey ? "exact" : "superset",
        representative_terms: details.examples,
      };
    });

    return {
      requested_classes: requested,
      mode,
      matches,
      corpus_notice: "Swissreg corpus is partial and is not a complete anteriority search.",
    };
  }

  getSwissregSectorBenchmark(input: { nice_class: number; limit?: number }) {
    const [classNumber] = requireClasses([input.nice_class]) ?? [];
    const limit = Math.min(Math.max(Number(input.limit ?? 20), 1), 50);
    const rows = this.db
      .prepare(
        `SELECT urn, goods_services, language_hint
         FROM swissreg_goods_services
         WHERE class_number = ?`,
      )
      .all(classNumber) as DbRow[];

    const marks = new Set<string>();
    const termCounts = new Map<string, number>();
    let labels = 0;
    for (const row of rows) {
      marks.add(String(row.urn));
      const parts = String(row.goods_services ?? "")
        .split(/[;\n]+/)
        .map((part) => collapseForPlan(part))
        .filter((part) => part.length >= 4);
      labels += Math.max(parts.length, 1);
      for (const part of parts) {
        const key = part.toLowerCase();
        termCounts.set(key, (termCounts.get(key) ?? 0) + 1);
      }
    }

    const topTerms = [...termCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([term, count]) => ({ term, count }));

    return {
      nice_class: classNumber,
      mark_count: marks.size,
      goods_services_rows: rows.length,
      average_labels_per_mark: marks.size ? Math.round((labels / marks.size) * 10) / 10 : 0,
      top_terms: topTerms,
      corpus_notice: "Benchmark is computed from the partial local Swissreg professional corpus.",
    };
  }

  private swissregMatchingUrns(query: string, classesHint?: number[], limit = 1000): { urns: string[]; limited: boolean } {
    const where = classWhere(classesHint, "g.class_number");
    const ftsQuery = toFtsQuery(query);
    if (!ftsQuery) return { urns: [], limited: false };
    let rows = this.db
      .prepare(
        `SELECT DISTINCT g.urn
         FROM swissreg_goods_fts
         JOIN swissreg_goods_services g ON g.rowid = swissreg_goods_fts.rowid
         WHERE swissreg_goods_fts MATCH ?${where.sql}
         LIMIT ?`,
      )
      .all(ftsQuery, ...where.params, limit + 1) as DbRow[];
    if (rows.length === 0) {
      const anyQuery = toFtsAnyQuery(query);
      if (anyQuery && anyQuery !== ftsQuery) {
        rows = this.db
          .prepare(
            `SELECT DISTINCT g.urn
             FROM swissreg_goods_fts
             JOIN swissreg_goods_services g ON g.rowid = swissreg_goods_fts.rowid
             WHERE swissreg_goods_fts MATCH ?${where.sql}
             LIMIT ?`,
          )
          .all(anyQuery, ...where.params, limit + 1) as DbRow[];
      }
    }
    return { urns: rows.slice(0, limit).map((row) => String(row.urn)), limited: rows.length > limit };
  }

  swissregClassCombinations(input: { query?: string; classes_hint?: number[]; limit?: number } = {}) {
    const classesHint = requireClasses(input.classes_hint);
    const limit = Math.min(Math.max(Number(input.limit ?? 10), 1), 50);
    const query = String(input.query ?? "").trim();
    const selectionParams: unknown[] = [];
    let selectionWhere = "";
    let basis = "all_corpus";
    let matchedUrns = 0;
    let matchLimitReached = false;

    if (query) {
      const match = this.swissregMatchingUrns(query, classesHint, 1000);
      const urns = match.urns;
      matchedUrns = urns.length;
      matchLimitReached = match.limited;
      basis = match.limited ? "query_matched_mark_sample" : "query_matched_marks";
      if (urns.length === 0) {
        return {
          combinations: [],
          corpus_notice: "Grouped by mark; Swissreg corpus is partial.",
          basis: { mode: basis, query_matched_marks: 0, match_limit: 1000, exhaustive: true },
        };
      }
      selectionWhere = `WHERE g.urn IN (${urns.map(() => "?").join(", ")})`;
      selectionParams.push(...urns);
    } else if (classesHint?.length) {
      basis = "all_marks_with_class_hint";
    }

    const hintPlaceholders = classesHint?.map(() => "?").join(", ") ?? "";
    const hintHaving = classesHint?.length
      ? `HAVING SUM(CASE WHEN class_number IN (${hintPlaceholders}) THEN 1 ELSE 0 END) = ?`
      : "";
    const cteSql = `
      WITH ordered_classes AS (
        SELECT g.urn, g.class_number
        FROM swissreg_goods_services g
        ${selectionWhere}
        GROUP BY g.urn, g.class_number
        ORDER BY g.urn, g.class_number
      ),
      mark_signatures AS (
        SELECT urn, GROUP_CONCAT(class_number, ',') AS class_signature
        FROM ordered_classes
        GROUP BY urn
        ${hintHaving}
      )`;
    const cteParams = [...selectionParams, ...(classesHint ?? []), ...(classesHint?.length ? [classesHint.length] : [])];

    const combinationRows = this.db
      .prepare(
        `${cteSql}
         SELECT class_signature, COUNT(*) AS mark_count, MIN(urn) AS first_urn
         FROM mark_signatures
         GROUP BY class_signature
         ORDER BY mark_count DESC, first_urn
         LIMIT ?`,
      )
      .all(...cteParams, limit) as DbRow[];

    const signatures = combinationRows.map((row) => String(row.class_signature));
    const combinations = combinationRows.map((row) => ({
      classes: String(row.class_signature)
        .split(",")
        .map(Number),
      mark_count: Number(row.mark_count),
      example_titles: [] as string[],
      representative_terms: {} as Record<string, string[]>,
    }));

    if (signatures.length > 0) {
      const signaturePlaceholders = signatures.map(() => "?").join(", ");
      const representativeMarks = this.db
        .prepare(
          `${cteSql},
           ranked_marks AS (
             SELECT ms.class_signature, ms.urn, m.title,
                    ROW_NUMBER() OVER (PARTITION BY ms.class_signature ORDER BY m.title, ms.urn) AS rank
             FROM mark_signatures ms
             JOIN swissreg_marks m ON m.urn = ms.urn
             WHERE ms.class_signature IN (${signaturePlaceholders})
           )
           SELECT class_signature, urn, title
           FROM ranked_marks
           WHERE rank <= 3
           ORDER BY class_signature, rank`,
        )
        .all(...cteParams, ...signatures) as DbRow[];

      const combinationBySignature = new Map(signatures.map((signature, index) => [signature, combinations[index]]));
      const signatureByUrn = new Map<string, string>();
      for (const row of representativeMarks) {
        const signature = String(row.class_signature);
        const urn = String(row.urn);
        signatureByUrn.set(urn, signature);
        const combination = combinationBySignature.get(signature);
        const title = String(row.title ?? "");
        if (combination && title && combination.example_titles.length < 3) combination.example_titles.push(title);
      }

      const representativeUrns = [...signatureByUrn.keys()];
      if (representativeUrns.length > 0) {
        const termRows = this.db
          .prepare(
            `SELECT urn, class_number, goods_services
             FROM swissreg_goods_services
             WHERE urn IN (${representativeUrns.map(() => "?").join(", ")})
             ORDER BY urn, class_number, id`,
          )
          .all(...representativeUrns) as DbRow[];
        for (const row of termRows) {
          const signature = signatureByUrn.get(String(row.urn));
          const combination = signature ? combinationBySignature.get(signature) : undefined;
          if (!combination) continue;
          const key = String(row.class_number);
          const terms = combination.representative_terms[key] ?? [];
          if (terms.length < 5) terms.push(truncate(row.goods_services, 120));
          combination.representative_terms[key] = terms;
        }
      }
    }

    return {
      combinations,
      corpus_notice: "Grouped by mark; Swissreg corpus is partial and is not a complete anteriority search.",
      basis: {
        mode: basis,
        query_matched_marks: query ? matchedUrns : null,
        match_limit: query ? 1000 : null,
        exhaustive: !matchLimitReached,
      },
    };
  }

  swissregMarkDetail(input: { urn: string }) {
    const mark = this.db
      .prepare(
        `SELECT urn, internal_id, trademark_number, application_number, title, status, stage
         FROM swissreg_marks WHERE urn = ?`,
      )
      .get(input.urn) as DbRow | undefined;
    if (!mark) throw new Error(`Swissreg mark not found for urn ${input.urn}.`);
    const classes = this.db
      .prepare(
        `SELECT class_number, goods_services, language_hint, source_date
         FROM swissreg_goods_services WHERE urn = ? ORDER BY class_number`,
      )
      .all(input.urn) as DbRow[];
    return { mark: { ...mark, classes } };
  }

  tafSearchPrecedents(input: {
    query?: string;
    articles?: string[];
    classes?: number[];
    outcomes?: string[];
    risk_tags?: string[];
    limit?: number;
    offset?: number;
  } = {}) {
    const classes = requireClasses(input.classes);
    const { limit, offset } = pagination(input.limit, input.offset);
    const ftsQuery = toFtsQuery(String(input.query ?? ""));
    const articleFilters = input.articles?.filter(Boolean) ?? [];
    const outcomeFilters = input.outcomes?.filter(Boolean) ?? [];
    const riskTagFilters = input.risk_tags?.filter(Boolean) ?? [];
    const filters: string[] = [];
    const params: unknown[] = [];
    if (articleFilters.length) {
      filters.push(
        `EXISTS (
          SELECT 1 FROM taf_entry_articles ta
          WHERE ta.entry_id = e.entry_id
            AND (${articleFilters.map(() => "ta.article LIKE ?").join(" OR ")})
        )`,
      );
      params.push(...articleFilters.map((article) => `%${article}%`));
    }
    if (classes?.length && outcomeFilters.length) {
      filters.push(
        `EXISTS (
          SELECT 1 FROM taf_entry_classes tc
          WHERE tc.entry_id = e.entry_id
            AND tc.class_number IN (${classes.map(() => "?").join(", ")})
            AND tc.outcome IN (${outcomeFilters.map(() => "?").join(", ")})
        )`,
      );
      params.push(...classes, ...outcomeFilters);
    } else if (classes?.length) {
      filters.push(
        `EXISTS (
          SELECT 1 FROM taf_entry_classes tc
          WHERE tc.entry_id = e.entry_id
            AND tc.class_number IN (${classes.map(() => "?").join(", ")})
        )`,
      );
      params.push(...classes);
    } else if (outcomeFilters.length) {
      filters.push(
        `EXISTS (
          SELECT 1 FROM taf_entry_classes tc
          WHERE tc.entry_id = e.entry_id
            AND tc.outcome IN (${outcomeFilters.map(() => "?").join(", ")})
        )`,
      );
      params.push(...outcomeFilters);
    }
    if (riskTagFilters.length) {
      filters.push(
        `EXISTS (
          SELECT 1 FROM taf_entry_tags tt
          WHERE tt.entry_id = e.entry_id
            AND tt.risk_tag IN (${riskTagFilters.map(() => "?").join(", ")})
        )`,
      );
      params.push(...riskTagFilters);
    }
    const filterSql = filters.length ? ` AND ${filters.join(" AND ")}` : "";
    const limitPlusOne = limit + 1;
    let rows: DbRow[];

    if (String(input.query ?? "").trim() && !ftsQuery) {
      return {
        results: [],
        has_more: false,
        query_notice: "Search query is too short after normalization; use at least one token with three or more characters.",
      };
    }
    if (ftsQuery) {
      rows = this.db
        .prepare(
          `SELECT e.*, bm25(taf_entries_fts) AS raw_score
           FROM taf_entries_fts
           JOIN taf_entries e ON e.rowid = taf_entries_fts.rowid
           WHERE taf_entries_fts MATCH ?${filterSql}
           ORDER BY raw_score
           LIMIT ? OFFSET ?`,
        )
        .all(ftsQuery, ...params, limitPlusOne, offset) as DbRow[];
      if (rows.length === 0) {
        const anyQuery = toFtsAnyQuery(String(input.query ?? ""));
        if (anyQuery && anyQuery !== ftsQuery) {
          rows = this.db
            .prepare(
              `SELECT e.*, bm25(taf_entries_fts) AS raw_score
               FROM taf_entries_fts
               JOIN taf_entries e ON e.rowid = taf_entries_fts.rowid
               WHERE taf_entries_fts MATCH ?${filterSql}
               ORDER BY raw_score
               LIMIT ? OFFSET ?`,
            )
            .all(anyQuery, ...params, limitPlusOne, offset) as DbRow[];
        }
      }
    } else {
      rows = this.db
        .prepare(
          `SELECT e.*, 0 AS raw_score FROM taf_entries e
           WHERE 1=1${filterSql}
           ORDER BY e.page_start, e.entry_id
           LIMIT ? OFFSET ?`,
        )
        .all(...params, limitPlusOne, offset) as DbRow[];
    }

    const hasMore = rows.length > limit;
    return {
      results: rows.slice(0, limit).map((row) => this.tafResult(row)),
      has_more: hasMore,
    };
  }

  tafGetEntry(input: { entry_id: string }) {
    const row = this.db.prepare("SELECT * FROM taf_entries WHERE entry_id = ?").get(input.entry_id) as DbRow | undefined;
    if (!row) throw new Error(`TAF entry not found: ${input.entry_id}`);
    return { entry: this.tafEntry(row) };
  }

  tafGetDecision(input: { reference: string }) {
    const reference = canonicalTafReference(input.reference);
    const row = this.db
      .prepare(
        `SELECT e.*, r.taf_ref AS matched_reference
         FROM taf_entry_refs r
         JOIN taf_entries e ON e.entry_id = r.entry_id
         WHERE r.taf_ref = ?
         ORDER BY e.page_start, e.entry_id
         LIMIT 1`,
      )
      .get(reference) as DbRow | undefined;
    if (!row) throw new Error(`TAF decision not found for reference ${reference}.`);
    return { reference: row.matched_reference, entry: this.tafEntry(row) };
  }

  findSimilarTafSigns(input: { sign: string; sign_type?: "verbal" | "figurative" | "combined"; nice_classes?: number[]; limit?: number }) {
    const limit = Math.min(Math.max(Number(input.limit ?? 10), 1), 50);
    const sign = collapseForPlan(input.sign);
    const classes = requireClasses(input.nice_classes);
    const requestedType = classifyRequestedSignType(input.sign_type ?? null);
    const inferredTags = inferStructuralTags(sign, input.sign_type);
    const ftsMatches = new Set(
      this.tafSearchPrecedents({ query: sign, classes, limit: 50 }).results.map((result) => String(result.entry_id)),
    );
    const rows = this.db
      .prepare(
        `SELECT *, 0 AS raw_score
         FROM taf_entries
         WHERE 1=1
         ORDER BY page_start, entry_id
         LIMIT 1000`,
      )
      .all() as DbRow[];

    const scored = rows
      .map((row) => {
        const candidate = extractTafSignCandidate(String(row.title ?? ""));
        const entryTags = parseJsonArray<string[]>(row.risk_tags_json, []);
        const entryClasses = parseJsonArray<ClassOutcome[]>(row.classes_json, []);
        const entryType = classifyTafEntrySignType(row);
        const extractionScore = scoreExtractedSign({
          requested_sign: sign,
          candidate,
          entry_text: String(row.text ?? ""),
          entry_title: String(row.title ?? ""),
          inferred_tags: inferredTags,
          entry_tags: entryTags,
        });
        const requestedClassMatches = classes?.length
          ? entryClasses.filter((entryClass) => classes.includes(entryClass.class_number)).length
          : 0;
        const classOverlap = classes?.length ? ratio(requestedClassMatches, classes.length) : 0;
        const typeMatch =
          requestedType == null
            ? 0
            : requestedType === entryType || (requestedType === "combined" && entryType === "figurative") || (requestedType === "verbal" && entryType === "combined")
              ? 1
              : 0;
        const ftsBoost = ftsMatches.has(String(row.entry_id)) ? 1 : 0;
        const score = Math.min(
          1,
          extractionScore.candidate_similarity * 0.3 +
            extractionScore.lexical_overlap * 0.25 +
            extractionScore.tag_overlap * 0.25 +
            typeMatch * 0.1 +
            classOverlap * 0.1 +
            ftsBoost * 0.2,
        );
        const reasons = [
          extractionScore.candidate_similarity >= 0.45 ? "similar extracted sign text" : null,
          extractionScore.lexical_overlap > 0 ? "shared lexical tokens" : null,
          extractionScore.tag_overlap > 0 ? "shared structural risk tags" : null,
          typeMatch ? "matching sign type" : null,
          classOverlap ? "overlapping Nice classes" : null,
          ftsBoost ? "full-text hit" : null,
        ].filter((reason): reason is string => Boolean(reason));
        return {
          row,
          score,
          candidate,
          entryType,
          lexicalOverlap: extractionScore.lexical_overlap,
          tagOverlap: extractionScore.tag_overlap,
          candidateSimilarity: extractionScore.candidate_similarity,
          classOverlap,
          typeMatch,
          ftsBoost,
          reasons,
        };
      })
      .filter((item) => item.score > 0 || item.reasons.length > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      sign,
      sign_type: input.sign_type ?? null,
      nice_classes: classes ?? [],
      inferred_structural_tags: inferredTags,
      matching_method: "local_structural_lexical_score",
      results: scored.map((item) => ({
        ...this.tafResult({ ...item.row, raw_score: item.score }),
        extracted_sign: item.candidate,
        inferred_entry_sign_type: item.entryType,
        similarity_score: Math.round(item.score * 100) / 100,
        score_components: {
          extracted_sign_similarity: Math.round(item.candidateSimilarity * 100) / 100,
          lexical_overlap: Math.round(item.lexicalOverlap * 100) / 100,
          structural_tag_overlap: Math.round(item.tagOverlap * 100) / 100,
          class_overlap: Math.round(item.classOverlap * 100) / 100,
          sign_type_match: Boolean(item.typeMatch),
          full_text_hit: Boolean(item.ftsBoost),
        },
        match_reasons: item.reasons,
      })),
      limitation: "Local lexical and structural-tag matching only; embeddings remain a v2 target.",
    };
  }

  corpusStats() {
    const manifest = this.manifest();
    const counts = {
      nice_headings: (this.db.prepare("SELECT COUNT(*) AS count FROM nice_headings").get() as DbRow).count,
      wdl_terms: (this.db.prepare("SELECT COUNT(*) AS count FROM wdl_terms").get() as DbRow).count,
      swissreg_goods_services: (this.db.prepare("SELECT COUNT(*) AS count FROM swissreg_goods_services").get() as DbRow).count,
      swissreg_marks: (this.db.prepare("SELECT COUNT(*) AS count FROM swissreg_marks").get() as DbRow).count,
      class_examples: (this.db.prepare("SELECT COUNT(*) AS count FROM class_examples").get() as DbRow).count,
      taf_entries: (this.db.prepare("SELECT COUNT(*) AS count FROM taf_entries").get() as DbRow).count,
    };
    return {
      generated_at: manifest.generated_at,
      corpus_date: CORPUS_DATE,
      nice_classification_version: NICE_VERSION,
      official_sources_checked_at: OFFICIAL_SOURCE_CHECKED_AT,
      counts,
      sources: manifest.sources.map((source) => ({
        name: source.name,
        rows: source.rows,
        source_date: source.source_date,
        age_days: sourceAgeDays(source.source_date),
        warnings: source.warnings,
        metadata: source.metadata ?? null,
      })),
      document_understanding: {
        taf_extraction: this.tafExtractionStats(),
      },
      warnings: manifest.warnings,
      freshness_notice:
        "Corpus data is local and date-stamped. Verify current IPI fees, filing requirements, and WIPO/Nice updates at the official sources at filing time.",
      official_links: OFFICIAL_LINKS,
    };
  }

  filingRequirementsSnapshot(input: { classes_count?: number; electronic?: boolean; expedited?: boolean } = {}) {
    return {
      official_sources_checked_at: OFFICIAL_SOURCE_CHECKED_AT,
      nice_classification_version: NICE_VERSION,
      filing_language_rule: "Swiss national applications require goods/services in German, French, or Italian; English is not enough.",
      relative_grounds_rule:
        "The IPI examines formal requirements and absolute grounds. It does not examine likelihood of confusion with earlier marks.",
      filing_fee_estimate: feeEstimate(input.classes_count, input.electronic !== false, Boolean(input.expedited)),
      timing_indicators: {
        early_examination: "Straightforward applications can be examined within six working days when the list largely uses accepted IPI database terms.",
        ordinary_examination: "Other applications are generally examined within two months after payment.",
        expedited_examination: "Expedited examination is available for an additional fee and targets one month for registration or an objection letter.",
      },
      post_registration: {
        opposition_window: "The three-month opposition period begins after publication on Swissreg.",
        use_requirement: "Use is required within five consecutive years for the registered goods/services.",
      },
      verify_current_at_filing: true,
      official_links: OFFICIAL_LINKS,
    };
  }

  clearanceSearchPlan(input: {
    sign: string;
    classes?: number[];
    goods_services?: string[];
    mark_type?: string;
    territories?: string[];
  }) {
    const classes = requireClasses(input.classes);
    const sign = collapseForPlan(input.sign);
    const tokenList = words(sign);
    const compact = sign.replace(/[\s-]+/g, "");
    const hyphenated = tokenList.join("-");
    const spaced = tokenList.join(" ");
    const translations = translateSearchTokens(tokenList);
    const variants = unique([
      sign,
      normalizeText(sign),
      compact,
      hyphenated,
      spaced,
      ...translations,
      ...tokenList,
    ]).filter((variant) => variant.length >= 2);
    const classPart = classes?.length ? ` in classes ${classes.join(", ")}` : "";
    const goodsPart = input.goods_services?.length ? `; goods/services: ${input.goods_services.map((item) => truncate(item, 80)).join(" | ")}` : "";

    return {
      sign,
      classes: classes ?? [],
      mark_type: input.mark_type ?? null,
      territories: input.territories?.length ? input.territories : ["CH"],
      variants,
      searches: [
        {
          source: "Swissreg",
          purpose: "Swiss applications and registrations, including international registrations with effect in Switzerland.",
          queries: variants.map((variant) => `${variant}${classPart}`),
          url: OFFICIAL_LINKS.swissreg,
        },
        {
          source: "TMview",
          purpose: "Multi-office visibility for identical and similar marks before extending or relying on a Swiss filing.",
          queries: variants,
          url: OFFICIAL_LINKS.tmview,
        },
        {
          source: "WIPO Global Brand Database",
          purpose: "International and figurative/image search; include dominant word and visual elements.",
          queries: variants,
          url: OFFICIAL_LINKS.global_brand_database,
        },
        {
          source: "Madrid Monitor",
          purpose: "International registrations designating Switzerland.",
          queries: variants,
          url: OFFICIAL_LINKS.madrid_monitor,
        },
        {
          source: "Zefix",
          purpose: "Company-name conflicts and commercial identity checks.",
          queries: variants.slice(0, 8),
          url: OFFICIAL_LINKS.zefix,
        },
        {
          source: "Web/domain search",
          purpose: "Unregistered use, domain names, marketplace use, and sector context.",
          queries: variants.slice(0, 8).map((variant) => `"${variant}" Switzerland trademark${goodsPart}`),
          url: "https://www.google.com/search",
        },
      ],
      figurative_or_combined_mark_steps:
        input.mark_type && /figur|logo|combined|combin|image|3d|tridimension/i.test(input.mark_type)
          ? [
              "Search the verbal element independently.",
              "Search visual elements with WIPO Global Brand Database image/figurative tools.",
              "Assign Vienna-style visual descriptors manually before comparing overall impression.",
            ]
          : [],
      risk_assessment_factors: [
        "similarity of signs",
        "identity or similarity of goods/services",
        "commercial proximity",
        "distinctiveness of the earlier mark",
        "status and territory",
        "opposition and litigation risk tolerance",
      ],
      limitation:
        "This is a search plan, not a complete clearance opinion. The local Swissreg corpus is only a drafting/example corpus and not a live register search.",
      official_links: OFFICIAL_LINKS,
    };
  }

  signRiskScreen(input: { sign: string; classes?: number[]; goods_services?: string[]; mark_type?: string }) {
    const classes = requireClasses(input.classes);
    const sign = collapseForPlan(input.sign);
    const normalized = normalizeText(sign);
    const markType = normalizeText(input.mark_type ?? "");
    const goodsText = normalizeText((input.goods_services ?? []).join(" "));
    const signTokens = words(sign);
    const goodsTokens = new Set(words(goodsText).filter((token) => token.length >= 4));
    const flags: Array<{ risk: string; level: "green" | "orange" | "red"; reason: string; source_url?: string }> = [];
    const hasAny = (patterns: string[]) => patterns.some((pattern) => normalized.includes(pattern));

    if (hasAny(["swiss", "suisse", "schweiz", "svizzera", "helvet", "zurich", "geneve", "geneva", "alps", "alpine"])) {
      flags.push({
        risk: "Swissness / geographic provenance",
        level: "orange",
        reason: "Geographic or Swissness wording requires consistency with the claimed goods/services and actual origin/use.",
        source_url: OFFICIAL_LINKS.ipi_requirements,
      });
    }
    if (hasAny(["red cross", "croix rouge", "schweizerkreuz", "swiss cross", "united nations", "nations unies", "wipo", "who", "oms"])) {
      flags.push({
        risk: "protected public signs",
        level: "red",
        reason: "The sign may contain or evoke protected national/international signs, abbreviations, or emblems.",
        source_url: OFFICIAL_LINKS.ipi_public_signs,
      });
    }
    const descriptiveOverlap = signTokens.filter((token) => goodsTokens.has(token));
    if (descriptiveOverlap.length) {
      flags.push({
        risk: "descriptiveness",
        level: "orange",
        reason: `The sign overlaps with goods/services wording: ${descriptiveOverlap.join(", ")}.`,
        source_url: OFFICIAL_LINKS.ipi_requirements,
      });
    }
    if (/3d|tridimension|shape|forme/.test(markType)) {
      flags.push({
        risk: "shape / 3D sign",
        level: "orange",
        reason: "Shapes are often refused when usual, banal, technically necessary, or imposed by the product.",
        source_url: OFFICIAL_LINKS.ipi_requirements,
      });
    }
    if (/color|colour|couleur|farbe/.test(markType)) {
      flags.push({
        risk: "colour sign",
        level: "orange",
        reason: "Colours generally belong to the public domain unless the sign is distinctive in context or supported by strong evidence.",
        source_url: OFFICIAL_LINKS.ipi_requirements,
      });
    }
    if (/slogan/.test(markType) || signTokens.length >= 4) {
      flags.push({
        risk: "slogan / promotional wording",
        level: "orange",
        reason: "Long or promotional wording should be checked for banal advertising messages and direct product claims.",
        source_url: OFFICIAL_LINKS.ipi_requirements,
      });
    }

    const tafQueries = unique([
      sign,
      `${sign} descriptif`,
      `${sign} provenance`,
      ...(input.goods_services ?? []).slice(0, 3),
      ...(flags.some((flag) => flag.risk.includes("shape")) ? [`${sign} forme usuelle techniquement necessaire`] : []),
      ...(flags.some((flag) => flag.risk.includes("protected")) ? [`${sign} embleme signe public`] : []),
    ]);

    return {
      sign,
      classes: classes ?? [],
      mark_type: input.mark_type ?? null,
      flags,
      taf_search_recommendations: tafQueries.map((query) => ({
        query,
        classes: classes ?? [],
        articles: ["Art. 2 let. a LPM"],
      })),
      conclusion:
        flags.length === 0
          ? "No obvious absolute-ground issue detected by the rule screen; still run TAF and official-source checks for a filing opinion."
          : "Rule screen found issues that need practitioner review before filing.",
      limitation: "This rule screen is conservative and preparatory. It does not replace legal analysis or live register clearance.",
      official_links: OFFICIAL_LINKS,
    };
  }

  filingIntakeCheck(input: {
    applicant?: { name?: string; domicile_country?: string; representative_in_ch?: boolean };
    sign?: { text?: string; type?: string; representation_provided?: boolean; color_claim?: string | null };
    goods_services?: Array<{ class_number: number; terms: string[]; language?: string }>;
    priority_claim?: { claimed?: boolean; details?: string };
    planned_use?: string;
    territories?: string[];
    risk_tolerance?: string;
  } = {}) {
    const missing_required: string[] = [];
    const warnings: string[] = [];
    const next_questions: string[] = [];
    if (!input.applicant?.name) missing_required.push("Applicant name and legal identity.");
    if (input.applicant?.domicile_country && !isSwissDomicile(input.applicant.domicile_country) && !input.applicant.representative_in_ch) {
      warnings.push("Foreign-domiciled applicants may need a Swiss representative; confirm representation before filing.");
    }
    if (!input.sign?.text && !input.sign?.representation_provided) missing_required.push("Exact sign representation.");
    if (!input.sign?.type) missing_required.push("Trade mark type: word, figurative, combined, 3D, colour, sound, position, etc.");
    if (!input.goods_services?.length) {
      missing_required.push("Goods/services list by Nice class.");
    } else {
      for (const entry of input.goods_services) {
        const usableTerms = entry.terms.map((term) => collapseForPlan(term)).filter(Boolean);
        if (usableTerms.length === 0) missing_required.push(`At least one non-empty goods/services term for class ${entry.class_number}.`);
      }
    }
    if (!input.planned_use) next_questions.push("For which concrete products/services will the mark be used in the next five years?");
    if (!input.territories?.length) next_questions.push("Is protection needed only in Switzerland or also abroad?");
    if (!input.risk_tolerance) next_questions.push("What opposition/refusal risk is acceptable for this client?");
    if (input.priority_claim?.claimed && !input.priority_claim.details) missing_required.push("Priority claim details and supporting filing data.");

    const labels = (input.goods_services ?? []).flatMap((entry) => {
      const [classNumber] = requireClasses([entry.class_number]) ?? [];
      return entry.terms
        .map((term) => collapseForPlan(term))
        .filter(Boolean)
        .map((term) => ({ class_number: classNumber, term, language: entry.language }));
    });
    warnings.push(...officialLanguageWarnings(labels));

    const uniqueClassCount = new Set((input.goods_services ?? []).map((entry) => entry.class_number)).size || 1;

    return {
      missing_required,
      warnings,
      next_questions,
      ready_for_drafting: missing_required.length === 0,
      ready_for_filing: missing_required.length === 0 && warnings.length === 0,
      filing_requirements: this.filingRequirementsSnapshot({ classes_count: uniqueClassCount }),
    };
  }

  private tafEntry(row: DbRow): TafEntry {
    return {
      entry_id: String(row.entry_id),
      title: String(row.title ?? ""),
      sign_type: row.sign_type ? String(row.sign_type) : null,
      text: String(row.text ?? ""),
      articles: parseJsonArray<string[]>(row.articles_json, []),
      classes: parseJsonArray(row.classes_json, []),
      taf_refs: parseJsonArray<string[]>(row.taf_refs_json, []),
      risk_tags: parseJsonArray<string[]>(row.risk_tags_json, []),
      page_start: row.page_start == null ? null : Number(row.page_start),
      page_end: row.page_end == null ? null : Number(row.page_end),
      source_file: String(row.source_file ?? ""),
      source_date: row.source_date ? String(row.source_date) : null,
      extraction_quality: parseJsonArray<Record<string, unknown>>(row.extraction_quality_json, {}),
    };
  }

  private tafResult(row: DbRow) {
    const entry = this.tafEntry(row);
    return {
      entry_id: entry.entry_id,
      title: entry.title,
      sign_type: entry.sign_type,
      articles: entry.articles,
      classes: entry.classes,
      taf_refs: entry.taf_refs,
      risk_tags: entry.risk_tags,
      summary: truncate(entry.text, 650),
      page_start: entry.page_start,
      score: typeof row.raw_score === "number" ? Math.round(Math.abs(row.raw_score) * 1000) / 1000 : 0,
      extraction_confidence:
        typeof entry.extraction_quality?.confidence === "number" ? Math.round(entry.extraction_quality.confidence * 1000) / 1000 : null,
      source_file: entry.source_file,
      source_date: entry.source_date,
    };
  }
}
