# Swiss Trademark Deposit website

`public/` is the public information and setup page for the ChatGPT plugin. Vercel serves it at `https://trademarks.ogram.swiss/` and forwards `/mcp` to the existing Cloudflare Worker through `vercel.json`.

The site is deployed from this directory in the Vercel project `trademarks-ogram-swiss`. DNS for `trademarks.ogram.swiss` is managed at Infomaniak. The `.well-known/openai-apps-challenge` file verifies the branded domain in the OpenAI plugin portal; keep it when redeploying.

The install button currently opens the published plugin (`asdk_app_6aa94b3c5bd081a4bbf7c8bf10af937a`). A new `0.3.0` plugin (`asdk_app_6ab4d705c86081a4ab5e7d5886adc6cd`) has been prepared with `https://trademarks.ogram.swiss/mcp` as its MCP URL. After OpenAI approves and the new plugin is published, change the primary link in `public/index.html` to its public listing. `public/setup.js` reads that same link for the copied prompt.

The Worker still runs behind its `workers.dev` origin. Its MCP initialization source notice was changed in Cloudflare Quick Edit to `https://trademarks.ogram.swiss/sources` in deployment `d2370371` on 24 September 2026. Preserve that notice if the Worker is rebuilt or redeployed from another source.
