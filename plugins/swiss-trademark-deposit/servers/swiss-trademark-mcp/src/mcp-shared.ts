import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SwissTrademarkCorpus } from "./db.js";

export function toolResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function resourceResult(uri: URL | string, payload: unknown) {
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

export async function runCorpusServer(
  name: string,
  register: (server: McpServer, corpus: SwissTrademarkCorpus) => void,
): Promise<void> {
  const corpus = new SwissTrademarkCorpus();
  const server = new McpServer({
    name,
    version: "0.1.0",
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
