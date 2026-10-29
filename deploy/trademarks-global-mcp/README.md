# Swiss Trademark Deposit Global MCP endpoint

This separate Vercel project serves the Global-project OpenAI listing at
`https://mcp.trademarks.ogram.swiss/mcp`. It proxies the MCP and health paths
to the same Cloudflare Worker as the existing trademark site. The public
`.well-known/openai-apps-challenge` file is specific to the Global listing;
preserve it on redeploy. The original `trademarks.ogram.swiss` project and its
verification token remain independent.

DNS for `mcp.trademarks.ogram.swiss` is managed at Infomaniak. The public
plugin website, support and policy pages remain at `trademarks.ogram.swiss`.
