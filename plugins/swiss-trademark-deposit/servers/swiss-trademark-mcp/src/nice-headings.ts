#!/usr/bin/env node
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  applicantSchema,
  goodsServicesEntriesSchema,
  niceClassSchema,
  niceClassesSchema,
  optionalShortTextSchema,
  priorityClaimSchema,
  signSchema,
  territoriesSchema,
} from "./mcp-schemas.js";
import { READ_ONLY_TOOL_ANNOTATIONS, resourceResult, runCorpusServer, toolResult } from "./mcp-shared.js";

await runCorpusServer("nice-headings", (server, corpus) => {
  server.registerTool(
    "get_nice_heading",
    {
      title: "Get Nice heading",
      description: "Return the official Nice heading for one class.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        class_number: niceClassSchema,
      },
    },
    async (args) => toolResult(corpus.getNiceHeading({ class_number: args.class_number })),
  );

  server.registerTool(
    "list_nice_headings",
    {
      title: "List Nice headings",
      description: "Return all 45 official Nice class headings.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {},
    },
    async () => toolResult(corpus.listNiceHeadings()),
  );

  server.registerTool(
    "nice_get_headings",
    {
      title: "Get Nice headings",
      description: "Compatibility alias: return official Nice headings for selected classes, or all 45.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        classes: niceClassesSchema.optional(),
      },
    },
    async (args) => toolResult(corpus.niceGetHeadings(args)),
  );

  server.registerTool(
    "filing_requirements_snapshot",
    {
      title: "Filing requirements snapshot",
      description: "Return stored IPI/WIPO filing facts, official links, and a fee estimate. Must be verified at filing time.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        classes_count: niceClassSchema.optional(),
        electronic: z.boolean().optional(),
        expedited: z.boolean().optional(),
      },
    },
    async (args) => toolResult(corpus.filingRequirementsSnapshot(args)),
  );

  server.registerTool(
    "filing_intake_check",
    {
      title: "Filing intake check",
      description: "Validate whether the information needed for a Swiss trademark filing memo is present.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        applicant: applicantSchema.optional(),
        sign: signSchema.optional(),
        goods_services: goodsServicesEntriesSchema.optional(),
        priority_claim: priorityClaimSchema.optional(),
        planned_use: optionalShortTextSchema.optional(),
        territories: territoriesSchema.optional(),
        risk_tolerance: optionalShortTextSchema.optional(),
      },
    },
    async (args) => toolResult(corpus.filingIntakeCheck(args)),
  );

  server.registerTool(
    "corpus_stats",
    {
      title: "Corpus stats",
      description: "Return local corpus counts, source dates, and ingestion warnings.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {},
    },
    async () => toolResult(corpus.corpusStats()),
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
});
