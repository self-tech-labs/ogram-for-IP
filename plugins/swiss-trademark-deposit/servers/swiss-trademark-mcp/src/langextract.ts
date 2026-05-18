import { collapseWhitespace, normalizeText, similarity, truncate } from "./normalize.js";
import type { ClassOutcome } from "./types.js";

export const LANGEXTRACT_PARSER = "swiss-trademark-langextract";
export const LANGEXTRACT_VERSION = "1.0.0";

export type TafReportSegment = {
  text: string;
  index: number;
};

export type TafExtractionQuality = {
  parser: string;
  parser_version: string;
  confidence: number;
  coverage: {
    title: boolean;
    sign_type: boolean;
    articles: number;
    classes: number;
    taf_refs: number;
    risk_tags: number;
  };
  evidence: {
    title: string | null;
    class_line: string | null;
    articles: string[];
    taf_refs: string[];
    risk_tags: string[];
  };
  warnings: string[];
};

export type TafExtractedEntry = {
  raw_text: string;
  text: string;
  title: string;
  sign_type: string | null;
  articles: string[];
  classes: ClassOutcome[];
  taf_refs: string[];
  risk_tags: string[];
  page_start: number | null;
  page_end: number | null;
  extraction_quality: TafExtractionQuality;
};

export type TafExtractionSummary = {
  parser: string;
  parser_version: string;
  entries: number;
  average_confidence: number;
  low_confidence_entries: number;
  warning_count: number;
  field_coverage: {
    title: number;
    sign_type: number;
    articles: number;
    classes: number;
    taf_refs: number;
    risk_tags: number;
  };
};

function uniqueStable(values: string[]): string[] {
  return [...new Set(values.map(collapseWhitespace).filter(Boolean))];
}

