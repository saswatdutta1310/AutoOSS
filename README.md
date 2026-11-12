# AutoOSS

Autonomous AI agent designed to resolve GitHub issues, inspect repositories, test patches in sandboxes, and perform automated code fixes.

## Project Structure

```
AutoOSS/
├── src/
│   ├── cli.ts                # Main CLI entrypoint
│   ├── config.ts             # Runtime configuration loader
│   ├── events.ts             # Event bus and lifecycle hooks
│   ├── github/               # GitHub API & Git operations
│   │   ├── issueParser.ts
│   │   ├── octokit.ts
│   │   └── git.ts
│   ├── llm/                  # LLM integrations & rate limiting
│   │   ├── adapter.ts
│   │   ├── gemini.ts
│   │   ├── ollama.ts
│   │   └── rateLimiter.ts
│   ├── repo/                 # AST parsing, repo maps, file discovery
│   │   ├── treeSitter.ts
│   │   ├── repoMap.ts
│   │   └── fileSelector.ts
│   ├── editor/               # Patch application & syntax validation
│   │   ├── applyDiff.ts
│   │   └── syntaxCheck.ts
│   ├── sandbox/              # Docker runner & runtime environment detection
│   │   ├── docker.ts
│   │   └── detectProject.ts
│   ├── security/             # Security scanning & rules
│   │   └── semgrep.ts
│   ├── agent/                # LangGraph/State graph workflows
│   │   ├── state.ts
│   │   ├── graph.ts
│   │   └── nodes/
│   │       └── index.ts
│   └── ui/                   # Terminal/Ink UI components
│       ├── App.tsx
│       ├── PhaseTracker.tsx
│       └── DiffView.tsx
├── tests/                    # Test suites
├── benchmark/                # Evaluation benchmarks
│   ├── issues.json
│   └── results.md
├── .env.example
└── README.md
```

## Setup & Getting Started

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Configure credentials and keys inside `.env`.
3. Install dependencies and start development:
   ```bash
   npm install
   npm run build
   ```
