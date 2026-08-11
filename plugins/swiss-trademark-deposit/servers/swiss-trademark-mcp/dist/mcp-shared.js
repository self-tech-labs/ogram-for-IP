import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SwissTrademarkCorpus } from "./db.js";
export const READ_ONLY_TOOL_ANNOTATIONS = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
};
export function toolResult(payload) {
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(payload, null, 2),
            },
        ],
    };
}
export function resourceResult(uri, payload) {
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
export async function runCorpusServer(name, register) {
    const corpus = new SwissTrademarkCorpus();
    const server = new McpServer({
        name,
        version: "0.2.0",
    });
    register(server, corpus);
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
}
