1. **Update `apps/marketing-site/package.json`**:
   - Add `@plinth/ui-kit` (workspace:*), `antd` (^5.20.0), and `@ant-design/icons` to dependencies.

2. **Update `apps/marketing-site/vite.config.ts`**:
   - Configure Vite 5 bundler with React plugin.
   - Add strict path aliases for `@plinth/ui-kit`, `@plinth/sync-protocol`, `@plinth/core-domain`, and `@`.
   - Configure dev server: port 4000, strictPort true, host true.

3. **Update `apps/marketing-site/tsconfig.json`**:
   - Ensure paths for aliases are defined if needed, though vite config is the primary bundler configuration. It's safe to add `paths` to compilerOptions matching the vite aliases. Wait, `tsconfig.base.json` already has some paths, I might just need to add `"paths": { "@/*": ["./src/*"] }` and maybe extend `tsconfig.base.json`. Actually I should check if `apps/marketing-site/tsconfig.json` extends `../../tsconfig.base.json`. Yes, it doesn't currently. I will make it extend `../../tsconfig.base.json` and add `@/*` path.

4. **Update `apps/marketing-site/src/main.tsx` and `App.tsx`**:
   - Import `@plinth/ui-kit/tokens.css`.
   - Use `loadPlinthFonts` and create `PlinthThemeProvider` (wrapping AntD's `ConfigProvider` with `getThemeConfig(false)` from `@plinth/ui-kit`). Let me build a clean wrapper or just use `ConfigProvider` directly if `PlinthThemeProvider` isn't found. Actually I will create `PlinthThemeProvider` directly inside `App.tsx` or `@plinth/ui-kit`. The instructions say "Integrate PlinthThemeProvider, CSS tokens, and font loader in App.tsx and main.tsx". I'll create `PlinthThemeProvider` as a wrapper of `ConfigProvider` in `App.tsx` (or maybe `packages/ui-kit/src/index.ts` if it belongs there. Wait! I'll put it in `packages/ui-kit/src/index.ts` if I want to make it reusable across all apps. Let me check if the instructions say where it is. It just says "Integrate PlinthThemeProvider". I'll create `PlinthThemeProvider.tsx` in `@plinth/ui-kit/src/theme-provider.tsx` and export it in `@plinth/ui-kit/src/index.ts` because it's a reusable ui-kit component. Wait! I'll just write it inside `apps/marketing-site/src/App.tsx` first, or check if I missed it. Since I searched and it didn't exist anywhere in `packages`, I will define it in `packages/ui-kit/src/theme-provider.tsx` and export it from `index.ts`. Or I can just write it in `apps/marketing-site/src/theme-provider.tsx`. I'll create it in `packages/ui-kit/src/theme-provider.tsx` so all apps can use it). Let's do it in `packages/ui-kit/src/theme-provider.tsx`.

5. **Pre commit checks**: Ensure testing, verification, review, and reflection are done by calling `pre_commit_instructions` tool and executing its steps.

6. **Submit**:
   - `branch_name`: `feat/marketing-site-vite-antd`
   - `commit_message`: As specified in the context.
