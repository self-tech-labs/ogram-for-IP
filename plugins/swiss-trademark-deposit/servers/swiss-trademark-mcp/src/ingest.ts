import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import Database from "better-sqlite3";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { extractTafEntry, segmentTafReport, summarizeTafExtractions } from "./langextract.js";
import { collapseWhitespace, detectLanguageHint, normalizeText, truncate } from "./normalize.js";
import { configuredSourceRoot, defaultDbPath, defaultManifestPath } from "./paths.js";
import type { SourceInfo, SourceManifest } from "./types.js";

type CsvRow = Record<string, string>;

const SOURCE_DATE = "2026-05-05";
const NICE_VERSION = "NCL(13-2026)";

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sourceInfo(
  name: string,
  sourceRoot: string,
  path: string,
  rows: number,
  warnings: string[],
  metadata?: Record<string, unknown>,
): SourceInfo {
  return {
    name,
    path: relative(sourceRoot, path),
    source_date: SOURCE_DATE,
    ingested_at: new Date().toISOString(),
    sha256: sha256(path),
    rows,
    warnings,
    ...(metadata ? { metadata } : {}),
  };
}

function parseDelimited(input: string, delimiter = ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field.replace(/\r$/, ""));
  if (row.length > 1 || row[0]) rows.push(row);
  return rows;
}

