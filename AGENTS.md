# Project Rin — Agent Guidelines & Rules

## 1. Critical Rules & Guardrails

> [!CAUTION]
> **DO NOT PUSH TO REMOTE WITHOUT EXPLICIT INSTRUCTIONS.**
> Under no circumstances should an agent run `git push` to `origin` or any remote repository unless the user has explicitly and unambiguously requested to push in that turn. Preparing commits, switching branches, and running local verification is permitted, but remote pushes are strictly gated on explicit user permission.

---

## 2. Engineering Standards & Architecture

### Low-Level Design (LLD) & SOLID Principles
- **Single Responsibility Principle (SRP)**: Every class, service, or module must have one and only one reason to change. Decompose procedural entrypoints and god-functions into focused domain services.
- **Open/Closed Principle (OCP)**: Favor registries, factories, and strategies over switch/case conditional branching for polymorphic components (e.g. Actors, Solvers).
- **Liskov Substitution Principle (LSP)**: Ensure implementations adhere strictly to domain interfaces without requiring caller-side type assertions or instanceof checks.
- **Interface Segregation Principle (ISP)**: Keep interfaces minimal and purpose-built.
- **Dependency Inversion Principle (DIP)**: Depend on abstractions, not concretions. Inject dependencies via constructors or factories to guarantee testability without monkey-patching.

### Testing & Verification
- **Evidence Before Assertions**: Never claim code works without running verification commands.
- Run `pnpm test` and ensure all tests pass with zero regressions.
- Run `pnpm typecheck` and ensure zero TypeScript errors.
- Never write production code to satisfy a test; configure the test environment (`vitest.setup.ts`) to match the production runtime.

### Clean Code & YAGNI
- Avoid speculative engineering (e.g. checking for iframes or unreachable runtime states without empirical evidence).
- Avoid excessive tutorial-style comments in production code; write self-documenting code and use comments strictly to explain "why" a non-obvious decision was made.
- Do not use `declare const browser: any;`. Use WXT's native ambient `WxtBrowser` global types.
