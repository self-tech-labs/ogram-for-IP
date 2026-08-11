export const DB_APPLICATION_ID = 0x53544d43; // "STMC"
export const DB_SCHEMA_VERSION = 1;
const LEGACY_REQUIRED_TABLES = [
    "nice_headings",
    "wdl_terms",
    "wdl_terms_fts",
    "swissreg_marks",
    "swissreg_goods_services",
    "swissreg_goods_fts",
    "taf_entries",
    "taf_entries_fts",
    "taf_entry_articles",
    "taf_entry_classes",
    "taf_entry_refs",
    "taf_entry_tags",
];
const REQUIRED_COLUMNS = {
    nice_headings: ["class_number", "heading", "classification_version"],
    wdl_terms: ["id", "class_number", "term", "normalized_term"],
    swissreg_marks: ["urn", "internal_id", "title"],
    swissreg_goods_services: ["id", "urn", "class_number", "goods_services", "source_date"],
    taf_entries: ["entry_id", "text", "classes_json", "taf_refs_json", "risk_tags_json", "extraction_quality_json"],
};
export function applySchemaMetadata(db) {
    db.pragma(`application_id = ${DB_APPLICATION_ID}`);
    db.pragma(`user_version = ${DB_SCHEMA_VERSION}`);
    db.exec(`
    CREATE TABLE corpus_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT INTO corpus_metadata (key, value) VALUES ('schema_version', '${DB_SCHEMA_VERSION}');
  `);
}
export function assertCompatibleDatabase(db) {
    const applicationId = Number(db.pragma("application_id", { simple: true }));
    const schemaVersion = Number(db.pragma("user_version", { simple: true }));
    const tableRows = db
        .prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view')")
        .all();
    const tables = new Set(tableRows.map((row) => row.name));
    const missing = LEGACY_REQUIRED_TABLES.filter((table) => !tables.has(table));
    if (missing.length > 0)
        throw new Error(`Incompatible Swiss trademark database: missing required tables ${missing.join(", ")}.`);
    for (const [table, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
        const columns = new Set(db.pragma(`table_info(${table})`).map((column) => column.name));
        const missingColumns = requiredColumns.filter((column) => !columns.has(column));
        if (missingColumns.length > 0) {
            throw new Error(`Incompatible Swiss trademark database: ${table} is missing columns ${missingColumns.join(", ")}.`);
        }
    }
    // Retain read compatibility with the structurally validated v0.1 corpus. New
    // builds always carry the explicit application and schema metadata below.
    if (schemaVersion === 0 && applicationId === 0)
        return;
    if (applicationId !== DB_APPLICATION_ID) {
        throw new Error(`Incompatible Swiss trademark database application id ${applicationId}; expected ${DB_APPLICATION_ID}.`);
    }
    if (schemaVersion !== DB_SCHEMA_VERSION) {
        throw new Error(`Unsupported Swiss trademark database schema version ${schemaVersion}; expected ${DB_SCHEMA_VERSION}.`);
    }
    if (!tables.has("corpus_metadata"))
        throw new Error("Incompatible Swiss trademark database: corpus_metadata is missing.");
    const metadata = new Map(db.prepare("SELECT key, value FROM corpus_metadata").all().map((row) => [row.key, row.value]));
    const metadataVersion = metadata.get("schema_version");
    if (Number(metadataVersion) !== DB_SCHEMA_VERSION) {
        throw new Error(`Swiss trademark database metadata version ${String(metadataVersion)} does not match schema version ${DB_SCHEMA_VERSION}.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(metadata.get("manifest_generated_at") ?? "")) {
        throw new Error("Swiss trademark database manifest timestamp metadata is missing or invalid.");
    }
    if (!/^[a-f0-9]{64}$/.test(metadata.get("source_set_sha256") ?? "")) {
        throw new Error("Swiss trademark database source-set digest metadata is missing or invalid.");
    }
}
