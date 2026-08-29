# 11_branch-workflow.md - Git Branch Management for PlinthOS

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `09_contributing-guide.md` (full contributor workflow - prerequisite)
- `AGENTS.md` (Section 1 - branch naming source of truth)
- `01_env-setup.md` (environment init prerequisite)
- `DEVELOPER-NAVIGATION.md` (master navigation)
- `.github/workflows/ci-dev.yml` (CI validates branch targeting)

---

## 11.1 Primary Working Branch: `dev`

Per `AGENTS.md` Section 1:

> **Primary Working Branch**: `dev` (all feature branches and PRs target `dev`).

> **Stable Release Branch**: `main` (reserved strictly for stable release code).

### 11.1.1 Branch Hierarchy

```mermaid
graph LR
    subgraph "Local Repositories"
        LR1[Developer Laptop]
        LR2[CI Server]
    end
    
    subgraph "Remote Repository"
        RR1[origin/dev]
        RR2[origin/main]
    end
    
    LR1 -->|push/pull| RR1
    LR1 -->|push/pull| RR2 (rare)
    RR1 -->|merge to| RR2 (release process)
```

### 11.1.2 Branch Usage Guidelines

| Branch | Purpose | Who Uses It | Merge Target |
|---|---|---|---|
| `dev` | Primary development branch | All contributors | Base for feature branches |
| `feature/<type>/...` | Feature development | Individual contributors | Merge into `dev` via PR |
| `hotfix/<issue>` | Production bug fix | Release team | Merge into `main` + `dev` |
| `release/<version>` | Release preparation | Release manager | Merge into `main` only |
| `main` | Stable releases | Release management | Never direct commit from feature |

### 11.1.3 Daily Workflow Pattern

```bash
# 1. Start fresh from latest dev
git checkout dev
git pull origin dev

# 2. Create feature branch (follow naming convention)
git checkout -b feat/your-feature-name

# 3. Develop, commit, push
#    - All commits follow Conventional Commits (see 10_commit-message-format.md)
#    - Run `mise run test` before pushing

# 4. Push branch
git push origin feat/your-feature-name

# 5. Create PR (target: dev)
#    - PR template guides through checklist
#    - Reviewers approve, then merge

# 6. After merge:
git checkout dev
git pull origin dev  # Sync with updated dev
git branch -d feat/your-feature-name  # Clean up local
```

---

## 11.2 Feature Branch Creation

### 11.2.1 Naming Enforcement

All feature branches **MUST** follow the pattern:

```
<type>/<short-kebab-description>
```

**Valid examples**:
- `feat/ordering`
- `fix/kds-sync`
- `docs/contributing-guide`
- `style/prettier-config`
- `refactor/order-domain`
- `perf/sync-loop`
- `test/e2e-checks`
- `build/tauri-v2`
- `ci/github-actions`
- `chore/readme-update`

**Invalid branch names** (will require rename before PR merge):
- `my-new-feature` (no type prefix)
- `feature-123` (not kebab-case)
- `add-order-feature` (spaces, no type)
- `hotfix/production-issue` (should be `hotfix/` for release emergencies only)

### 11.2.2 Creating a Branch - Step by Step

```bash
# Method A: From plinth-monorepo root (recommended)
cd /c/Users/Sam/Consusson/Projects/Plinth

# 1. Ensure you're on dev and it's up to date
git checkout dev
git pull origin dev

# 2. Create feature branch (replace with your feature name)
git checkout -b feat/order-seat-validation

# 3. Verify branch was created correctly
git branch  # Should show * feat/order-seat-validation

# 4. Start working
#   - Make code changes
#   - Follow all mandates (unsafe_code deny, rust_decimal, etc.)
#   - Write Conventional Commit messages (see 10_commit-message-format.md)

# 5. Push branch to remote
git push origin feat/order-seat-validation

# 6. Create PR via GitHub/GitLab interface
#    - Target branch: dev
#    - Fill PR template
#    - Request review from team
```

