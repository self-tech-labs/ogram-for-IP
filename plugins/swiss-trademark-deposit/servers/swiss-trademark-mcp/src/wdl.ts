#!/usr/bin/env node
import { z } from "zod";
import { runCorpusServer, toolResult } from "./mcp-shared.js";

await runCorpusServer("wdl", (server, corpus) => {
  server.registerTool(
    "search_wdl",
    {
      title: "Search WDL",
      description: "Search IPI WDL goods/services terms by text and optional Nice class.",
      inputSchema: {
        query: z.string().optional(),
        class_number: z.number().int().min(1).max(45).optional(),
        limit: z.number().int().min(1).max(50).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    async (args) =>
      toolResult(
        corpus.wdlSearchTerms({
          query: args.query,
          classes: args.class_number ? [args.class_number] : undefined,
          limit: args.limit,
          offset: args.offset,
        }),
      ),
  );

  server.registerTool(
    "get_wdl_terms_by_class",
    {
      title: "Get WDL terms by class",
      description: "Return WDL terms for one class. Results are paginated to keep MCP output bounded.",
      inputSchema: {
        class_number: z.number().int().min(1).max(45),
        limit: z.number().int().min(1).max(500).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    async (args) => toolResult(corpus.wdlTermsByClass(args)),
  );

  server.registerTool(
    "validate_term",
    {
      title: "Validate WDL term",
      description: "Validate one proposed term against WDL for a Nice class.",
      inputSchema: {
        terme: z.string().min(1),
        class_number: z.number().int().min(1).max(45),
        fuzzy: z.boolean().optional(),
      },
    },
    async (args) =>
      toolResult(
        corpus.validateWdlTerm({
          term: args.terme,
          class_number: args.class_number,
          fuzzy: args.fuzzy,
        }),
      ),
  );

  server.registerTool(
    "wdl_search_terms",
    {
      title: "Search WDL terms",
      description: "Compatibility alias for search_wdl with multi-class filtering.",
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
      description: "Compatibility alias for validating multiple proposed terms.",
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
    "corpus_stats",
    {
      title: "Corpus stats",
      description: "Return local corpus counts, source dates, and ingestion warnings.",
      inputSchema: {},
    },
    async () => toolResult(corpus.corpusStats()),
  );
});
