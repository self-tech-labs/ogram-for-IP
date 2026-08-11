# Skill evaluation cases

`cases.json` is the maintained behavioral regression set for the Swiss trade-mark skill. Each case records the minimum concepts a good answer must contain and claims it must not make.

These cases are intentionally source- and outcome-oriented. They can be run manually in Claude Desktop/Cowork and Codex, or adapted to an automated model-evaluation harness. Runtime tool contracts are tested separately under `servers/swiss-trademark-mcp/test/`.

When the legal workflow, sources, or tool names change, update these cases in the same pull request. A passing runtime test does not establish that a model answer is legally adequate.