function contentWords(value: string): string[] {
  const stopWords = new Set([
    "art",
    "aux",
    "avec",
    "dans",
    "des",
    "donc",
    "elle",
    "est",
    "les",
    "pour",
    "que",
    "qui",
    "une",
    "und",
    "der",
    "die",
    "das",
    "mit",
    "von",
    "for",
    "the",
    "and",
    "with",
  ]);
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function overlapRatio(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (!leftSet.size || !rightSet.size) return 0;
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  return intersection / Math.min(leftSet.size, rightSet.size);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function cleanTafText(value: string): string {
  return value
    .replace(/\[\[PAGE:\d+\]\]/g, "\n")
    .replace(/^Signes Statut Remarques$/gm, "")
    .replace(/^\d+\s*\/\s*\d+\s+https:\/\/ph\.ige\.ch.*$/gm, "")
    .replace(/^--\s*\d+\s+of\s+\d+\s*--$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function segmentTafReport(fullText: string): TafReportSegment[] {
  const classMarkers = [...fullText.matchAll(/Classes concern[ée]es\s*:\s*[^\n]+/gi)];
  return classMarkers.map((marker, index) => {
    const markerIndex = marker.index ?? 0;
    const start = index === 0 ? Math.max(0, fullText.lastIndexOf("N°", markerIndex)) : (classMarkers[index - 1].index ?? 0) + classMarkers[index - 1][0].length;
    const end = markerIndex + marker[0].length;
    return {
      text: fullText.slice(start, end),
      index: start,
    };
  });
}

export function extractPageSpan(fullText: string, segment: TafReportSegment): { page_start: number | null; page_end: number | null } {
  const pageMatches = [...segment.text.matchAll(/\[\[PAGE:(\d+)\]\]/g)].map((pageMatch) => Number(pageMatch[1]));
  const prefix = fullText.slice(0, segment.index);
  const previousPageMatches = [...prefix.matchAll(/\[\[PAGE:(\d+)\]\]/g)].map((pageMatch) => Number(pageMatch[1]));
  const pageStart = pageMatches[0] ?? previousPageMatches.at(-1) ?? null;
  return {
    page_start: pageStart,
    page_end: pageMatches.at(-1) ?? pageStart,
  };
}

export function extractTafTitle(text: string, index: number): string {
  const titleLine =
    text
      .split(/\n/)
      .map((line) => collapseWhitespace(line))
      .find((line) => line && !/^Classes concern[ée]es/i.test(line)) ?? `TAF entry ${index + 1}`;
  return collapseWhitespace(titleLine.replace(/:$/, ""));
}

export function extractLegalArticles(text: string): string[] {
  const matches = text.match(/Art\. ?\d+[^\n:;]{0,80}?(?:LPM|OPM|LPAP)/gi) ?? [];
  return uniqueStable(matches.map((match) => match.replace(/\s+:/, "")));
}

export function extractTafReferences(text: string): string[] {
  const refs = [
    ...(text.match(/\bTAF\s+B-\d{1,5}\/\d{4}\b/gi) ?? []),
    ...(text.match(/\bB-\d{1,5}\/\d{4}\b/g) ?? []).map((ref) => `TAF ${ref}`),
    ...(text.match(/\bATF\s+\d+\s+[IVX]+\s+\d+\b/gi) ?? []),
  ];
  return uniqueStable(refs.map((ref) => ref.replace(/^taf\b/i, "TAF").replace(/^atf\b/i, "ATF")));
}

export function extractClassOutcomes(text: string): { classes: ClassOutcome[]; class_line: string | null } {
  const classLine = text.match(/Classes concern[ée]es\s*:\s*([^\n]+)/i)?.[1] ?? null;
  if (!classLine) return { classes: [], class_line: null };

  const results: ClassOutcome[] = [];
  const withOutcome = classLine.matchAll(/(\d{1,2})\s*\(([^)]+)\)/g);
  for (const match of withOutcome) {
    const classNumber = Number(match[1]);
    if (classNumber >= 1 && classNumber <= 45) {
      results.push({ class_number: classNumber, outcome: collapseWhitespace(match[2]) || null });
    }
  }
  if (results.length === 0) {
    for (const match of classLine.matchAll(/\b(\d{1,2})\b/g)) {
      const classNumber = Number(match[1]);
      if (classNumber >= 1 && classNumber <= 45) results.push({ class_number: classNumber, outcome: null });
    }
  }
  return { classes: results, class_line: collapseWhitespace(classLine) };
}

export function extractSignType(title: string): string | null {
  const segment = title
    .split("/")
    .at(-1)
    ?.replace(/:$/, "")
    .replace(/^marquemarque/i, "marque")
    .trim();
  if (!segment) return null;
  const normalized = normalizeText(segment);
  if (
    normalized.includes("marque") ||
    normalized.includes("motif") ||
    normalized.includes("position") ||
    normalized.includes("couleur") ||
    normalized.includes("forme") ||
    normalized.includes("tridimension")
  ) {
    return segment;
  }
  return null;
}

export function extractRiskTags(text: string, title: string): string[] {
  const normalized = normalizeText(`${title} ${text}`);
  const tags = new Set<string>();
  const addIf = (tag: string, patterns: string[]) => {
    if (patterns.some((pattern) => normalized.includes(pattern))) tags.add(tag);
  };
  addIf("distinctiveness", ["distinctif", "distinctive", "caractere distinctif"]);
  addIf("descriptive", ["descriptif", "descriptive", "description", "indication descriptive"]);
  addIf("public_domain", ["domaine public", "banal", "usuel", "usuelle", "necessaire"]);
  addIf("laudatory", ["laudatif", "qualite", "superieur", "best", "premium", "master"]);
  addIf("deceptive", ["trompe", "tromperie", "fallac", "decept"]);
  addIf("geographic_origin", ["provenance", "geograph", "lieu de fabrication", "suisse", "swiss", "schweiz"]);
  addIf("public_signs", ["embleme", "armoir", "croix", "drapeau", "6ter"]);
  addIf("shape_3d", ["tridimension", "forme", "shape", "capsule", "emballage"]);
  addIf("technical_necessity", ["techniquement necessaire", "necessaire techniquement", "fonctionnel"]);
  addIf("color", ["couleur", "color", "chromatique", "bicolore"]);
  addIf("slogan", ["slogan"]);
  addIf("religious_public_order", ["religieux", "sentiments religieux", "ordre public", "bonnes moeurs"]);
  addIf("acquired_distinctiveness", ["marque imposee", "imposee comme marque", "base de pieces"]);
  return [...tags].sort();
}

export function extractTafSignCandidate(title: string): string | null {
  const cleaned = collapseWhitespace(title)
    .replace(/^(acc|ref|part)\),?\s*/i, "")
    .replace(/^Liens:\s*/i, "");
  if (!cleaned || cleaned.startsWith("N°")) return null;
  const beforeNumber = cleaned.split(/\s+N°\s+/)[0]?.trim();
  if (beforeNumber && beforeNumber !== cleaned) return beforeNumber;
  const indicatorMatch = cleaned.match(
    /^(.+?)\s+(?:Est|N'est|Termes?|Courants?|Dans|A la|Le signe|La marque|Liens|Marque)\b/i,
  );
  if (indicatorMatch?.[1]) return collapseWhitespace(indicatorMatch[1]);
  if (cleaned.length <= 80 && !/Classes concern[ée]es/i.test(cleaned)) return cleaned;
  return null;
}

export function classifyRequestedSignType(value?: string | null): "verbal" | "figurative" | "combined" | null {
  const normalized = normalizeText(value ?? "");
  if (!normalized) return null;
  if (normalized.includes("combin")) return "combined";
  if (normalized.includes("figurat") || normalized.includes("logo") || normalized.includes("image")) return "figurative";
  if (normalized.includes("verb") || normalized.includes("word")) return "verbal";
  return null;
}

export function inferStructuralTags(sign: string, signType?: string | null): string[] {
  const normalized = normalizeText(sign);
  const tokens = contentWords(sign);
  const tags = new Set<string>();
  const hasAny = (patterns: string[]) => patterns.some((pattern) => normalized.includes(pattern));
  if (hasAny(["swiss", "suisse", "schweiz", "svizzera", "helvet", "alp", "zurich", "geneve", "geneva", "region"])) {
    tags.add("geographic_origin");
  }
  if (hasAny(["best", "premium", "advance", "advantage", "basic", "super", "always", "active", "smart", "plus", "pro"])) {
    tags.add("laudatory");
  }
  if (hasAny(["aqua", "bio", "eco", "app", "store", "health", "fresh", "legal", "finance", "wine", "food", "agri", "tech", "ai", "ki", "ia"])) {
    tags.add("descriptive");
    tags.add("public_domain");
  }
  if (hasAny(["cross", "croix", "red cross", "croissant rouge", "swiss cross", "schweizerkreuz", "drapeau", "flag"])) {
    tags.add("public_signs");
  }
  if (hasAny(["red", "blue", "green", "black", "white", "rouge", "bleu", "vert", "noir", "blanc", "farbe", "couleur"])) {
    tags.add("color");
  }
  if (hasAny(["capsule", "forme", "shape", "emballage", "packaging", "bottle", "bouteille", "goulot", "semelle", "position"])) {
    tags.add("shape_3d");
    tags.add("public_domain");
  }
  if (hasAny(["technique", "technical", "necessaire", "fonctionnel", "function"])) tags.add("technical_necessity");
  if (tokens.length >= 4 || /[.!?]/.test(sign)) tags.add("slogan");
  const requestedType = classifyRequestedSignType(signType);
  if (requestedType === "figurative" || requestedType === "combined") tags.add("distinctiveness");
  return [...tags].sort();
}

function confidenceFor(entry: Omit<TafExtractedEntry, "extraction_quality">, classLine: string | null): number {
  const titleScore = entry.title && !entry.title.startsWith("TAF entry") ? 0.2 : 0;
  const classScore = entry.classes.length ? 0.25 : 0;
  const textScore = entry.text.length >= 120 ? 0.15 : entry.text.length >= 60 ? 0.08 : 0;
  const articleScore = entry.articles.length ? 0.15 : 0.06;
  const referenceScore = entry.taf_refs.length ? 0.1 : 0.06;
  const riskScore = entry.risk_tags.length ? 0.1 : 0.04;
  const signTypeScore = entry.sign_type ? 0.05 : 0.02;
  const classLinePenalty = classLine ? 0 : -0.15;
  return Math.max(0, Math.min(1, round(titleScore + classScore + textScore + articleScore + referenceScore + riskScore + signTypeScore + classLinePenalty)));
}

export function extractTafEntry(fullText: string, segment: TafReportSegment, index: number): TafExtractedEntry {
  const text = cleanTafText(segment.text);
  const title = extractTafTitle(text, index);
  const articles = extractLegalArticles(text);
  const { classes, class_line: classLine } = extractClassOutcomes(text);
  const tafRefs = extractTafReferences(text);
  const riskTags = extractRiskTags(text, title);
  const signType = extractSignType(title);
  const pageSpan = extractPageSpan(fullText, segment);
  const base = {
    raw_text: segment.text,
    text,
    title,
    sign_type: signType,
    articles,
    classes,
    taf_refs: tafRefs,
    risk_tags: riskTags,
    page_start: pageSpan.page_start,
    page_end: pageSpan.page_end,
  };
  const warnings = [
    text.length < 60 ? "Very short extracted TAF segment." : null,
    !classLine ? "No Classes concernees line extracted." : null,
    classes.length === 0 ? "No Nice class extracted from TAF segment." : null,
    articles.length === 0 ? "No legal article extracted from TAF segment." : null,
    !title || title.startsWith("TAF entry") ? "No stable title extracted from TAF segment." : null,
  ].filter((warning): warning is string => Boolean(warning));
  const confidence = confidenceFor(base, classLine);
  return {
    ...base,
    extraction_quality: {
      parser: LANGEXTRACT_PARSER,
      parser_version: LANGEXTRACT_VERSION,
      confidence,
      coverage: {
        title: Boolean(title && !title.startsWith("TAF entry")),
        sign_type: Boolean(signType),
        articles: articles.length,
        classes: classes.length,
        taf_refs: tafRefs.length,
        risk_tags: riskTags.length,
      },
      evidence: {
        title,
        class_line: classLine,
        articles: articles.slice(0, 5),
        taf_refs: tafRefs.slice(0, 5),
        risk_tags: riskTags.slice(0, 8),
      },
      warnings,
    },
  };
}

export function summarizeTafExtractions(entries: TafExtractedEntry[]): TafExtractionSummary {
  const count = entries.length || 1;
  const quality = entries.map((entry) => entry.extraction_quality);
  return {
    parser: LANGEXTRACT_PARSER,
    parser_version: LANGEXTRACT_VERSION,
    entries: entries.length,
    average_confidence: round(quality.reduce((total, item) => total + item.confidence, 0) / count),
    low_confidence_entries: quality.filter((item) => item.confidence < 0.55).length,
    warning_count: quality.reduce((total, item) => total + item.warnings.length, 0),
    field_coverage: {
      title: quality.filter((item) => item.coverage.title).length,
      sign_type: quality.filter((item) => item.coverage.sign_type).length,
      articles: quality.filter((item) => item.coverage.articles > 0).length,
      classes: quality.filter((item) => item.coverage.classes > 0).length,
      taf_refs: quality.filter((item) => item.coverage.taf_refs > 0).length,
      risk_tags: quality.filter((item) => item.coverage.risk_tags > 0).length,
    },
  };
}

export function scoreExtractedSign(input: {
  requested_sign: string;
  candidate: string | null;
  entry_text: string;
  entry_title: string;
  inferred_tags: string[];
  entry_tags: string[];
}): { candidate_similarity: number; lexical_overlap: number; tag_overlap: number } {
  const candidateSimilarity = input.candidate ? similarity(input.requested_sign, input.candidate) : 0;
  const lexicalOverlap = overlapRatio(
    contentWords(input.requested_sign),
    contentWords(`${input.candidate ?? ""} ${input.entry_title} ${truncate(input.entry_text, 900)}`),
  );
  const tagOverlap = overlapRatio(input.inferred_tags, input.entry_tags);
  return {
    candidate_similarity: candidateSimilarity,
    lexical_overlap: lexicalOverlap,
    tag_overlap: tagOverlap,
  };
}
