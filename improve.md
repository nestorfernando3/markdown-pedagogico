# autoimprove: markdown-parser-medium-docs

## Change
scope: src/utils/markdownParser.ts src/utils/markdownDiagnostics.ts src/utils/pedagogicalRules.ts
exclude: src/utils/__tests__/** scripts/** src/components/** src/hooks/** src-tauri/** **/* 2.*

## Check
test: npx vitest run src/utils/__tests__/markdownParser.test.ts src/utils/__tests__/markdownParser.performance.test.ts
test-files: src/utils/__tests__/markdownParser.test.ts src/utils/__tests__/markdownParser.performance.test.ts src/utils/__tests__/markdownParser.autoimprove.test.ts src/test/fixtures/mediumMarkdown.ts
run: npx vitest run src/utils/__tests__/markdownParser.autoimprove.test.ts --reporter=verbose
score: SCORE: ([\\d.]+)
goal: lower
guard: MEAN: ([\\d.]+) < 350
keep_if_equal: true
timeout: 3m

## Stop
budget: 2h
rounds: 20
stale: 6
target: 25

## Instructions

Reduce parse time for medium markdown documents without changing parser behavior, HTML output contracts, or pedagogical warning semantics.

Prefer low-risk hot-path improvements such as:
- avoiding repeated work inside parseMarkdown
- caching reusable configuration or processor setup when safe
- reducing unnecessary tree traversals and object churn
- keeping sanitization, KaTeX, TOC, and alert handling behavior intact

Do not modify:
- test fixtures or benchmark extraction
- UI components, hooks, Tauri code, or export flows
- scratch files with " 2." in the filename

Any kept change must continue to pass the parser correctness suite and the existing p95 threshold test.
