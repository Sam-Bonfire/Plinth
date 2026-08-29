# 08_typescript-standards.md - TypeScript Quality Standards for PlinthOS

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `07_rust-safety-mandates.md` (equivalent Rust standards)
- `AGENTS.md` (source of truth for all project conventions)
- `06_domain-modeling-patterns.md` (TS equivalents of domain patterns)
- `DEVELOPER-NAVIGATION.md` (master navigation)
- `package.json` (project root - confirms monorepo tooling)
- `tsconfig.base.json` (shared TypeScript config)

---

## 8.1 Mandate Overview (per `AGENTS.md` Section 4B)

**TypeScript Strict Mode** is enforced across all JavaScript/TypeScript projects in the PlinthOS monorepo. The specific requirements are:

> **Strict Typing**: TypeScript `strict` mode (`strict: true`, `noImplicitAny: true`) is enforced across all JS/TS projects.
> **No Explicit Any**: Using `any` type is strictly forbidden. ESLint enforces `@typescript-eslint/no-explicit-any: error`.
> **Framework Choice**: Apps use React + TypeScript + Vite (target Cloudflare Pages / Workers), avoiding Vercel-specific frameworks like Next.js.

These mandates exist because:
- **Financial precision** (Rust side uses `rust_decimal`; TS side must avoid float imprecision)
- **Component reliability** (strict types prevent runtime errors in UI)
- **Team scale** (100+ developers need guaranteed type safety across monorepo)
- **CI/CD blocker** (failed lint blocks PR merge into `dev` branch)

---

## 8.2 `tsconfig.json` Configuration Requirements

