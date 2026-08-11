# Host support

This matrix distinguishes what the repository ships from what a host may theoretically support. It is not a compatibility certification; every release must be validated and smoke-tested on the host versions it claims.

| Host surface | Repository delivery | Components exposed | Current status |
| --- | --- | --- | --- |
| Codex desktop plugin | Repository marketplace plus `.codex-plugin/plugin.json` | Skill and four local MCP servers | Targeted; validate before release |
| Claude Code | Claude marketplace plus `.claude-plugin/plugin.json` | Skill, four Claude commands, and four local MCP servers | Targeted; validate before release |
| Claude Cowork | Packaged `.plugin` archive | Plugin components supported by the installed Cowork version | Targeted; upload-test the release archive |
| Claude Desktop Chat local extension | MCPB package | Not applicable | Not shipped |

## Component differences

- `skills/swiss-trademark-deposit/` is the shared workflow for Codex and Claude plugin hosts.
- `commands/` contains Claude-specific slash-command wrappers. Their presence must not be documented as equivalent Codex slash commands.
- The Codex and Claude manifests each declare the same four stdio MCP services using their host's path conventions.
- A `.plugin` archive is not an MCPB. The repository does not currently provide one-click installation as a Claude Desktop Chat local extension.

## Runtime requirements

- Node.js 22 through 25 and npm 10 or newer are declared by the MCP package.
- The SQLite corpora are local and MCP queries do not require a remote corpus service.
- A package without bundled `node_modules` can require npm network access on first run. Do not describe that installation path as fully offline.
- A standalone package can include production dependencies, at the cost of a substantially larger archive and platform-sensitive native modules.

## Release validation

Before asserting support for a host:

1. Run that host's current manifest or marketplace validator.
2. Install from the exact release artifact or marketplace path users will receive.
3. Confirm the skill is discoverable and each expected command appears only where supported.
4. Initialize all four MCP servers and call at least one representative tool on each.
5. Repeat in a clean environment without the repository's development `node_modules`.
6. Record the host and runtime versions used in the release notes.

Do not infer ordinary Claude Desktop Chat support from successful Claude Code or Cowork testing. If MCPB support is added later, document and test it as a separate artifact and installation path.
