# Swiss Trademark Deposit website

`public/` is the public information and setup page for the ChatGPT plugin. Vercel serves it at `https://trademarks.ogram.swiss/` and forwards `/mcp` to the existing Cloudflare Worker through `vercel.json`.

The site is deployed from this directory in the Vercel project `trademarks-ogram-swiss`. DNS for `trademarks.ogram.swiss` is managed at Infomaniak. The `.well-known/openai-apps-challenge` file verifies the branded domain in the OpenAI plugin portal; keep it when redeploying.

The install button opens the published `0.3.0` plugin (`asdk_app_6ab4d705c86081a4ab5e7d5886adc6cd`) at `https://chatgpt.com/plugins/plugin_asdk_app_6ab4d705c86081a4ab5e7d5886adc6cd?open_in_app`. It uses `https://trademarks.ogram.swiss/mcp` as its MCP URL. OpenAI required a new plugin listing because the MCP server origin changed from `workers.dev` to `trademarks.ogram.swiss`. `public/setup.js` reads the primary link in `public/index.html` for the copied prompt; update that link if the public listing changes again.

The Worker still runs behind its `workers.dev` origin. Its MCP initialization source notice points to `https://trademarks.ogram.swiss/sources`. Legacy `/privacy` and `/terms` URLs redirect to this site's current policies, so the existing published plugin listing also reaches them. These Worker changes were made in Cloudflare Quick Edit, most recently deployment `bc882367` on 24 September 2026. Preserve them if the Worker is rebuilt or redeployed from another source.