function parseCsv(path: string): CsvRow[] {
  const rows = parseDelimited(readFileSync(path, "utf8"));
  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  return rows
    .filter((row) => row.some((value) => value.trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function createSchema(db: Database.Database): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE nice_headings (
      class_number INTEGER PRIMARY KEY,
      heading TEXT NOT NULL,
      source_file TEXT NOT NULL,
      source_date TEXT,
      classification_version TEXT
    );

    CREATE TABLE wdl_terms (
      id TEXT PRIMARY KEY,
      class_number INTEGER NOT NULL,
      term TEXT NOT NULL,
      admissible TEXT,
      comment TEXT,
      source TEXT,
      privileged TEXT,
      page INTEGER,
      line_page INTEGER,
      normalized_term TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE wdl_terms_fts USING fts5(
      term,
      normalized_term,
      content='wdl_terms',
      content_rowid='rowid',
      tokenize='unicode61 remove_diacritics 2'
    );

    CREATE TABLE swissreg_marks (
      urn TEXT PRIMARY KEY,
      internal_id TEXT,
      trademark_number TEXT,
      application_number TEXT,
      title TEXT,
      status TEXT,
      stage TEXT
    );

    CREATE TABLE swissreg_goods_services (
      id TEXT PRIMARY KEY,
      urn TEXT NOT NULL,
      class_number INTEGER NOT NULL,
      goods_services TEXT NOT NULL,
      language_hint TEXT,
      source_date TEXT,
      source_file TEXT NOT NULL,
      FOREIGN KEY (urn) REFERENCES swissreg_marks(urn)
    );

    CREATE VIRTUAL TABLE swissreg_goods_fts USING fts5(
      goods_services,
      content='swissreg_goods_services',
      content_rowid='rowid',
      tokenize='unicode61 remove_diacritics 2'
    );

    CREATE TABLE swissreg_filter_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mandataire_group TEXT,
      query TEXT,
      facet_value TEXT,
      result_count INTEGER
    );

    CREATE TABLE class_examples (
      id TEXT PRIMARY KEY,
      class_number INTEGER,
      example_text TEXT NOT NULL,
      source_cell TEXT,
      source_file TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE class_examples_fts USING fts5(
      example_text,
      content='class_examples',
      content_rowid='rowid',
      tokenize='unicode61 remove_diacritics 2'
    );

    CREATE TABLE taf_entries (
      entry_id TEXT PRIMARY KEY,
      title TEXT,
      sign_type TEXT,
      text TEXT NOT NULL,
      articles_json TEXT NOT NULL,
      classes_json TEXT NOT NULL,
      taf_refs_json TEXT NOT NULL,
      risk_tags_json TEXT NOT NULL,
      extraction_quality_json TEXT NOT NULL,
      page_start INTEGER,
      page_end INTEGER,
      source_file TEXT NOT NULL,
      source_date TEXT
    );

    CREATE TABLE taf_entry_articles (
      entry_id TEXT NOT NULL,
      article TEXT NOT NULL,
      FOREIGN KEY (entry_id) REFERENCES taf_entries(entry_id)
    );

    CREATE TABLE taf_entry_classes (
      entry_id TEXT NOT NULL,
      class_number INTEGER NOT NULL,
      outcome TEXT,
      FOREIGN KEY (entry_id) REFERENCES taf_entries(entry_id)
    );

    CREATE TABLE taf_entry_refs (
      entry_id TEXT NOT NULL,
      taf_ref TEXT NOT NULL,
      FOREIGN KEY (entry_id) REFERENCES taf_entries(entry_id)
    );

    CREATE TABLE taf_entry_tags (
      entry_id TEXT NOT NULL,
      risk_tag TEXT NOT NULL,
      FOREIGN KEY (entry_id) REFERENCES taf_entries(entry_id)
    );

    CREATE VIRTUAL TABLE taf_entries_fts USING fts5(
      title,
      text,
      content='taf_entries',
      content_rowid='rowid',
      tokenize='unicode61 remove_diacritics 2'
    );

    CREATE INDEX idx_wdl_terms_class ON wdl_terms(class_number);
    CREATE INDEX idx_wdl_terms_normalized ON wdl_terms(normalized_term);
    CREATE INDEX idx_swissreg_goods_class ON swissreg_goods_services(class_number);
    CREATE INDEX idx_swissreg_goods_urn ON swissreg_goods_services(urn);
    CREATE INDEX idx_taf_entry_articles ON taf_entry_articles(article);
    CREATE INDEX idx_taf_entry_classes ON taf_entry_classes(class_number, outcome);
    CREATE INDEX idx_taf_entry_tags ON taf_entry_tags(risk_tag);
  `);
}

function ingestWdl(db: Database.Database, sourceRoot: string): SourceInfo {
  const path = join(sourceRoot, "Classification Nice", "wdl_toutes_classes_FR.csv");
  const warnings: string[] = [];
  const rows = parseCsv(path);
  const expected = ["classe", "admissible", "terme", "commentaire", "source", "privilegie", "page", "ligne_page"];
  const missing = expected.filter((field) => !(field in (rows[0] ?? {})));
  if (missing.length) throw new Error(`WDL CSV missing columns: ${missing.join(", ")}`);

  const insert = db.prepare(`
    INSERT INTO wdl_terms
      (id, class_number, term, admissible, comment, source, privileged, page, line_page, normalized_term)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let inserted = 0;
  const tx = db.transaction(() => {
    rows.forEach((row, index) => {
      const classNumber = Number(row.classe);
      if (!Number.isInteger(classNumber) || classNumber < 1 || classNumber > 45) {
        warnings.push(`Invalid WDL class at row ${index + 2}: ${row.classe}`);
        return;
      }
      const term = collapseWhitespace(row.terme);
      if (!term) {
        warnings.push(`Empty WDL term at row ${index + 2}`);
        return;
      }
      insert.run(
        `wdl:${classNumber}:${index + 1}`,
        classNumber,
        term,
        row.admissible || "",
        row.commentaire || "",
        row.source || "",
        row.privilegie || "",
        row.page ? Number(row.page) : null,
        row.ligne_page ? Number(row.ligne_page) : null,
        normalizeText(term),
      );
      inserted += 1;
    });
    db.exec("INSERT INTO wdl_terms_fts(rowid, term, normalized_term) SELECT rowid, term, normalized_term FROM wdl_terms");
  });
  tx();
  const classes = db.prepare("SELECT COUNT(DISTINCT class_number) AS count FROM wdl_terms").get() as { count: number };
  if (rows.length !== 41541) warnings.push(`Expected 41541 WDL rows, found ${rows.length}`);
  if (inserted !== 41539) warnings.push(`Expected 41539 usable WDL terms after skipping empty labels, inserted ${inserted}`);
  if (classes.count !== 45) warnings.push(`Expected 45 WDL classes, found ${classes.count}`);
  return sourceInfo("WDL IPI", sourceRoot, path, inserted, warnings);
}

async function ingestNice(db: Database.Database, sourceRoot: string): Promise<SourceInfo> {
  const path = join(sourceRoot, "Classification Nice", "Intitulés généraux.docx");
  const warnings: string[] = [];
  const raw = (await mammoth.extractRawText({ path })).value;
  const lines = raw.split(/\r?\n/).map((line) => collapseWhitespace(line)).filter(Boolean);
  const headings: Array<{ classNumber: number; heading: string }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^\d{1,2}$/.test(lines[index])) continue;
    const classNumber = Number(lines[index]);
    const text: string[] = [];
    index += 1;
    while (index < lines.length && !/^\d{1,2}$/.test(lines[index])) {
      text.push(lines[index]);
      index += 1;
    }
    index -= 1;
    if (classNumber >= 1 && classNumber <= 45 && text.length) {
      headings.push({ classNumber, heading: collapseWhitespace(text.join(" ")) });
    }
  }

  const insert = db.prepare(
    "INSERT INTO nice_headings (class_number, heading, source_file, source_date, classification_version) VALUES (?, ?, ?, ?, ?)",
  );
  const tx = db.transaction(() => {
    for (const heading of headings) {
      insert.run(heading.classNumber, heading.heading, "Classification Nice/Intitulés généraux.docx", SOURCE_DATE, NICE_VERSION);
    }
  });
  tx();
  if (headings.length !== 45) warnings.push(`Expected 45 Nice headings, found ${headings.length}`);
  return sourceInfo("Nice headings", sourceRoot, path, headings.length, warnings);
}

async function loadWorkbook(path: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  return workbook;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => cellText(item as ExcelJS.CellValue)).join(" ");
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("text" in value && value.text != null) return String(value.text);
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("hyperlink" in value && "text" in value && value.text != null) return String(value.text);
  }
  return String(value);
}

