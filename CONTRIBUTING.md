# Contributing

## Workflow

1. Create a branch from `main`.
2. Keep changes scoped: one domain concern per PR.
3. Run the full gate before pushing:

   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build:web
   npm run functions:check
   ```

4. CI must be green. Do not merge with skipped security tests.

## Rules of thumb

- **Domain logic belongs in `packages/shared`.** Add tests next to it. UI code should not re-implement screening or alert rules.
- **Never bypass RLS.** If a privileged operation is required, add a `SECURITY DEFINER` RPC with a pinned `search_path` and an explicit role check, or a JWT-verified Edge Function. Do not use the service role in a client-reachable path.
- **Every new table needs RLS + policies in the same migration** or CI will fail.
- **Money is integer minor units.** Prices use `numeric`. Never use floats for billing.
- **All user-facing strings must go through i18n.** Add keys to `en`, `ar` and `es`; the parity test enforces completeness. Arabic is RTL.
- **Validate at the boundary** with a Zod schema from `@hse/shared`.
- **Audit admin mutations.** Write an `audit_logs` entry with actor and before/after values.
- **No secrets in the repo.** Use `.env.example` for documentation only.

## Commit style

Conventional commits are preferred:

```
feat(alerts): add volume-spike indicator
fix(rls): bind portfolio policies to auth.uid
docs(deploy): document Vault cron setup
test(sharia): cover receivables threshold
```

## Database changes

- Add a new timestamped migration; never edit an applied migration.
- Update the TypeScript types/mappers and `docs/API.md` when the schema changes.
- If you add a public table, extend `SECURITY_TABLES` in `packages/shared/tests/sql-rls.test.ts`.

## Edge Functions

- Shared helpers live in `supabase/functions/_shared`.
- Authenticate with `requireUser`, `requireAdmin` or `requireCron`.
- Validate payloads, limit body size, verify webhook signatures before parsing.
- Log provider calls to `api_usage` and unexpected failures to `app_errors`.
- Run `npm run functions:check` before opening a PR.

## Design

- Web uses the existing Tailwind tokens (`brand`, `ink`, `sand`, `lime`) and shared primitives. Prefer server components; client components only for interaction.
- Mobile uses `src/theme.ts` and the primitives in `src/components/ui.tsx`. Keep RTL in mind: use logical start/end spacing and mirror rows when needed.
