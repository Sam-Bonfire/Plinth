# PlinthOS Agent & Contributor Guidelines

This document serves as the operational guide and source of truth for software engineers and AI agents working on **PlinthOS**.

---

## 1. Branch Naming Conventions

- **Primary Working Branch**: `dev` (all feature branches and PRs target `dev`).
- **Stable Release Branch**: `main` (reserved strictly for stable release code).
- **Branch Naming Pattern**: `<type>/<short-kebab-description>`
  - Examples: `feat/order-domain`, `fix/kds-sync`, `chore/ci-pipeline`.
  - Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.

---

## 2. Commit Message Structure

Commit messages must follow the standard Conventional Commits structure with mandatory detailed bodies and an optional `For:` task identifier.

```text
<type>(<scope>): <short summary in imperative present tense (50 chars max)>

<detailed description explaining 'why' the change was made, 'what' was altered, and any relevant trade-offs or background context>

For: <task description or task issue identifier>
```

### Examples

```text
feat(ordering): implement order aggregate state transition invariants

Added validation rules to ensure total seat check sums match total order total using rust_decimal.

For: task-102
```

---

## 3. Code Quality & Safety Mandates

### A. Rust Safety Standards
- **Zero Unsafe Code**: All Rust crates MUST include `#![deny(unsafe_code)]` at their root file (`lib.rs` / `main.rs`). `unsafe` blocks are strictly forbidden.
- **Financial Precision**: All monetary/financial calculations MUST use `rust_decimal::Decimal` (IEEE-754 floating point arithmetic is strictly prohibited).
- **Hexagonal Core**: Pure domain logic lives in `packages/core-domain` with zero infrastructure or async runtime dependencies.

### B. TypeScript Quality Standards
- **Strict Typing**: TypeScript `strict` mode (`strict: true`, `noImplicitAny: true`) is enforced across all JS/TS projects.
- **No Explicit Any**: Using `any` type is strictly forbidden. ESLint enforces `@typescript-eslint/no-explicit-any: error`.
- **Framework Choice**: Apps use React + TypeScript + Vite (target Cloudflare Pages / Workers), avoiding Vercel-specific frameworks like Next.js.

---

## 4. Environment & Task Workflow

- **Initialization**: Run `pnpm run init` (or `mise run init`) to configure git hooks (`.githooks`) and install monorepo dependencies.
- **Linting**:
  - Rust: `cargo clippy --workspace --all-targets -- -D warnings`
  - TS/JS: `pnpm -r lint`
- **Testing**:
  - Rust: `cargo test --workspace`
  - TS/JS: `pnpm -r test`
