# AGENTS.md

## Project Snapshot
Topo is local-first clone of whisprflow, a voice-based workflow automation tool. It allows users to create and manage voice-based workflows on their local machines, providing a seamless experience for automating tasks using voice commands.

## Task Completion Requirements

- `pnpm run check` (consists of `pnpm run typecheck`, `pnpm run fmt` and `pnpm run lint`) must pass before considering tasks completed.

## Commit message style

You MUST use conventional commits specification for commit message and body - https://www.conventionalcommits.org/en/v1.0.0/#specification


## Maintainability

Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.

## Core Priorities

1. Performance first.
2. Reliability first.
3. Typesafety is a MUST.
4. Code should be readable.
If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Reference repos
- https://github.com/pingdotgg/t3code - an example of Electron application with Effect TS, a great source of inspiration for architecture and code style.
- https://github.com/cjpais/Handy - main reference for local-first transcriptions.
Use these as implementation references when designing protocol handling, UX flows, and operational safeguards.

These reference projects are available in `./local/` directory of this repo. If it's not there, you can clone it with depth 1.