Every TS project in the monorepo must have (or inherit via `tsconfig.base.json`) the following settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "@emotion/react",  // Or "@ui-kit/core" per project
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@ui-kit/*": ["../../packages/ui-kit/src/*"],
      "@core/*": ["../../packages/core-domain/src/*"]
    }
  },
  "include": ["src", "tests"],
  "exclude": ["node_modules", "dist", "build"]
}
```

### Per-Project `tsconfig.json` Examples

#### `apps/pos-client/tsconfig.json`

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noExplicitAny": false,  // Superseded by ESLint rule
    "strict": true  // Enforced by ESLint @typescript-eslint/no-explicit-any: error
  },
  "include": ["src", "src-tauri"],
  "exclude": ["node_modules", "dist"]
}
```

#### `apps/web-dashboard/tsconfig.json`

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noExplicitAny": false,  // ESLint handles this as error
    "strictNullChecks": true,
    "target": "ES2022",
    "jsx": "react-jsx",
    "jsxImportSource": "@ui-kit/core"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

#### `packages/ui-kit/tsconfig.json`

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noExplicitAny": false,
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "jsxImportSource": "@ui-kit/core"
  },
  "include": ["src"],
  "files": ["src/theme.ts", "src/index.ts"]
}
```

---

## 8.3 ESLint Configuration (`AGENTS.md` Enforcement)

The monorepo uses ESLint with the following critical rule (per `AGENTS.md`):

```js
// .eslintrc.cjs or relevant config
{
  "rules": {
    // ... other rules
    "@typescript-eslint/no-explicit-any: error",  // MANDATORY - any type forbidden
    "@typescript-eslint/strict-boolean-expressions: error",
    "@typescript-eslint/explicit-function-return-type: warn",
    "@typescript-eslint/explicit-module-boundary-surfaces: error"
  }
}
```

### What `no-explicit-any: error` Forbids

| Anti-Pattern | Error Example | Forced Fix |
|---|---|---|
| `function foo(x: any) {}` | `no-explicit-any` | `function foo(x: unknown) {}` then type-narrow |
| `let x = someFunc();` | `no-implicit-any` (via `noImplicitAny: true`) | Annotate: `let x: ReturnType<typeof someFunc>` |
| `obj.foo` where `obj` typed as generic | `no-explicit-any` | Specify exact type or use type guard |
| Array methods returning `any` | `reduce((a,b) => a + b, 0)` as `any` | Type the accumulator: `reduce<(accum: number, curr: number) => number>` |

### Allowed Patterns (No Error)

| Pattern | Why It's Allowed |
|---|---|
| `function foo(x: unknown) { if (typeof x === 'string') ... }` | Type narrowing via `typeof` |
| `interface MyType { a: number; b: string; }` then `obj: MyType` | Explicit interface |
| `enum Status { PENDING, LOADED, ERROR; }` | Explicit enum - no any needed |
| `type Id = string | number;` | Union type, not any |
| `function isString(v: unknown): v is string { return typeof v === 'string'; }` | Proper type guard |

---

## 8.4 Type Patterns Used Across the Codebase

### 8.4.1 Enums (per `core-domain` and `apps/`)

**Rust** (per `packages/core-domain/src/enums/`):

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub enum OrderStatus {
    Draft,
    Submitted,
    InPrep,
    Ready,
    Bumped,
    Settled,
    Voided,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub enum OrderChannel {
    DineIn,
    Takeout,
    Delivery,
    Kiosk,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub enum PaymentMethod {
    Cash,
    Card,
    UPI,
    Wallet,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub enum Permissions {
    TAKE_ORDER = 1 << 0,
    MANAGE_MENU = 1 << 1,
    VOID_ORDERS = 1 << 2,
    FAST_TRACK = 1 << 3,
}
```

**TypeScript** (per `apps/`):

```tsx
// Good: Explicit enum with string values
enum OrderStatus { 
  DRAFT = "DRAFT", 
  SUBMITTED = "SUBMITTED", 
  IN_PREP = "IN_PREP", 
  READY = "READY", 
  BUMPED = "BUMPED", 
  SETTLED = "SETTLED" 
}

// Usage with type guard
function isFinalStatus(status: OrderStatus): status is 'SETTLED' {
  return status === 'SETTLED';
}

// Good: Numeric bitmask enum (for Permissions)
enum Permissions {
  TAKE_ORDER = 1 << 0,    // 0001 binary
  MANAGE_MENU = 1 << 1,   // 0010 binary
  VOID_ORDERS = 1 << 2,   // 0100 binary
  FAST_TRACK = 1 << 3,    // 1000 binary
}

// Bitmask check (per AGENTS.md staff.rs patterns)
const canManageMenu = (permissions: Permissions) =>
  (permissions & Permissions.MANAGE_MENU) === Permissions.MANAGE_MENU;
```

### 8.4.2 Interfaces vs Types

| Situation | Use Interface | Use Type |
|---|---|---|
| Object shape with possible extension | `interface` (open for extension) | `type` (closed) |
| Union or intersection types | `type` | N/A |
| Primitive or union literals | `type` | N/A |
| React component props | `interface` (convention) | `type` (if needed) |

**Example**:

```tsx
// Interface - used for component props (convention)
interface OrderFormProps {
  onSubmit: (order: OrderData) => void;
  initialValues: OrderInitialValues;
  isSubmitting: boolean;
}

// Type - used for unions/intersections
type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'WALLET';
type OrderStatus = 'DRAFT' | 'SUBMITTED' | 'IN_PREP' | 'READY' | 'BUMPED' | 'SETTLED';
```

### 8.4.3 Type Guards (per `AGENTS.md` and runtime safety)

```tsx
// Proper type guard pattern - no any needed
function isOrderSettled(status: OrderStatus): status is 'SETTLED' {
  return status === 'SETTLED';
}

// Usage
if (isOrderSettled(order.status)) {
  // Within this block, TypeScript narrows status to 'SETTLED'
  // No type errors, full type safety
  submitForZReport(order);
} else {
  // status is narrowed to Exclude<OrderStatus, 'SETTLED'>
  showNotSettledWarning(order);
}
```

### 8.4.4 React Component Types (per `apps/pos-client` and `apps/web-dashboard`)

**Function Component with explicit return type**:

```tsx
import { FC } from 'react';
import { Money } from '@/types/money';

interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export const SubmitButton: FC<ButtonProps> = ({ label, onClick, disabled }) => {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
};
```

**Hook with typed return**:

```tsx
import { useState } from 'react';
import { Money } from '@/types/money';

function useOrderTotal(): Money {
  const [total, setTotal] = useState<Money>({ amount: 0, currency: 'INR' });
  
  const addItem = (priceCents: number) => {
    setTotal(prev => ({
      amount: prev.amount + priceCents,  // Integer addition, exact
      currency: prev.currency,
    }));
  };
  
  return total;
}
```

---

## 8.5 No `Any` Type - Enforcement Details

### 8.5.1 The Rule (from `AGENTS.md`)

> **No Explicit Any**: Using `any` type is strictly forbidden. ESLint enforces `@typescript-eslint/no-explicit-any: error`.

### 8.5.2 This Means NO:

```tsx
// ❌ FORBIDDEN - explicit any
function processOrder(order: any) {
  return order.items[0].name;
}

// ❌ FORBIDDEN - implicit any (no type annotation)
const result = someAsyncFunction();  // Type inferred as any if no return type

// ❌ FORBIDDEN - any in data structures
interface Config {
  settings: any;  // Error: Use specific type or generic
}

// ❌ FORBIDDEN - any[] arrays
const items: any[] = [];  // Error: Specify element type
```

### 8.5.3 This IS allowed (workarounds):

```tsx
// ✅ ALLOWED - use unknown + type guard
function processOrder(order: unknown) {
  if (typeof order === 'object' && order !== null) {
    // Safe within this block
    const name = (order as { items: { name: string } }).items[0].name;
  }
}

// ✅ ALLOWED - generic with constraint
function identity<T>(arg: T): T {
  return arg;
}

// ✅ ALLOWED - type assertion on specific known type
const result = someFunc() as OrderData;  // Only if you know the return type

// ✅ ALLOWED - type guard narrows safely
function isString(v: unknown): v is string {
  return typeof v === 'string';
}
if (isString(v)) {
  // v is string here, not any
}
```

### 8.5.4 ESLint Rule Configuration (`.eslintrc.cjs`)

```js
module.exports = {
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    // 'plugin:@typescript-eslint/strict-type-checked',  // Would be too strict for some patterns
    // 'plugin:@typescript-eslint/stylistic-type-checked',
  ],
  rules: {
    // MANDATORY - no explicit any
    '@typescript-eslint/no-explicit-any': 'error',
    
    // Related strictness rules
    '@typescript-eslint/strict-boolean-expressions': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: "^_" }],
    
    // Good practices
    '@typescript-eslint/explicit-function-type': 'warn',
    '@typescript-eslint/array-type': ['error', { default: 'never' }],
  },
};
```

---

## 8.6 TypeScript Testing Standards (per `03_testing-workflow.md`)

### 8.5.1 Vitest Test Patterns

All Jest/Vitest tests must comply with strict mode (no `any`):

```tsx
import { render, screen } from '@testing-library/react';
import { OrderForm } from '../order-form';
import { describe, test, expect } from 'vitest';

describe('OrderForm component', () => {
  test('renders submit button with correct label', () => {
    render(<OrderForm />);
    expect(screen.getByText('Place Order')).toBeInTheDocument();
  });

  test('validates required fields', () => {
    const { rerender } = render(<OrderForm />);
    // TypeScript must infer correct types here - no any
    expect(screen.getByLabelText('Table number')).toBeInTheDocument();
  });
});
```

### 8.5.2 Test File Configuration (`vitest.workspace.ts`)

```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    // Enforce strict mode in tests too
    // vitest config inherits tsconfig strict settings
    resolve: {
      alias: [
        { find: '@', replacement: '/src' },
      ],
    },
    setupFiles: ['<rootDir>/setupTests.ts'],
  },
  plugins: [tsconfigPaths()],
});
```

### 8.5.3 Common Test Patterns in the Codebase

```tsx
// POS client test example (from apps/pos-client/src/App.test.tsx)
import { render, screen } from '@testing-library/react';
import { App } from './App';

test('renders main app shell', () => {
  render(<App />);
  // Should find elements by accessible queries
  expect(screen.getByRole('button', { name: /take order/i })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: /table/i })).toBeInTheDocument();
});

// Dashboard test example
import { render, screen } from '@testing-library/react';
import { Dashboard } from './dashboard';

test('dashboard loads with correct default view', () => {
  render(<Dashboard />);
  expect(screen.getByText('Shifts')).toBeInTheDocument();
  expect(screen.getByRole('tablist')).toBeInTheDocument();
});
```

---

## 8.6 Type Migration Path (Legacy Code)

If existing code has `any` types (pre-standard), migration plan:

### Phase 1: Identify
```bash
# Find all 'any' usage
grep -r ": any" apps/ --include="*.tsx" --include="*.ts" | wc -l
grep -r "\bany\b" apps/ --include="*.tsx" --include="*.ts" | grep -v "test" | wc -l
```

### Phase 2: Replace Patterns

| Replace `any: T` with | Example |
|---|---|
| `unknown` + type guard | `x: unknown` then `typeof x === 'string'` check |
| Specific type | `order: OrderData` then define `OrderData` interface |
| Generic with constraint | `data: T extends Record<string, any> ? T : never` |
| Omit unnecessary fields | `Partial<OrderData>` if only some fields needed |

### Phase 3: ESLint Fix
```bash
pnpm lint --fix  # Auto-fixable patterns
# Manual review for non-auto patterns
```

### Phase 4: Verify
```bash
pnpm lint  # Should show 0 @typescript-eslint/no-explicit-any errors
cargo clippy --workspace --all-targets -- -D warnings  # Rust still passes
```

---

## 8.7 TypeScript Version Compatibility

| Project | TypeScript Version | Node Version | Notes |
|---|---|---|---|
| `apps/pos-client` | `^5.5.4` | Node `>=24.0.0` (per `package.json`) | React 18, Vite 5.4 |
| `apps/web-dashboard` | `^5.5.4` | Node `>=24.0.0` | Next.js 14 (or Vite config) |
| `apps/marketing-site` | `^5.5.4` | Node `>=24.0.0` | Tailwind CSS 3.4+ |
| `packages/ui-kit` | `^5.5.4` | Node `>=24.0.0` | Shared tokens, theming |

**Why TS 5.5+**: 
- Improved generic variance
- Better `import type`/(`import value`) performance
- Stricter checking of basic types
- ES module namespace improvements

**Per `package.json`**:
```json
"dependencies": {
  "react": "^18.3.1",
  "react-dom": "^18.3.1"
},
"devDependencies": {
  "@types/node": "^26.2.0",
  "typescript": "^5.5.4",
  ...
}
```

---

## 8.8 Next Steps After Understanding TS Standards

After reading this file, proceed with:

1. **Run the lint check** to see your current compliance:
   ```bash
   pnpm -r lint
   # Should show 0 @typescript-eslint/no-explicit-any errors
   ```

2. **Identify any `any` types** in your local changes:
   ```bash
   grep -rn ": any" apps/ --include="*.tsx" --include="*.ts" | grep -v ".test." | head -20
   ```

3. **Read the actual config files** to verify:
   - `apps/pos-client/tsconfig.json`
   - `apps/web-dashboard/tsconfig.json`
   - `packages/ui-kit/tsconfig.json`
   - `.eslintrc.cjs` (verify `@typescript-eslint/no-explicit-any: error`)

4. **Check a sample file** for compliance:
   - `apps/pos-client/src/App.tsx`
   - `apps/web-dashboard/src/app/dashboard/page.tsx`
   - Any `.tsx` file you're modifying

5. **Read** `07_rust-safety-mandates.md` for the Rust-side equivalents and how both standards integrate in CI/CD.

6. **Try a small fix**: If you find `any` in your changes, replace with `unknown` + type guard or specific type.

---

## 8.8 Version & Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | 2026-08-28 | Docs Team | Initial release - TypeScript standards |
| 0.1.1 | YYYY-MM-DD | TBD | Updates based on contributor feedback |
| 0.2.0 | YYYY-MM-DD | TBD | Major overhaul for new TS version alignment |

---
*This file is part of the PlinthOS internal developer documentation set. See `07_rust-safety-mandates.md` for the Rust-side equivalents, `06_domain-modeling-patterns.md` for domain patterns translated to TS, and `AGENTS.md` for the source of truth governing all project conventions.*