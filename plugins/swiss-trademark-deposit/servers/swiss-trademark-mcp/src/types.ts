export type SourceInfo = {
  name: string;
  path: string;
  source_date: string | null;
  ingested_at: string;
  sha256: string;
  rows: number;
  warnings: string[];
  metadata?: Record<string, unknown>;
};

export type SourceManifest = {
  generated_at: string;
  sources: SourceInfo[];
  warnings: string[];
};

export type PaginationInput = {
  limit?: number;
  offset?: number;
};

export type ClassOutcome = {
  class_number: number;
  outcome: string | null;
};

export type TafEntry = {
  entry_id: string;
  title: string;
  sign_type: string | null;
  text: string;
  articles: string[];
  classes: ClassOutcome[];
  taf_refs: string[];
  risk_tags: string[];
  page_start: number | null;
  page_end: number | null;
  source_file: string;
  source_date: string | null;
  extraction_quality?: Record<string, unknown>;
};
