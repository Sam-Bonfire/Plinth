# 10_commit-message-format.md - Conventional Commits Mastery for PlinthOS

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `09_contributing-guide.md` (branch naming, PR process - prerequisite)
- `AGENTS.md` (Section 2 - source of truth for commit format)
- `01_env-setup.md` (environment init)
- `DEVELOPER-NAVIGATION.md` (master navigation)

---

## 10.1 The Standard Format

Every commit message in the PlinthOS monorepo **MUST** follow the Conventional Commits format. This is strictly enforced via PR review and CI/CD checks (`.github/workflows/ci-dev.yml` runs commit message validation).

### 10.1.1 Mandatory Structure

```
<type>(<scope>): <short summary in imperative present tense (50 chars max)>

<detailed description explaining 'why' the change was made, 'what' was altered, and any relevant trade-offs or background context>

For: <task description or task issue identifier>
```

### 10.1.2 Component Breakdown

| Field | Format | Max Length | Required | Description |
|---|---|---|---|---|
| **`type`** | Lowercase keyword | - | Yes | Category of change (feat, fix, docs, style, refactor, perf, test, build, ci, chore) |
| **`(<scope>)`** | Parentheses-enclosed | - | Yes | Package/app scope affected (ordering, kds, inventory, billing, core-domain, edge-api, pos-client, web-dashboard, etc.) |
| **`: `** | Colon-space separator | - | Yes | Required delimiter between summary and body |
| **`short summary`** | Imperative present tense | 50 characters max | Yes | Brief description of what changed |
| **`<dbl-newline>`** | Blank line separator | - | Yes | Required before body starts |
| **`detailed description`** | Free text, multiple paragraphs | - | Yes | Explains 'why', 'what', trade-offs, background |
| **`For:`** | `For: task-xxx` | - | Optional | Task identifier or descriptive task text |

---

## 10.2 `type` Keywords (Allowed Values per `AGENTS.md`)

| Keyword | Purpose | When to Use |
|---|---|---|
| `feat` | New feature | Adding new capability, not just bug fix |
| `fix` | Bug fix | Correcting incorrect behavior |
| `docs` | Documentation only | Markdown, README, comments - no code change |
| `style` | Formatting, no logic change | Prettier, whitespace, formatting - no behavior change |
| `refactor` | Code restructure | Internal restructuring, no behavior change |
| `perf` | Performance improvement | Speed, memory, latency improvements |
| `test` | Adding tests | New test files, test infrastructure |
| `build` | Build system changes | Tauri config, Wrangler, CI pipelines |
| `ci` | CI/CD configuration | GitHub Actions, GitLab CI, deployment pipelines |
| `chore` | Routine maintenance | Dependency updates, housekeeping - no prod feature/bug |

### 10.2.1 Type Examples

```text
# feat - new feature
feat(ordering): implement order aggregate state transition invariants

# fix - bug correction
fix(kds-ticket): resolve state machine bypass allowing BUMPED before IN_PREP

# docs - documentation only
docs(api-contracts): update Hurl test examples for new endpoint

# style - formatting only
style/prettier-config: add prettier config to new packages

# refactor - restructure
refactor(order-domain): extract order validation into service trait

# perf - performance
perf/sync-loop: reduce durable object flush frequency from 2s to 5s

# test - test coverage
test/e2e-type-safety: add e2e tests for order-payment-flow

# build - build system
build/tauri-v2: upgrade tauri dependency from 1.0 to 2.0

# ci - CI/CD
ci/github-actions: add workflow for auto-tagging releases

# chore - maintenance
chore/readme-update: update contributing guide with new branch naming
```

---

## 10.3 `scope` Field Guidelines

The **scope** should be a short descriptor of the package/application/area affected. Use one of:

### 10.3.1 Package/App Names (Preferred)

| Scope | Belongs To |
|---|---|
| `ordering` | `packages/core-domain` Ordering context |
| `kds` | `packages/core-domain` Kitchen Execution context |
| `inventory` | `packages/core-domain` Inventory context |
| `billing` | `packages/core-domain` Tenant Billing context |
| `edge-api` | `apps/edge-api` Cloudflare Workers |
| `pos-client` | `apps/pos-client` Tauri POS terminal |
| `web-dashboard` | `apps/web-dashboard` Next.js admin |
| `marketing-site` | `apps/marketing-site` Public site |
| `core-domain` | `packages/core-domain` root |
| `sync-protocol` | `packages/sync-protocol` CRDT protocols |
| `ui-kit` | `packages/ui-kit` Ant Design tokens |

### 10.3.2 Feature-Area Names (Alternative)

| Scope | Description |
|---|---|
| `auth` | Authentication/authorization |
| `routes` | API route handlers |
| `db` | Database/schema changes |
| `ws` | WebSocket connections |
| `menu` | Menu catalog management |
| `reports` | Sales reports/analytics |
| `inventory` | Stock management |
| `kds` | Kitchen display system |