### 11.2.3 Renaming a Branch (If You Made a Mistake)

```bash
# If you created branch without type prefix
git branch -m my-new-feature feat/my-new-feature

# If you need to rename remote tracking
git push origin -d my-new-feature  # Delete old
git push origin feat/my-new-feature  # Push new

# Or force rename (careful if others have the branch)
git branch -M old-name new-name  # Overwrites local
git push origin -d old-name  # Remove remote
git push origin new-name  # Push renamed
```

---

## 11.3 Hotfix Branches (Production Emergencies)

### 11.3.1 When to Create Hotfix

Hotfix branches are created only for **critical production bugs** that cannot wait for the normal `dev` cycle.

**Trigger conditions**:
- Customer-impacting bug (data loss, crash, financial error)
- Security vulnerability
- Complete system failure
- **Not** for: minor UX issues, cosmetic bugs, non-urgent enhancements

### 11.3.2 Hotfix Workflow

```bash
# 1. Create hotfix from main (or latest tagged release)
git checkout main
git pull origin main
git checkout -b hotfix/critical-payment-timeout

# 2. Fix the bug
#    - Minimal change required
#    - Run targeted tests
#    - Ensure no regressions

# 3. Test locally
mise run test:rust  # At minimum, run relevant Rust tests
# Or full: mise run test

# 4. Push and create PR
git push origin hotfix/critical-payment-timeout
# Create PR targeting BOTH:
#   - main (for release)
#   - dev (to incorporate fix into development cycle)

# 5. After merge to main:
#   - Tag the release
#   - Merge main into dev (or rebase dev onto main)
git checkout main
git merge hotfix/critical-payment-timeout  # Or squash + tag
git checkout dev
git merge main  # Incorporate fix into development

# 6. Delete hotfix branch
git branch -d hotfix/critical-payment-timeout
```

### 11.3.4 Hotfix Naming Pattern

```
hotfix/<short-description>
```

**Examples**:
- `hotfix/payment-timeout`
- `hotfix/kds-offline-sync`
- `hotfix/crash-on-startup`

---

## 11.4 Release Branches

### 11.4.1 When to Create Release Branch

When preparing a **stable release**, create a branch from `dev` once the following criteria are met:

- All planned features for the release are complete
- All tests pass (`mise run test`)
- No open high-priority bugs
- Code review completed for all PRs targeting this release

### 11.4.2 Release Workflow

```bash
# 1. Create release branch from dev
git checkout dev
git pull origin dev
git checkout -b release/1.0.0

# 2. Final verification
#    - Run full test suite: mise run test
#    - Verify documentation is current
#    - Check that CHANGELOG.md is updated
#    - Bump version in Cargo.toml / package.json as needed

# 3. Freeze changes on release branch
#    - No new features added
#    - Only critical bug fixes (via hotfix branches merged into release)

# 4. Merge to main (stable release)
git checkout main
git merge --no-ff release/1.0.0  # Creates merge commit with version tag
git tag v1.0.0  # Annotated tag
git push origin main --follow-tags

# 5. Merge release back to dev (with possible conflicts)
git checkout dev
git merge --no-ff release/1.0.0  # Or rebase dev onto main

# 6. Delete release branch
git branch -d release/1.0.0
```

### 11.4.3 Release Branch Naming

```
release/<semantic-version>
```

**Examples**:
- `release/1.0.0`
- `release/0.3.0-rc.1` (release candidate)
- `release/2.1.5` (patch release)

---

## 11.5 Branch Maintenance (Ongoing)

### 11.5.1 Stale Branch Cleanup

Feature branches that haven't been updated in >14 days should be refreshed:

```bash
# Rebase feature branch onto latest dev
git checkout feat/your-feature-name
git rebase dev  # May have conflicts to resolve

# Or merge latest dev
git checkout feat/your-feature-name
git merge dev  # Creates merge commit, easier if conflicts many
```

