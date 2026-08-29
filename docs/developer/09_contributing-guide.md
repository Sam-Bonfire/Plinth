# 09_contributing-guide.md - Contributor Guide for PlinthOS

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `AGENTS.md` (source of truth - branch naming, commit format, PR process)
- `01_env-setup.md` (environment init - prerequisite)
- `02_local-development.md` (running components locally)
- `03_testing-workflow.md` (testing patterns)
- `DEVELOPER-NAVIGATION.md` (master navigation)
- `.githooks/` (git hooks configuration)

---

## 9.1 Prerequisites for Contributing

Before making your first contribution, ensure you have completed the environment setup:

```bash
# 1. Trust and install toolchains
mise trust
pnpm install

# 2. Initialize git hooks (runs as part of `pnpm run init`)
pnpm run init

# 3. Verify your environment works
mise run test  # Full test suite - should pass
```

**New contributor onboarding checklist**:
- [ ] `mise trust` runs without errors
- [ ] `pnpm install` completes successfully
- [ ] `pnpm run init` configures git hooks (check `.githooks/` directory)
- [ ] `cargo check -p core-domain` compiles (verifies Rust toolchain)
- [ ] `pnpm -r test` passes (verifies TS toolchain)
- [ ] Familiarity with branch naming: `<type>/<short-kebab-description>`
- [ ] Understanding of Conventional Commits format

---

## 9.2 Branch Naming Conventions (per `AGENTS.md` Section 1)

All feature branches and PRs must target the `dev` branch (per `AGENTS.md` Section 1).

### 9.2.1 Naming Pattern

```
<type>/<short-kebab-description>
```

### 9.2.2 Allowed `type` Values

| Type | Purpose | Example |
|---|---|---|
| `feat` | New feature | `feat/ordering` |
| `fix` | Bug fix | `fix/kds-sync` |
| `docs` | Documentation changes | `docs/contributing-guide` |
| `style` | Formatting, no logic change | `style/indent-tabs` |
| `refactor` | Code restructure, no behavior change | `refactor/order-domain` |
| `perf` | Performance improvement | `perf/sync-loop` |
| `test` | Adding tests or test infrastructure | `test/e2e-checks` |
| `build` | Build system changes | `build/tauri-config` |
| `ci` | CI/CD configuration | `ci/github-actions` |
| `chore` | Routine maintenance, non-code changes | `chore/readme-update` |

### 9.2.2 Branch Examples

| Good Branch Name | Purpose |
|---|---|
| `feat/ordering` | New order feature |
| `fix/kds-sync` | KDS synchronization bug |
| `docs/contributing-guide` | Documentation updates |
| `style/prettier-config` | Formatting changes |
| `refactor/order-domain` | Order domain refactor |
| `perf/sync-loop` | Performance improvement |
| `test/e2e-tests` | New E2E test coverage |
| `build/tauri-v2` | Tauri version upgrade |
| `ci/cd-pipeline` | CI/CD configuration |
| `chore/readme-update` | README updates |

### 9.2.3 Branch Restrictions

- **DO NOT** target `main` branch directly from feature branches - PRs target `dev`
- **`main`** is reserved strictly for stable release code (per `AGENTS.md` Section 1)
- Branch names must match the `<type>/<short-kebab-description>` pattern
- No spaces in branch names - use hyphens
- Keep branch names descriptive but concise (max ~50 characters)

---

## 9.3 Commit Message Structure (per `AGENTS.md` Section 2)

All commit messages must follow **Conventional Commits** structure with mandatory detailed bodies and optional `For:` task identifier.

### 9.3.1 Format

```
<type>(<scope>): <short summary in imperative present tense (50 chars max)>

<detailed description explaining 'why' the change was made, 'what' was altered, and any relevant trade-offs or background context>

For: <task description or task issue identifier>
```

### 9.3.2 Examples

```text
feat(ordering): implement order aggregate state transition invariants

Added validation rules to ensure total seat check sums match total order total using rust_decimal.
This enforces that $\sum \text{(Seat Check Totals)} = \text{Order Total}$ at all state transitions.

For: task-102
```

```text
fix(kds-ticket): resolve state machine bypass allowing BUMPED before IN_PREP

The KitchenTicket aggregate root was not validating the PENDING → IN_PREP → READY → BUMPED 
transition order. Added invariant check in the aggregate root to reject any state change 
that skips IN_PREP stage, unless explicitly fast-tracked by an authorized role policy.

For: task-349
```

```text
docs(api-contracts): update Hurl test examples for new payment endpoint

Updated `/api/v1/orders` Hurl test to include `X-Store-Id` header and verified 
`jsonpath "$.data.sync_status" == "SETTLED"` assertion matches current API behavior.

For: task-551
```

```text
chore(cargo-workspace): reorganize workspace dependencies

Moved `rust_decimal` from per-crate dependencies to workspace-level in `Cargo.toml`. 
This ensures all crates use the same version and avoids subtle version mismatch issues.

For: task-77
```

