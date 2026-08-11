import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(import.meta.dirname, "..");
const pluginRoot = resolve(packageRoot, "../..");

const cases = [
  {
    server: "nice-headings",
    tool: "get_nice_heading",
    arguments: { class_number: 43 },
    verify: (payload: any) => expect(payload.heading.class_number).toBe(43),
  },
  {
    server: "wdl",
    tool: "search_wdl",
    arguments: { query: "traiteurs", class_number: 43, limit: 2 },
    verify: (payload: any) => expect(payload.results.length).toBeGreaterThan(0),
  },
  {
    server: "swissreg-corpus",
    tool: "search_swissreg_terms",
    arguments: { query: "Halbleiter", nice_class: 9, limit: 2 },
    verify: (payload: any) => {
      expect(payload.results.length).toBeGreaterThan(0);
      expect(payload.results[0].mark_id).toBeTruthy();
    },
  },
  {
    server: "taf-decisions",
    tool: "search_taf_decisions",
    arguments: { query: "capsule medicament", nice_class: 5, limit: 2 },
    verify: (payload: any) => expect(payload.results.length).toBeGreaterThan(0),
  },
] as const;

describe("MCP stdio protocol", () => {
  for (const testCase of cases) {
    it(
      `initializes ${testCase.server}, lists annotated tools, and calls ${testCase.tool}`,
      async () => {
        const transport = new StdioClientTransport({
          command: process.execPath,
          args: [resolve(pluginRoot, "scripts/run-mcp-server.mjs"), testCase.server],
          cwd: pluginRoot,
          stderr: "pipe",
        });
        const client = new Client({ name: "swiss-trademark-test-client", version: "0.2.0" });

        try {
          await client.connect(transport);
          const listed = await client.listTools();
          const tool = listed.tools.find((candidate) => candidate.name === testCase.tool);
          expect(tool).toBeDefined();
          for (const candidate of listed.tools) {
            expect(candidate.annotations).toMatchObject({
              readOnlyHint: true,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: false,
            });
          }

          const result = await client.callTool({ name: testCase.tool, arguments: testCase.arguments });
          expect(result.isError).not.toBe(true);
          const content = result.content as Array<{ type: string; text?: string }>;
          const first = content[0];
          expect(first?.type).toBe("text");
          if (!first || first.type !== "text" || typeof first.text !== "string") {
            throw new Error(`${testCase.tool} did not return text content.`);
          }
          testCase.verify(JSON.parse(first.text));
        } finally {
          await client.close();
        }
      },
      15_000,
    );
  }
});
