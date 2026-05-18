#!/usr/bin/env node
import { z } from "zod";
import { runCorpusServer, toolResult } from "./mcp-shared.js";

await runCorpusServer("swissreg-corpus", (server, corpus) => {
  server.registerTool(
    "search_swissreg_terms",
    {
      title: "Search Swissreg terms",
      description: "Search professional Swissreg goods/services examples. Mandataire is reported as unavailable unless row-level metadata exists.",
      inputSchema: {
        query: z.string().optional(),
        nice_class: z.number().int().min(1).max(45).optional(),
        mandataire: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
        offset: z.number().int().min(0).optional(),
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
      inputSchema: {
        nice_classes: z.array(z.number().int().min(1).max(45)).min(1),
        mode: z.enum(["superset", "exact"]).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async (args) => toolResult(corpus.getSwissregClassCombinations(args)),
  );

  server.registerTool(
    "get_sector_benchmark",
    {
      title: "Get sector benchmark",
      description: "Return class-level Swissreg statistics: mark count, average granularity, and frequent terms.",
      inputSchema: {
        nice_class: z.number().int().min(1).max(45),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async (args) => toolResult(corpus.getSwissregSectorBenchmark(args)),
  );

  server.registerTool(
    "list_mandataires",
    {
      title: "List mandataires",
      description: "List mandataire groups available as Swissreg filter metadata.",
      inputSchema: {},
    },
    async () => toolResult(corpus.listSwissregMandataires()),
  );

  server.registerTool(
    "swissreg_search_examples",
    {
      title: "Search Swissreg examples",
      description: "Compatibility alias for professional Swissreg goods/services examples.",
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
    "swissreg_class_combinations",
    {
      title: "Swissreg class combinations",
      description: "Compatibility alias: group comparable Swissreg marks by Nice class combinations.",
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
    "clearance_search_plan",
    {
      title: "Clearance search plan",
      description: "Generate a Swiss trademark clearance search plan across live-search sources.",
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
    "corpus_stats",
    {
      title: "Corpus stats",
      description: "Return local corpus counts, source dates, and ingestion warnings.",
      inputSchema: {},
    },
    async () => toolResult(corpus.corpusStats()),
  );
});