### 10.3.3 Scope Best Practices

| Good | Less Good | Avoid |
|---|---|---|
| `feat(ordering)` | `feat` (too vague) | `feat(stuff)` (meaningless) |
| `fix(kds-ticket)` | `fix(KDS)` (case mismatch) | `fix(fix-kds)` (redundant) |
| `docs(api)` | `docs(doc)` (redundant) | `docs(thing)` (no context) |

---

## 10.4 `short summary` (The `<type>(<scope>): ` part)

### 10.4.1 Requirements

- **Imperative present tense**: "add item", not "added item" or "adding item"
- **Under 50 characters** (including the `type(scope): ` prefix)
- **No period** at the end
- **Capitalize first word**

### 10.4.2 Good Examples

```text
feat(ordering): implement order aggregate state transition invariants  (50 chars exactly)
fix(kds-ticket): resolve state machine bypass  (27 chars)
docs(api-contracts): update Hurl test examples  (33 chars)
style/prettier-config: add config to new packages  (34 chars)
refactor(order-domain): extract validation into service  (36 chars)
perf/sync-loop: reduce flush frequency from 2s to 5s  (39 chars)
test/e2e-type-safety: add order-payment e2e tests  (36 chars)
build/tauri-v2: upgrade tauri from 1.0 to 2.0  (31 chars)
ci/github-actions: add auto-release workflow  (30 chars)
chore/readme-update: update contributing guide  (30 chars)
```

### 10.4.3 Bad Examples (too long, wrong tense, etc.)

```text
# Too long (52+ chars):
feat(ordering): implement order aggregate state transition invariants here  (54 chars)

# Wrong tense:
feat(ordering): implemented state transition invariants  (wrong: past tense)

# Missing scope:
feat: implement state transition invariants  (no scope - will fail PR review)

# Random case:
feat(Ordering): implement...  (capital O in scope - inconsistent)
```

---

## 10.5 `detailed description` (The Body)

### 10.5.1 Purpose

The body explains:

1. **'why'** the change was made (the problem or motivation)
2. **'what'** was altered (specific code changes, files modified)
3. **relevant trade-offs or background context** (why this approach over alternatives)

### 10.5.2 Structure

| Paragraph | Purpose | Example |
|---|---|---|
| **1** | Problem/motivation | "The order aggregate was not validating that seat check totals match the order total, causing financial discrepancies at settlement." |
| **2** | Solution/what changed | "Added validation in `Order::settle()` that computes $\sum \text{(Seat Check Totals)}$ and compares to `Order::subtotal()`. Throws `OrderError::InsufficientPayment` if mismatch." |
| **3** | Trade-offs/context | "This adds a ~2ms computation per settlement but prevents accounting errors that would require manual Z-report correction. Alternative was client-side validation only, which we rejected due to bypass risk." |

### 10.5.3 Length Guidelines

- **Minimum**: 2-3 sentences (problem + solution)
- **Recommended**: 3-5 paragraphs for complex changes
- **Maximum**: Keep under 500 characters total body (readability)
- **Multiple paragraphs**: Use blank line (`\n\n`) between paragraphs

### 10.5.4 Formatting Tips

- Use **bullet lists** (`- ` or `* `) for multiple related points
- Use **code references** (`Order::settle()`, `packages/core-domain/src/models/order.rs`) for specificity
- Use **math notation** (`$ \sum `) for financial formulas if helpful
- Reference **issue numbers** or **task IDs** at end if applicable

### 10.5.4.1 Bullet List Example

```
feat(ordering): implement seat balance validation

The Order aggregate root was not validating that seat check totals 
match the order total, causing financial discrepancies at settlement.

What changed:
- Added `validate_seat_balance()` method to Order aggregate
- Throws `OrderError::InsufficientPayment` if $\sum \text{(Seat Check)} \neq \text{Order Total}$
- Called automatically by `settle()` and `record_payment()`

Trade-offs:
- ~2ms additional computation per settlement
- Prevents accounting errors that would require manual Z-report correction
- Client-side validation alone was rejected due to bypass risk

For: task-102
```

### 10.5.4.2 Code Reference Example

```
fix(kds-ticket): resolve state machine bypass allowing BUMPED before IN_PREP

KitchenTicket aggregate root did not enforce the PENDING → IN_PREP → READY → BUMPED 
transition order. A ticket line could transition directly to BUMPED, skipping required states.

What changed:
- Added invariant check in `KitchenTicket::bump()` that rejects status changes 
  without prior IN_PREP transition
- Fast-track option added: requires `Permissions::FAST_TRACK` bitmask
- Updated KDS WebSocket handler to enforce before broadcasting

Trade-offs:
- Minor UI/UX impact: users must now follow proper prep workflow
- Prevents incorrect KDS state that would confuse kitchen staff
- Fast-track option authorized to supervisors only

For: task-349
```

