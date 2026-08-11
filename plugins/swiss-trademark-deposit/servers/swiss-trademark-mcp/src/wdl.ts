#!/usr/bin/env node
import { z } from "zod";
import { identifierSchema, limit50Schema, limit500Schema, niceClassSchema, niceClassesSchema, offsetSchema, querySchema, termSchema } from "./mcp-schemas.js";
import { READ_ONLY_TOOL_ANNOTATIONS, runCorpusServer, toolResult } from "./mcp-shared.js";

await runCorpusServer("wdl", (server, corpus) => {
  server.registerTool(
    "search_wdl",
    {
      title: "Search WDL",
      description: "Search IPI WDL goods/services terms by text and optional Nice class.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        query: querySchema.optional(),
        class_number: niceClassSchema.optional(),
        limit: limit50Schema.optional(),
        offset: offsetSchema.optional(),
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
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        class_number: niceClassSchema,
        limit: limit500Schema.optional(),
        offset: offsetSchema.optional(),
      },
    },
    async (args) => toolResult(corpus.wdlTermsByClass(args)),
  );

  server.registerTool(
    "validate_term",
    {
      title: "Validate WDL term",
      description: "Validate one proposed term against WDL for a Nice class.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        terme: termSchema,
        class_number: niceClassSchema,
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
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        query: querySchema.optional(),
        classes: niceClassesSchema.optional(),
        source: identifierSchema.nullable().optional(),
        limit: limit50Schema.optional(),
        offset: offsetSchema.optional(),
      },
    },
    async (args) => toolResult(corpus.wdlSearchTerms(args)),
  );

  server.registerTool(
    "wdl_validate_terms",
    {
      title: "Validate WDL terms",
      description: "Compatibility alias for validating multiple proposed terms.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        items: z
          .array(
            z.object({
              class_number: niceClassSchema,
              term: termSchema,
            }),
          )
          .min(1)
          .max(100),
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
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {},
    },
    async () => toolResult(corpus.corpusStats()),
  );
});