### 9.3.3 Commit Message Do's and Don'ts

| Do | Don't |
|---|---|
| Use imperative present tense: "add item", not "added item" | "Added item to order" |
| Keep summary under 50 characters | Long subject lines without body |
| Include `For:` identifier when applicable | Omitting task context entirely |
| Reference related issues/PRs in body | No context why the change was made |
| Use Conventional Commits consistently | Mixed commit styles in same PR |
| Body can be multiple paragraphs | Body that's just one sentence (unless truly minimal) |

### 9.3.4 PR Title vs Commit Message

- **PR Title**: Shorter, more descriptive, often title-cased
  - Example: "feat: add order seat balance validation"
- **Commit Message**: Full conventional format with body
  - Example: Same as above, but with detailed body explaining invariants

---

## 9.4 Pull Request Process

### 9.4.1 PR Workflow

1. **Create feature branch** from `dev` (or latest `dev`):
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feat/your-feature-name
   ```

2. **Make changes** - follow all mandates (#![deny(unsafe_code)], rust_decimal, strict TS, etc.)

3. **Run local test suite**:
   ```bash
   mise run test  # Full suite
   # Or individually:
   mise run test:rust
   mise run test:ts
   mise run test:api
   ```

4. **Run clippy** (will fail on warnings/unsafe):
   ```bash
   cargo clippy --workspace --all-targets -- -D warnings
   ```

5. **Write Conventional Commit messages** for all changes

6. **Push branch and create PR**:
   ```bash
   git push origin feat/your-feature-name
   # Then create PR via GitHub/GitLab interface
   ```

7. **PR template** (automatically filled or guided):
   - Title follows conventional commits
   - Body describes what, why, and how
   - Checklist items completed
   - Related tasks/issue IDs in `For:` format

### 9.4.2 PR Review Checklist (for Reviewers)

| # | Check | Pass/Fail |
|---|---|---|
| 1 | Code compiles: `cargo check -p core-domain` | |
| 2 | Clippy passes: `cargo clippy --workspace --all-targets -- -D warnings` | |
| 3 | Rust tests pass: `cargo test --workspace` | |
| 4 | TS lint passes: `pnpm -r lint` | |
| 5 | TS tests pass: `pnpm -r test` | |
| 6 | API contract tests pass: `hurl --test tests/api/**/*.hurl` | |
| 7 | Conventional Commits format used | |
| 8 | Branch naming follows `<type>/<description>` | |
| 9 | No `#![unsafe_code]` violations | |
| 10 | No `rust_decimal` violations (financial precision) | |
| 11 | Documentation updated (if user-facing changes) | |
| 12 | Cross-reference docs updated (if architectural changes) | |

### 9.4.3 Merge Requirements

- **All checks must pass** (CI runs `mise run test` on PR)
- **Minimum 1 approving review** from team member
- **No required changes** from review comments
- **No merge conflicts** with `dev` branch
- **Branch can be deleted** after merge

### 9.4.4 Merge Types

- **Squash and merge**: Preferred for clean `dev` history
- **Rebase and merge**: Allowed if PR author maintains clean history
- **Create a merge commit**: Allowed but less preferred

---

## 9.5 Code of Conduct

All contributors must adhere to the **PlinthOS Code of Conduct**:

- **Be respectful**: Value different perspectives and experiences
- **Be constructive**: Focus on problems, not people
- **Assume positive intent**: Most mistakes are honest, not malicious
- **Use inclusive language**: No discriminatory jokes, slurs, or tropes
- **Accept criticism gracefully**: Code reviews are about code, not the author
- **Report issues**: If you witness or experience harassment, contact the maintainers

Violations may result in temporary or permanent ban from contributions.

---

## 9.6 Recognition & Rewards

Contributors who consistently submit high-quality PRs will be recognized in:
- `CLACKTOPS` (internal contributor leaderboard - if applicable)
- `RELEASE NOTES` (per-release contributor acknowledgment)
- `CONTRIBUTORS.md` (project root, auto-generated or manual)
- **Early access** to new features (for top contributors)

---

## 9.7 Next Steps After Reading

After reading this guide:

1. **Read** `AGENTS.md` Sections 1-4 for the source of truth governing all conventions
2. **Run** `pnpm run init` to configure git hooks
3. **Create a test branch** and practice the branch naming convention
4. **Write a small fix** and format commits using Conventional Commits
5. **Submit a PR** and go through the review checklist
6. **Read** `01_env-setup.md` and `02_local-development.md` if you need environment refresher

---

## 9.8 Version & Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | 2026-08-28 | Docs Team | Initial release - contributor guide |
| 0.1.1 | YYYY-MM-DD | TBD | Updates based on contributor feedback |
| 0.2.0 | YYYY-MM-DD | TBD | Major overhaul for new contribution policies |

---
*This file is part of the PlinthOS internal developer documentation set. See `AGENTS.md` for the source of truth, `01_env-setup.md` for environment initialization, and `02_local-development.md` for local development workflow.*