---

## 10.6 The `For:` Field (Optional Task Identifier)

### 10.6.1 Purpose

The `For:` field identifies the task, issue, or ticket this commit relates to. This enables:

- **Traceability**: Link commits to task management system
- **Release notes**: Auto-generate changelog from `For:` fields
- **Impact analysis**: See all changes related to a specific task
- **PR requirements**: Some teams require `For:` for merge approval

### 10.6.2 Formats

| Format | Example | When to Use |
|---|---|---|
| `For: task-102` | Short task ID | When using internal task tracker |
| `For: #551` | GitHub issue number | When committing to fix GitHub Issue #551 |
| `For: improve-checkout-flow` | Descriptive text | When no formal task tracker, or for meta-changes |
| (omit) | No `For:` | Acceptable for trivial docs/style only |

### 10.6.2.1 When `For:` is Expected

| Scenario | Required? |
|---|---|
| New feature development | Strongly recommended |
| Bug fix | Recommended |
| Documentation only | Optional |
| Routine chore (deps, formatting) | Optional |
| Hotfix emergency | May omit for speed, add later |

### 10.6.2.2 Examples

```text
# With task ID
feat(ordering): implement seat balance validation

Added validation rules to ensure total seat check sums match total order total using rust_decimal.

For: task-102

# With GitHub issue number
fix(kds-sync): resolve WebSocket drop under high concurrency

Fixed race condition in Durable Object sync room where concurrent bumps could lose mutation.

For: #432

# With descriptive text (no formal tracker)
chore(readme): update contributing guide with branch naming conventions

Updated branch naming section to use `<type>/<short-kebab-description>` pattern per AGENTS.md.

For: improve-branch-naming
```

### 10.6.3 `For:` in PR Context

When creating a PR, the task ID in `For:` often appears in:
- PR title: "feat: seat balance validation (task-102)"
- Project board automation: auto-move card to "In Review" when PR created
- Changelog generation: `For:` fields collected for release notes

---

## 10.7 Conventional Commits Validation (CI/CD)

### 10.7.1 Git Hook Plug-in (`.githooks/`)

The monorepo uses git hooks (configured by `pnpm run init` → `mise run init`) that validate commit messages on every commit. The pre-commit hook checks:

1. Message matches `<type>(<scope>): <summary>` pattern
2. Summary is under 50 characters (before body)
3. Body is present (blank line separates summary from description)
4. `For:` field format is valid (if present)

**If validation fails**, commit is rejected with instructions to reformat.

### 10.7.2 CI Check (`.github/workflows/ci-dev.yml`)

The CI workflow also validates commit messages as part of the PR merge gate:

```yaml
# Simplified from .github/workflows/ci-dev.yml
jobs:
  validate-commit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          # Extract last commit message
          msg=$(git log -1 --format=%s)
          # Validate pattern
          if ! echo "$msg" | grep -qP '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)\([a-z-]+\): .{1,50}$'; then
            echo "❌ Commit message does not follow Conventional Commits format"
            exit 1
          fi
```

**If CI fails**, PR cannot be merged until commit messages are corrected.

### 10.7.3 Automated Fix (Pre-commit)

Run the fix script (provided in `.githooks/`):

```bash
# If your editor or tool strips the format, you can re-format:
git commit --amend -m "feat(ordering): implement invariants

Body explaining why and how.

For: task-102"
```

Or use the `commitizen` tool if configured:

```bash
cz commit  # Interactive Conventional Commits prompt
```

---

## 10.8 Commit Message Checklist (Self-Check Before Pushing)

| Question | Yes/No |
|---|---|
| Does the message start with `<type>(<scope>): `? | |
| Is the summary under 50 characters (not counting the prefix)? | |
| Is the first letter of the summary capitalized? | |
| Is the summary in imperative present tense (no "editing", "added")? | |
| Is there a blank line after the `)` and before the body? | |
| Does the body explain 'why' the change was made? | |
| Does the body explain 'what' was changed (specific files/functions)? | |
| Are there trade-offs or background context noted? | |
| If applicable, is there a `For: task-xxx` or `For: #xxx`? | |
| Does every commit in the PR follow this format? | |

**If any answer is "No", fix the commit message before pushing.**

---

## 10.9 Version & Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | 2026-08-28 | Docs Team | Initial release - Conventional Commits mastery |
| 0.1.1 | YYYY-MM-DD | TBD | Updates based on contributor feedback |
| 0.2.0 | YYYY-MM-DD | TBD | Major overhaul for new commit format policies |

---
*This file is part of the PlinthOS internal developer documentation set. See `09_contributing-guide.md` for the full contributor workflow, `AGENTS.md` Section 2 for the source of truth, and `11_branch-workflow.md` for branch management.*