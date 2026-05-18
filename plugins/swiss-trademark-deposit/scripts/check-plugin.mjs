import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const pluginRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(pluginRoot, "../..");

const requiredFiles = [
  ".codex-plugin/plugin.json",
  ".claude-plugin/plugin.json",
  ".mcp.json",
  "manifest.json",
  "README.md",
  "INSTALL.md",
  "PLAN.md",
  "skills/swiss-trademark-deposit/SKILL.md",
  "commands/depot-marque.md",
  "commands/analyse-signe.md",
  "commands/rediger-libelles.md",
  "commands/recherche-anteriorite.md",
  "scripts/run-mcp-server.mjs",
  "scripts/package-plugin.mjs",
  "servers/swiss-trademark-mcp/data/trademark.sqlite",
  "servers/swiss-trademark-mcp/data/source-manifest.json",
];

for (const file of requiredFiles) {
  const path = resolve(pluginRoot, file);
  if (!existsSync(path)) throw new Error(`Missing required plugin file: ${file}`);
}

const mcpConfig = JSON.parse(readFileSync(resolve(pluginRoot, ".mcp.json"), "utf8"));
const expectedServers = ["nice-headings", "wdl", "swissreg-corpus", "taf-decisions"];
const configuredServers = Object.keys(mcpConfig.mcpServers ?? {}).sort();
if (configuredServers.join(",") !== expectedServers.slice().sort().join(",")) {
  throw new Error(`.mcp.json must expose exactly these MCP servers: ${expectedServers.join(", ")}`);
}
for (const serverName of expectedServers) {
  const server = mcpConfig.mcpServers[serverName];
  const args = server.args.join(" ");
  if (!args.includes("${CLAUDE_PLUGIN_ROOT}")) {
    throw new Error(`.mcp.json server ${serverName} must use plugin-root variables instead of absolute paths`);
  }
  const wrapper = server.args[0].replace("${CLAUDE_PLUGIN_ROOT}/", "");
  if (wrapper !== "scripts/run-mcp-server.mjs") {
    throw new Error(`.mcp.json server ${serverName} must start through scripts/run-mcp-server.mjs`);
  }
  if (server.args[1] !== serverName) {
    throw new Error(`.mcp.json server ${serverName} must pass its server name to the runtime wrapper`);
  }
  if (!existsSync(resolve(pluginRoot, wrapper))) {
    throw new Error(`.mcp.json server ${serverName} points to a missing runtime wrapper: ${wrapper}`);
  }
  if (!String(server.env?.SWISS_TRADEMARK_DB ?? "").includes("${CLAUDE_PLUGIN_ROOT}")) {
    throw new Error(`.mcp.json server ${serverName} must use plugin-root variables for SWISS_TRADEMARK_DB`);
  }
}

const marketplacePath = resolve(repoRoot, ".agents/plugins/marketplace.json");
if (existsSync(marketplacePath)) {
  const marketplace = JSON.parse(readFileSync(marketplacePath, "utf8"));
  const entry = marketplace.plugins.find((plugin) => plugin.name === "swiss-trademark-deposit");
  if (!entry) throw new Error("Marketplace entry not found");
  if (entry.source.path !== "./plugins/swiss-trademark-deposit") throw new Error("Marketplace source path is incorrect");
  if (!entry.policy?.installation || !entry.policy?.authentication || !entry.category) {
    throw new Error("Marketplace entry must include installation policy, authentication policy, and category");
  }
}

const claudeMarketplacePath = resolve(repoRoot, ".claude-plugin/marketplace.json");
if (existsSync(claudeMarketplacePath)) {
  const marketplace = JSON.parse(readFileSync(claudeMarketplacePath, "utf8"));
  if (marketplace.name !== "ogram-for-ip") throw new Error("Claude marketplace name must be ogram-for-ip");
  if (!marketplace.owner?.name) throw new Error("Claude marketplace must declare an owner name");
  const entry = marketplace.plugins?.find((plugin) => plugin.name === "swiss-trademark-deposit");
  if (!entry) throw new Error("Claude marketplace entry not found");
  if (entry.source !== "./plugins/swiss-trademark-deposit") {
    throw new Error("Claude marketplace source must point to ./plugins/swiss-trademark-deposit");
  }
  if (!entry.description || !entry.version || !entry.category) {
    throw new Error("Claude marketplace entry must include description, version, and category");
  }
}

console.log("Plugin smoke check passed");
