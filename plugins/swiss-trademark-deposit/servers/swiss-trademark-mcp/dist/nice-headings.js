#!/usr/bin/env node
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resourceResult, runCorpusServer, toolResult } from "./mcp-shared.js";
await runCorpusServer("nice-headings", (server, corpus) => {
    server.registerTool("get_nice_heading", {
        title: "Get Nice heading",
        description: "Return the official Nice heading for one class.",
        inputSchema: {
            class_number: z.number().int().min(1).max(45),
        },
    }, async (args) => toolResult(corpus.getNiceHeading({ class_number: args.class_number })));
    server.registerTool("list_nice_headings", {
        title: "List Nice headings",
        description: "Return all 45 official Nice class headings.",
        inputSchema: {},
    }, async () => toolResult(corpus.listNiceHeadings()));
    server.registerTool("nice_get_headings", {
        title: "Get Nice headings",
        description: "Compatibility alias: return official Nice headings for selected classes, or all 45.",
        inputSchema: {
            classes: z.array(z.number().int().min(1).max(45)).optional(),
        },
    }, async (args) => toolResult(corpus.niceGetHeadings(args)));
    server.registerTool("filing_requirements_snapshot", {
        title: "Filing requirements snapshot",
        description: "Return stored IPI/WIPO filing facts, official links, and a fee estimate. Must be verified at filing time.",
        inputSchema: {
            classes_count: z.number().int().min(1).max(45).optional(),
            electronic: z.boolean().optional(),
            expedited: z.boolean().optional(),
        },
    }, async (args) => toolResult(corpus.filingRequirementsSnapshot(args)));
    server.registerTool("filing_intake_check", {
        title: "Filing intake check",
        description: "Validate whether the information needed for a Swiss trademark filing memo is present.",
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
                .array(z.object({
                class_number: z.number().int().min(1).max(45),
                terms: z.array(z.string().min(1)),
                language: z.string().optional(),
            }))
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
    }, async (args) => toolResult(corpus.filingIntakeCheck(args)));
    server.registerTool("corpus_stats", {
        title: "Corpus stats",
        description: "Return local corpus counts, source dates, and ingestion warnings.",
        inputSchema: {},
    }, async () => toolResult(corpus.corpusStats()));
    server.registerResource("nice-headings", "nice://headings", {
        title: "Nice headings",
        description: "All 45 Nice class headings.",
        mimeType: "application/json",
    }, async (uri) => resourceResult(uri, corpus.niceGetHeadings()));
    server.registerResource("nice-heading", new ResourceTemplate("nice://heading/{class_number}", {
        list: async () => ({
            resources: corpus.niceGetHeadings().headings.map((heading) => ({
                uri: `nice://heading/${heading.class_number}`,
                name: `Nice class ${heading.class_number}`,
                mimeType: "application/json",
            })),
        }),
        complete: {
            class_number: (value) => Array.from({ length: 45 }, (_, index) => String(index + 1)).filter((classNumber) => classNumber.startsWith(value)),
        },
    }), {
        title: "Nice heading by class",
        description: "One Nice heading selected by class number.",
        mimeType: "application/json",
    }, async (uri, variables) => {
        const raw = Array.isArray(variables.class_number) ? variables.class_number[0] : variables.class_number;
        const classNumber = Number(raw);
        return resourceResult(uri, corpus.niceGetHeadings({ classes: [classNumber] }));
    });
    server.registerResource("corpus-stats", "corpus://stats", {
        title: "Corpus stats",
        description: "Counts and source warnings for local corpora.",
        mimeType: "application/json",
    }, async (uri) => resourceResult(uri, corpus.corpusStats()));
    server.registerResource("source-manifest", "source://manifest", {
        title: "Source manifest",
        description: "Source hashes, dates, counts, and ingestion warnings.",
        mimeType: "application/json",
    }, async (uri) => resourceResult(uri, corpus.manifest()));
});