function worksheetRows(workbook: ExcelJS.Workbook, sheetName: string): Record<string, string>[] {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`Missing worksheet ${sheetName}`);
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = collapseWhitespace(cellText(cell.value));
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const payload: Record<string, string> = {};
    let nonEmpty = false;
    for (let colNumber = 1; colNumber < headers.length; colNumber += 1) {
      const header = headers[colNumber];
      if (!header) continue;
      const value = collapseWhitespace(cellText(row.getCell(colNumber).value));
      if (value) nonEmpty = true;
      payload[header] = value;
    }
    if (nonEmpty) rows.push(payload);
  });
  return rows;
}

async function ingestSwissreg(db: Database.Database, sourceRoot: string): Promise<SourceInfo> {
  const path = join(sourceRoot, "Exemples marques", "swissreg_mandataires_produits_services_PARTIEL_2026-05-05.xlsx");
  const warnings: string[] = [];
  const workbook = await loadWorkbook(path);
  const rows = worksheetRows(workbook, "Produits-services");
  const retryRows = worksheetRows(workbook, "A reprendre");
  const filterRows = worksheetRows(workbook, "Valeurs filtre");

  const markInsert = db.prepare(`
    INSERT OR IGNORE INTO swissreg_marks
      (urn, internal_id, trademark_number, application_number, title, status, stage)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const goodsInsert = db.prepare(`
    INSERT INTO swissreg_goods_services
      (id, urn, class_number, goods_services, language_hint, source_date, source_file)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const filterInsert = db.prepare(`
    INSERT INTO swissreg_filter_values (mandataire_group, query, facet_value, result_count)
    VALUES (?, ?, ?, ?)
  `);

  let inserted = 0;
  const tx = db.transaction(() => {
    rows.forEach((row, index) => {
      const urn = collapseWhitespace(row.urn || row.internal_id || `swissreg-row-${index + 1}`);
      const classNumber = Number(row.nice_class);
      const goods = collapseWhitespace([row.goods_services_part_1, row.goods_services_part_2].filter(Boolean).join(" "));
      if (!Number.isInteger(classNumber) || classNumber < 1 || classNumber > 45 || !goods) {
        warnings.push(`Skipped invalid Swissreg row ${index + 2}`);
        return;
      }
      markInsert.run(
        urn,
        row.internal_id || "",
        row.trademark_number || "",
        row.application_number || "",
        row.title || "",
        row.status || "",
        row.stage || "",
      );
      goodsInsert.run(
        `swissreg:${index + 1}`,
        urn,
        classNumber,
        goods,
        detectLanguageHint(goods),
        SOURCE_DATE,
        "Exemples marques/swissreg_mandataires_produits_services_PARTIEL_2026-05-05.xlsx",
      );
      inserted += 1;
    });
    filterRows.forEach((row) => {
      filterInsert.run(row.mandataire_group || "", row.query || "", row.facet_value || "", row.result_count ? Number(row.result_count) : null);
    });
    db.exec("INSERT INTO swissreg_goods_fts(rowid, goods_services) SELECT rowid, goods_services FROM swissreg_goods_services");
  });
  tx();

  if (inserted !== 75155) warnings.push(`Expected 75155 Swissreg valid rows, inserted ${inserted}`);
  if (retryRows.length !== 30093) warnings.push(`Expected 30093 Swissreg retry rows, found ${retryRows.length}`);
  warnings.push("Row-level mandataire mapping is not present in the Produits-services sheet; mandataire filters are metadata only in v1.");
  return sourceInfo("Swissreg Produits-services", sourceRoot, path, inserted, warnings);
}

async function ingestClassExamples(db: Database.Database, sourceRoot: string): Promise<SourceInfo> {
  const path = join(sourceRoot, "Exemples marques", "Liste classes.xlsx");
  const warnings: string[] = [];
  const workbook = await loadWorkbook(path);
  const insert = db.prepare(`
    INSERT INTO class_examples (id, class_number, example_text, source_cell, source_file)
    VALUES (?, ?, ?, ?, ?)
  `);
  let count = 0;
  const tx = db.transaction(() => {
    workbook.eachSheet((sheet) => {
      sheet.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          const text = collapseWhitespace(cellText(cell.value));
          if (!text) return;
          count += 1;
          const match = text.match(/^(\d{1,2})\b/);
          const classNumber = match ? Number(match[1]) : null;
          if (classNumber == null || classNumber < 1 || classNumber > 45) {
            warnings.push(`No class prefix detected in ${sheet.name}!${cell.address}`);
          }
          insert.run(
            `class-example:${count}`,
            classNumber && classNumber >= 1 && classNumber <= 45 ? classNumber : null,
            text,
            `${sheet.name}!${cell.address}`,
            "Exemples marques/Liste classes.xlsx",
          );
        });
      });
    });
    db.exec("INSERT INTO class_examples_fts(rowid, example_text) SELECT rowid, example_text FROM class_examples");
  });
  tx();
  if (count !== 1346) warnings.push(`Expected 1346 non-empty class example cells, found ${count}`);
  return sourceInfo("Class examples", sourceRoot, path, count, warnings);
}