### 11.5.2 Orphaned Branch Cleanup

Branches related to closed/moved tickets should be cleaned up:

```bash
# List branches not merged into dev
git branch --no-merged dev | grep -v "^\* "

# Delete stale local branches
git branch --no-merged dev -D  # Delete only unmerged branches

# Delete remote tracking branches no longer needed
git push origin --delete stale-branch-name
```

### 11.5.3 Branch Naming Audit (Monthly)

Run this to verify all branches follow conventions:

```bash
# List all remote branches and check naming
git branch -r | grep -v "^\* " | grep -v "dev$" | grep -v "main$" | while read branch; do
  name=$(echo "$branch" | sed 's|origin/||')
  if ! echo "$name" | grep -qP '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)/[a-z0-9-]+$'; then
    echo "NON-STANDARD: $name"
  fi
done
```

**Expected output**: Zero non-standard branch names (or a short list to be renamed).

---

## 11.6 CI/CD Branch Validation (`.github/workflows/ci-dev.yml`)

The CI workflow validates PR branches before merge:

```yaml
# Simplified from actual .github/workflows/ci-dev.yml
name: CI / Dev

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Check PR targets dev branch
      - name: Verify PR target branch
        run |
          if [ "${{ github.head_ref }}" != "" ]; then
            PR_TARGET=$(git rev-parse origin/${{ github.base_ref }})
            echo "PR targets branch: $PR_TARGET"
            if [ "$PR_TARGET" != "origin/dev" ]; then
              echo "❌ PR must target origin/dev branch"
              exit 1
            fi
          fi
      
      # Run test suite
      - run: mise run test
```

**PR merge blocked if**:
- PR does not target `dev` branch
- `mise run test` fails (any Rust/TS/API test)
- Commit message format invalid (pre-commit hook)
- Branch naming non-conventional

---

## 11.7 Merge Conflict Resolution

### 11.7.1 Prevention

- **Rebase frequently**: `git checkout feat/name; git rebase dev` weekly
- **Small, focused PRs**: Easier to merge, fewer conflicts
- **Communicate with team**: If multiple people working same area

### 11.7.2 Resolution Strategy

When conflicts arise during PR merge or rebase:

```bash
# 1. Attempt rebase (preferred for clean history)
git checkout feat/your-feature-name
git rebase dev

# 2. If conflicts occur:
#    - Git will pause and mark conflicted files
#    - Resolve each file manually
#       code editor or git mergetool
    git mergetool  # Or edit manually

#    - Mark as resolved
    git add <resolved-file>

#    - Continue rebase
    git rebase --continue

# 3. If rebase fails completely:
    git rebase --abort  # Return to original state

# 4. Alternative: merge dev into feature branch
git checkout feat/your-feature-name
git merge dev  # Creates merge commit, keeps feature branch history

# 5. Push resolved branch
git push origin feat/your-feature-name  # Force if needed (coordinate with team)
```

### 11.7.3 Conflict Prevention Tips

| Tip | Benefit |
|---|---|
| Rebase feature branch onto dev weekly | Keeps branch current, reduces merge pain |
| Small, focused PRs (< 400 lines changed) | Easier to review and merge |
| One feature per branch | Isolate changes, easier conflict resolution |
| Team communication on shared areas | Avoid simultaneous work on same files |
| Feature flags for incomplete work | Merge safely, enable later |

---

## 11.8 Version & Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | 2026-08-28 | Docs Team | Initial release - branch workflow guide |
| 0.1.1 | YYYY-MM-DD | TBD | Updates based on contributor feedback |
| 0.2.0 | YYYY-MM-DD | TBD | Major overhaul for new branch policies |

---
*This file is part of the PlinthOS internal developer documentation set. See `09_contributing-guide.md` for the full contributor workflow, `AGENTS.md` Section 1 for the source of truth on branch naming, and `10_commit-message-format.md` for Conventional Commits mastery.*