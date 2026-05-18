#!/usr/bin/env node
import { z } from "zod";
import { runCorpusServer, toolResult } from "./mcp-shared.js";
await runCorpusServer("taf-decisions", (server, corpus) => {
    server.registerTool("search_taf_decisions", {
        title: "Search TAF decisions",
        description: "Search TAF/IGE absolute-ground precedent extracts.",
        inputSchema: {
            query: z.string().optional(),
            nice_class: z.number().int().min(1).max(45).optional(),
            article_lpm: z.string().optional(),
            outcome: z.string().optional(),
            limit: z.number().int().min(1).max(50).optional(),
            offset: z.number().int().min(0).optional(),
        },
    }, async (args) => toolResult(corpus.tafSearchPrecedents({
        query: args.query,
        classes: args.nice_class ? [args.nice_class] : undefined,
        articles: args.article_lpm ? [args.article_lpm] : undefined,
        outcomes: args.outcome ? [args.outcome] : undefined,
        limit: args.limit,
        offset: args.offset,
    })));
    server.registerTool("get_taf_decision", {
        title: "Get TAF decision",
        description: "Return a TAF entry by TAF reference, for example B-3601/2014.",
        inputSchema: {
            reference: z.string().min(1),
        },
    }, async (args) => toolResult(corpus.tafGetDecision({ reference: args.reference })));
    server.registerTool("find_similar_signs", {
        title: "Find similar signs",
        description: "Find TAF entries with comparable sign wording or sign structure using local lexical/fuzzy matching.",
        inputSchema: {
            sign: z.string().min(1),
            sign_type: z.enum(["verbal", "figurative", "combined"]).optional(),
            nice_classes: z.array(z.number().int().min(1).max(45)).optional(),
            limit: z.number().int().min(1).max(50).optional(),
        },
    }, async (args) => toolResult(corpus.findSimilarTafSigns(args)));
    server.registerTool("taf_search_precedents", {
        title: "Search TAF precedents",
        description: "Compatibility alias for searching segmented TAF/IGE absolute-ground precedent extracts.",
        inputSchema: {
            query: z.string().optional(),
            articles: z.array(z.string()).optional(),
            classes: z.array(z.number().int().min(1).max(45)).optional(),
            outcomes: z.array(z.string()).optional(),
            risk_tags: z.array(z.string()).optional(),
            limit: z.number().int().min(1).max(50).optional(),
            offset: z.number().int().min(0).optional(),
        },
    }, async (args) => toolResult(corpus.tafSearchPrecedents(args)));
    server.registerTool("taf_get_entry", {
        title: "Get TAF entry",
        description: "Compatibility alias: return one complete segmented TAF entry by internal entry id.",
        inputSchema: {
            entry_id: z.string().min(1),
        },
    }, async (args) => toolResult(corpus.tafGetEntry(args)));
    server.registerTool("sign_risk_screen", {
        title: "Sign risk screen",
        description: "Screen a sign for obvious Swiss absolute-ground issues before precedent search.",
        inputSchema: {
            sign: z.string().min(1),
            classes: z.array(z.number().int().min(1).max(45)).optional(),
            goods_services: z.array(z.string()).optional(),
            mark_type: z.string().optional(),
        },
    }, async (args) => toolResult(corpus.signRiskScreen(args)));
    server.registerTool("corpus_stats", {
        title: "Corpus stats",
        description: "Return local corpus counts, source dates, and ingestion warnings.",
        inputSchema: {},
    }, async () => toolResult(corpus.corpusStats()));
});