async function ingestTaf(db: Database.Database, sourceRoot: string): Promise<SourceInfo> {
  const path = join(sourceRoot, "Jurisprudence TAF", "report_2026-05-05.pdf");
  const warnings: string[] = [];
  const parser = new PDFParse({ data: readFileSync(path) });
  const info = await parser.getInfo();
  const pageTexts: string[] = [];
  for (let page = 1; page <= info.total; page += 1) {
    const result = await parser.getText({ partial: [page] });
    pageTexts.push(`\n[[PAGE:${page}]]\n${result.text}`);
  }
  await parser.destroy();

  const fullText = pageTexts.join("\n");
  const segments = segmentTafReport(fullText);
  const entries = segments.map((segment, index) => extractTafEntry(fullText, segment, index));
  const extractionSummary = summarizeTafExtractions(entries);
  const insert = db.prepare(`
    INSERT INTO taf_entries
      (entry_id, title, sign_type, text, articles_json, classes_json, taf_refs_json, risk_tags_json, extraction_quality_json, page_start, page_end, source_file, source_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const articleInsert = db.prepare("INSERT INTO taf_entry_articles (entry_id, article) VALUES (?, ?)");
  const classInsert = db.prepare("INSERT INTO taf_entry_classes (entry_id, class_number, outcome) VALUES (?, ?, ?)");
  const refInsert = db.prepare("INSERT INTO taf_entry_refs (entry_id, taf_ref) VALUES (?, ?)");
  const tagInsert = db.prepare("INSERT INTO taf_entry_tags (entry_id, risk_tag) VALUES (?, ?)");
  const tx = db.transaction(() => {
    entries.forEach((entry, index) => {
      const entryId = `taf:report_2026-05-05:${String(index + 1).padStart(4, "0")}`;
      insert.run(
        entryId,
        entry.title,
        entry.sign_type,
        entry.text,
        JSON.stringify(entry.articles),
        JSON.stringify(entry.classes),
        JSON.stringify(entry.taf_refs),
        JSON.stringify(entry.risk_tags),
        JSON.stringify(entry.extraction_quality),
        entry.page_start,
        entry.page_end,
        "Jurisprudence TAF/report_2026-05-05.pdf",
        SOURCE_DATE,
      );
      entry.articles.forEach((article) => articleInsert.run(entryId, article));
      entry.classes.forEach((classOutcome) => classInsert.run(entryId, classOutcome.class_number, classOutcome.outcome));
      entry.taf_refs.forEach((ref) => refInsert.run(entryId, ref));
      entry.risk_tags.forEach((tag) => tagInsert.run(entryId, tag));
    });
    db.exec("INSERT INTO taf_entries_fts(rowid, title, text) SELECT rowid, title, text FROM taf_entries");
  });
  tx();

  if (info.total !== 78) warnings.push(`Expected 78 TAF PDF pages, found ${info.total}`);
  if (segments.length < 500 || segments.length > 600) warnings.push(`Expected about 549 TAF entries, segmented ${segments.length}`);
  const bRefs = (fullText.match(/\bB-\d{1,5}\/\d{4}\b/g) ?? []).length;
  if (bRefs < 70) warnings.push(`Expected around 73 TAF B references, found ${bRefs}`);
  if (extractionSummary.low_confidence_entries > Math.max(10, segments.length * 0.05)) {
    warnings.push(`TAF extraction quality has ${extractionSummary.low_confidence_entries} low-confidence entries`);
  }
  return sourceInfo("TAF precedents", sourceRoot, path, segments.length, warnings, { extraction: extractionSummary });
}

async function main(): Promise<void> {
  const sourceRoot = configuredSourceRoot();
  if (!existsSync(sourceRoot)) throw new Error(`Source root not found: ${sourceRoot}`);
  const dbPath = process.env.SWISS_TRADEMARK_DB || defaultDbPath();
  const manifestPath = defaultManifestPath();
  mkdirSync(dirname(dbPath), { recursive: true });
  if (existsSync(dbPath)) rmSync(dbPath);
  if (existsSync(`${dbPath}-wal`)) rmSync(`${dbPath}-wal`);
  if (existsSync(`${dbPath}-shm`)) rmSync(`${dbPath}-shm`);

  const db = new Database(dbPath);
  createSchema(db);
  const sources: SourceInfo[] = [];
  sources.push(ingestWdl(db, sourceRoot));
  sources.push(await ingestNice(db, sourceRoot));
  sources.push(await ingestSwissreg(db, sourceRoot));
  sources.push(await ingestClassExamples(db, sourceRoot));
  sources.push(await ingestTaf(db, sourceRoot));
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.pragma("journal_mode = DELETE");
  db.close();

  const manifest: SourceManifest = {
    generated_at: new Date().toISOString(),
    sources,
    warnings: sources.flatMap((source) => source.warnings.map((warning) => `${source.name}: ${warning}`)),
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Generated ${dbPath}`);
  console.log(`Generated ${manifestPath}`);
  for (const source of sources) {
    console.log(`${source.name}: ${source.rows} rows (${source.warnings.length} warnings)`);
  }
  if (manifest.warnings.length) {
    console.log(`Warnings:\n${manifest.warnings.map((warning) => `- ${truncate(warning, 180)}`).join("\n")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
