#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SwissTrademarkCorpus } from "./db.js";

const corpus = new SwissTrademarkCorpus();
const server = new McpServer({
  name: "swiss-trademark",
  version: "0.1.0",
});

function toolResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function resourceResult(uri: URL | string, payload: unknown) {
  return {
    contents: [
      {
        uri: String(uri),
        mimeType: "application/json",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

server.registerTool(
  "nice_get_headings",
  {
    title: "Get Nice headings",
    description: "Return official Nice class headings for selected classes, or all 45 if no class list is provided.",
    inputSchema: {
      classes: z.array(z.number().int().min(1).max(45)).optional(),
    },
  },
  async (args) => toolResult(corpus.niceGetHeadings(args)),
);

server.registerTool(
  "wdl_search_terms",
  {
    title: "Search WDL terms",
    description: "Search IPI WDL goods/services terms by text and optional Nice class.",
    inputSchema: {
      query: z.string().optional(),
      classes: z.array(z.number().int().min(1).max(45)).optional(),
      source: z.string().nullable().optional(),
      limit: z.number().int().min(1).max(50).optional(),
      offset: z.number().int().min(0).optional(),
    },
  },
  async (args) => toolResult(corpus.wdlSearchTerms(args)),
);

server.registerTool(
  "wdl_validate_terms",
  {
    title: "Validate WDL terms",
    description: "Validate proposed labels against WDL and return exact, close, wrong-class, or not-found status.",
    inputSchema: {
      items: z.array(
        z.object({
          class_number: z.number().int().min(1).max(45),
          term: z.string().min(1),
        }),
      ),
      fuzzy: z.boolean().optional(),
    },
  },
  async (args) => toolResult(corpus.wdlValidateTerms(args)),
);

server.registerTool(
  "swissreg_search_examples",
  {
    title: "Search Swissreg examples",
    description:
      "Search professional Swissreg goods/services examples from the partial local corpus. mandataire_groups is rejected because the source lacks row-level mapping.",
    inputSchema: {
      query: z.string().optional(),
      classes: z.array(z.number().int().min(1).max(45)).optional(),
      mandataire_groups: z.array(z.string()).optional(),
      limit: z.number().int().min(1).max(50).optional(),
      offset: z.number().int().min(0).optional(),
    },
  },
  async (args) => toolResult(corpus.swissregSearchExamples(args)),
);

server.registerTool(
  "swissreg_mandataire_metadata",
  {
    title: "Swissreg mandataire metadata",
    description: "Return available Swissreg mandataire filter metadata. This is not row-level goods/services filtering.",
    inputSchema: {
      mandataire_group: z.string().optional(),
      query: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
      offset: z.number().int().min(0).optional(),
    },
  },
  async (args) => toolResult(corpus.swissregMandataireMetadata(args)),
);

server.registerTool(
  "swissreg_class_combinations",
  {
    title: "Swissreg class combinations",
    description: "Group comparable Swissreg marks by Nice class combinations.",
    inputSchema: {
      query: z.string().optional(),
      classes_hint: z.array(z.number().int().min(1).max(45)).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
  },
  async (args) => toolResult(corpus.swissregClassCombinations(args)),
);

server.registerTool(
  "swissreg_mark_detail",
  {
    title: "Swissreg mark detail",
    description: "Return all local corpus goods/services rows for one Swissreg mark URN.",
    inputSchema: {
      urn: z.string().min(1),
    },
  },
  async (args) => toolResult(corpus.swissregMarkDetail(args)),
);

server.registerTool(
  "taf_search_precedents",
  {
    title: "Search TAF precedents",
    description: "Search segmented TAF/IGE absolute-ground precedent extracts.",
    inputSchema: {
      query: z.string().optional(),
      articles: z.array(z.string()).optional(),
      classes: z.array(z.number().int().min(1).max(45)).optional(),
      outcomes: z.array(z.string()).optional(),
      risk_tags: z.array(z.string()).optional(),
      limit: z.number().int().min(1).max(50).optional(),
      offset: z.number().int().min(0).optional(),
    },
  },
  async (args) => toolResult(corpus.tafSearchPrecedents(args)),
);

server.registerTool(
  "taf_get_entry",
  {
    title: "Get TAF entry",
    description: "Return one complete segmented TAF entry.",
    inputSchema: {
      entry_id: z.string().min(1),
    },
  },
  async (args) => toolResult(corpus.tafGetEntry(args)),
);

server.registerTool(
  "corpus_stats",
  {
    title: "Corpus stats",
    description: "Return local corpus counts, source dates, and ingestion warnings.",
    inputSchema: {},
  },
  async () => toolResult(corpus.corpusStats()),
);

server.registerTool(
  "filing_requirements_snapshot",
  {
    title: "Filing requirements snapshot",
    description: "Return current stored IPI/WIPO filing facts, official links, and a fee estimate. Must be verified at filing time.",
    inputSchema: {
      classes_count: z.number().int().min(1).max(45).optional(),
      electronic: z.boolean().optional(),
      expedited: z.boolean().optional(),
    },
  },
  async (args) => toolResult(corpus.filingRequirementsSnapshot(args)),
);

server.registerTool(
  "clearance_search_plan",
  {
    title: "Clearance search plan",
    description: "Generate a lawyer-oriented Swiss trademark clearance search plan across Swissreg, TMview, WIPO, Madrid, Zefix, and web/domain checks.",
    inputSchema: {
      sign: z.string().min(1),
      classes: z.array(z.number().int().min(1).max(45)).optional(),
      goods_services: z.array(z.string()).optional(),
      mark_type: z.string().optional(),
      territories: z.array(z.string()).optional(),
    },
  },
  async (args) => toolResult(corpus.clearanceSearchPlan(args)),
);

server.registerTool(
  "sign_risk_screen",
  {
    title: "Sign risk screen",
    description: "Screen a sign for obvious Swiss absolute-ground issues such as descriptiveness, Swissness, public signs, shapes, colours, and slogans.",
    inputSchema: {
      sign: z.string().min(1),
      classes: z.array(z.number().int().min(1).max(45)).optional(),
      goods_services: z.array(z.string()).optional(),
      mark_type: z.string().optional(),
    },
  },
  async (args) => toolResult(corpus.signRiskScreen(args)),
);

server.registerTool(
  "filing_intake_check",
  {
    title: "Filing intake check",
    description: "Validate whether the information needed for a Swiss trademark filing memo is present and flag official-language or representation gaps.",
    inputSchema: {
      applicant: z
        .object({
          name: z.string().optional(),
          domicile_country: z.string().optional(),
          representative_in_ch: z.boolean().optional(),
        })
        .optional(),
      sign: z
        .object({
          text: z.string().optional(),
          type: z.string().optional(),
          representation_provided: z.boolean().optional(),
          color_claim: z.string().nullable().optional(),
        })
        .optional(),
      goods_services: z
        .array(
          z.object({
            class_number: z.number().int().min(1).max(45),
            terms: z.array(z.string().min(1)),
            language: z.string().optional(),
          }),
        )
        .optional(),
      priority_claim: z
        .object({
          claimed: z.boolean().optional(),
          details: z.string().optional(),
        })
        .optional(),
      planned_use: z.string().optional(),
      territories: z.array(z.string()).optional(),
      risk_tolerance: z.string().optional(),
    },
  },
  async (args) => toolResult(corpus.filingIntakeCheck(args)),
);

server.registerResource(
  "nice-headings",
  "nice://headings",
  {
    title: "Nice headings",
    description: "All 45 Nice class headings.",
    mimeType: "application/json",
  },
  async (uri) => resourceResult(uri, corpus.niceGetHeadings()),
);

server.registerResource(
  "nice-heading",
  new ResourceTemplate("nice://heading/{class_number}", {
    list: async () => ({
      resources: corpus.niceGetHeadings().headings.map((heading) => ({
        uri: `nice://heading/${heading.class_number}`,
        name: `Nice class ${heading.class_number}`,
        mimeType: "application/json",
      })),
    }),
    complete: {
      class_number: (value) =>
        Array.from({ length: 45 }, (_, index) => String(index + 1)).filter((classNumber) => classNumber.startsWith(value)),
    },
  }),
  {
    title: "Nice heading by class",
    description: "One Nice heading selected by class number.",
    mimeType: "application/json",
  },
  async (uri, variables) => {
    const raw = Array.isArray(variables.class_number) ? variables.class_number[0] : variables.class_number;
    const classNumber = Number(raw);
    return resourceResult(uri, corpus.niceGetHeadings({ classes: [classNumber] }));
  },
);

server.registerResource(
  "corpus-stats",
  "corpus://stats",
  {
    title: "Corpus stats",
    description: "Counts and source warnings for local corpora.",
    mimeType: "application/json",
  },
  async (uri) => resourceResult(uri, corpus.corpusStats()),
);

server.registerResource(
  "source-manifest",
  "source://manifest",
  {
    title: "Source manifest",
    description: "Source hashes, dates, counts, and ingestion warnings.",
    mimeType: "application/json",
  },
  async (uri) => resourceResult(uri, corpus.manifest()),
);

process.on("SIGINT", () => {
  corpus.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  corpus.close();
  process.exit(0);
});

const transport = new StdioServerTransport();
await server.connect(transport);
