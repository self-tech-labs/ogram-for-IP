#!/usr/bin/env node
import { z } from "zod";
import {
  goodsServicesTextListSchema,
  identifierSchema,
  limit50Schema,
  niceClassSchema,
  niceClassesSchema,
  offsetSchema,
  querySchema,
  shortTextListSchema,
  shortTextSchema,
  territoriesSchema,
} from "./mcp-schemas.js";
import { READ_ONLY_TOOL_ANNOTATIONS, runCorpusServer, toolResult } from "./mcp-shared.js";

await runCorpusServer("swissreg-corpus", (server, corpus) => {
  server.registerTool(
    "search_swissreg_terms",
    {
      title: "Search Swissreg terms",
      description: "Search professional Swissreg goods/services examples. Mandataire is reported as unavailable unless row-level metadata exists.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        query: querySchema.optional(),
        nice_class: niceClassSchema.optional(),
        mandataire: shortTextSchema.optional(),
        limit: limit50Schema.optional(),
        offset: offsetSchema.optional(),
      },
    },
    async (args) =>
      toolResult(
        corpus.searchSwissregTerms({
          query: args.query,
          nice_class: args.nice_class,
          mandataire: args.mandataire,
          limit: args.limit,
          offset: args.offset,
        }),
      ),
  );

  server.registerTool(
    "get_class_combinations",
    {
      title: "Get class combinations",
      description: "Return Swissreg marks whose class sets exactly or partly cover the requested classes.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        nice_classes: niceClassesSchema.min(1),
        mode: z.enum(["superset", "exact"]).optional(),
        limit: limit50Schema.optional(),
      },
    },
    async (args) => toolResult(corpus.getSwissregClassCombinations(args)),
  );

  server.registerTool(
    "get_sector_benchmark",
    {
      title: "Get sector benchmark",
      description: "Return class-level Swissreg statistics: mark count, average granularity, and frequent terms.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        nice_class: niceClassSchema,
        limit: limit50Schema.optional(),
      },
    },
    async (args) => toolResult(corpus.getSwissregSectorBenchmark(args)),
  );

  server.registerTool(
    "list_mandataires",
    {
      title: "List mandataires",
      description: "List mandataire groups available as Swissreg filter metadata.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {},
    },
    async () => toolResult(corpus.listSwissregMandataires()),
  );

  server.registerTool(
    "swissreg_search_examples",
    {
      title: "Search Swissreg examples",
      description: "Compatibility alias for professional Swissreg goods/services examples.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        query: querySchema.optional(),
        classes: niceClassesSchema.optional(),
        mandataire_groups: shortTextListSchema.optional(),
        limit: limit50Schema.optional(),
        offset: offsetSchema.optional(),
      },
    },
    async (args) => toolResult(corpus.swissregSearchExamples(args)),
  );

  server.registerTool(
    "swissreg_class_combinations",
    {
      title: "Swissreg class combinations",
      description: "Compatibility alias: group comparable Swissreg marks by Nice class combinations.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        query: querySchema.optional(),
        classes_hint: niceClassesSchema.optional(),
        limit: limit50Schema.optional(),
      },
    },
    async (args) => toolResult(corpus.swissregClassCombinations(args)),
  );

  server.registerTool(
    "swissreg_mark_detail",
    {
      title: "Swissreg mark detail",
      description: "Return all local corpus goods/services rows for one Swissreg mark URN.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        urn: identifierSchema,
      },
    },
    async (args) => toolResult(corpus.swissregMarkDetail(args)),
  );

  server.registerTool(
    "swissreg_mandataire_metadata",
    {
      title: "Swissreg mandataire metadata",
      description: "Return available Swissreg mandataire filter metadata. This is not row-level goods/services filtering.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        mandataire_group: shortTextSchema.optional(),
        query: querySchema.optional(),
        limit: limit50Schema.optional(),
        offset: offsetSchema.optional(),
      },
    },
    async (args) => toolResult(corpus.swissregMandataireMetadata(args)),
  );

  server.registerTool(
    "clearance_search_plan",
    {
      title: "Clearance search plan",
      description: "Generate a Swiss trademark clearance search plan across live-search sources.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        sign: identifierSchema,
        classes: niceClassesSchema.optional(),
        goods_services: goodsServicesTextListSchema.optional(),
        mark_type: shortTextSchema.optional(),
        territories: territoriesSchema.optional(),
      },
    },
    async (args) => toolResult(corpus.clearanceSearchPlan(args)),
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
});
