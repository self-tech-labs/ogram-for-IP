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
} from "./mcp-schemas.js";
import { READ_ONLY_TOOL_ANNOTATIONS, runCorpusServer, toolResult } from "./mcp-shared.js";

await runCorpusServer("taf-decisions", (server, corpus) => {
  server.registerTool(
    "search_taf_decisions",
    {
      title: "Search TAF decisions",
      description: "Search TAF/IGE absolute-ground precedent extracts.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        query: querySchema.optional(),
        nice_class: niceClassSchema.optional(),
        article_lpm: shortTextSchema.optional(),
        outcome: shortTextSchema.optional(),
        limit: limit50Schema.optional(),
        offset: offsetSchema.optional(),
      },
    },
    async (args) =>
      toolResult(
        corpus.tafSearchPrecedents({
          query: args.query,
          classes: args.nice_class ? [args.nice_class] : undefined,
          articles: args.article_lpm ? [args.article_lpm] : undefined,
          outcomes: args.outcome ? [args.outcome] : undefined,
          limit: args.limit,
          offset: args.offset,
        }),
      ),
  );

  server.registerTool(
    "get_taf_decision",
    {
      title: "Get TAF decision",
      description: "Return a TAF entry by TAF reference, for example B-3601/2014.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        reference: identifierSchema,
      },
    },
    async (args) => toolResult(corpus.tafGetDecision({ reference: args.reference })),
  );

  server.registerTool(
    "find_similar_signs",
    {
      title: "Find similar signs",
      description: "Find TAF entries with comparable sign wording or sign structure using local lexical/fuzzy matching.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        sign: identifierSchema,
        sign_type: z.enum(["verbal", "figurative", "combined"]).optional(),
        nice_classes: niceClassesSchema.optional(),
        limit: limit50Schema.optional(),
      },
    },
    async (args) => toolResult(corpus.findSimilarTafSigns(args)),
  );

  server.registerTool(
    "taf_search_precedents",
    {
      title: "Search TAF precedents",
      description: "Compatibility alias for searching segmented TAF/IGE absolute-ground precedent extracts.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        query: querySchema.optional(),
        articles: shortTextListSchema.optional(),
        classes: niceClassesSchema.optional(),
        outcomes: shortTextListSchema.optional(),
        risk_tags: shortTextListSchema.optional(),
        limit: limit50Schema.optional(),
        offset: offsetSchema.optional(),
      },
    },
    async (args) => toolResult(corpus.tafSearchPrecedents(args)),
  );

  server.registerTool(
    "taf_get_entry",
    {
      title: "Get TAF entry",
      description: "Compatibility alias: return one complete segmented TAF entry by internal entry id.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        entry_id: identifierSchema,
      },
    },
    async (args) => toolResult(corpus.tafGetEntry(args)),
  );

  server.registerTool(
    "sign_risk_screen",
    {
      title: "Sign risk screen",
      description: "Screen a sign for obvious Swiss absolute-ground issues before precedent search.",
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      inputSchema: {
        sign: identifierSchema,
        classes: niceClassesSchema.optional(),
        goods_services: goodsServicesTextListSchema.optional(),
        mark_type: shortTextSchema.optional(),
      },
    },
    async (args) => toolResult(corpus.signRiskScreen(args)),
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
