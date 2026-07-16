# Plata

Plata — Colombian colloquial term for "money" — is a **multi-user personal finance tracker** where users register expenses and income — both one-time and recurring, with any cadence. Users can log transactions manually, through a chat interface powered by an LLM, or via CSV import. Categorization is guided by the LLM, which also generates custom reports and visualizations following the app's design language, alongside static reports users see on entry. The LLM integration is model-agnostic and runs server-side on Cloudflare Workers.

Built with **TanStack Start** (React 19) and deployed on **Cloudflare Workers** with a **D1 SQLite** database.

## Core Stack

| Layer         | Technology                                                 |
| ------------- | ---------------------------------------------------------- |
| Framework     | TanStack Start (SSR, file-based routing, server functions) |
| Routing       | TanStack Router (type-safe)                                |
| State         | TanStack Query                                             |
| Auth          | Better Auth (Google OAuth, Drizzle adapter)                |
| ORM           | Drizzle ORM (Cloudflare D1)                                |
| UI            | @base-ui/react primitives + Tailwind CSS v4 + Lucide icons |
| Design System | class-variance-authority + clsx + tailwind-merge           |
| Toolchain     | Vite+ (`vp`)                                               |
| Testing       | Vitest + Testing Library                                   |
| Component Dev | Storybook 10                                               |
| Hosting       | Cloudflare Workers + D1                                    |

## Project Structure

```
src/
├── components/
│   ├── icons/          # Custom SVG icons
│   ├── pages/          # Full-page components (login, etc.)
│   └── ui/             # Design system components (button, input, toast, etc.)
├── db/                 # Drizzle schema + D1 client
├── integrations/       # TanStack Query setup
├── lib/
│   ├── auth/           # Better Auth server, client, and server functions
│   └── utils.ts        # cn() utility
├── routes/
│   ├── __root.tsx      # Root layout
│   ├── _protected/     # Auth-gated route group
│   ├── api/auth/$.ts   # Better Auth catch-all handler
│   └── login.tsx       # Google OAuth login page
├── router.tsx          # Router factory
└── styles.css          # Global styles + Tailwind theme
```

## Key Behaviors

- Unauthenticated users are redirected to `/login`
- Authenticated users see the protected home page
- Toast notifications surface auth and other errors globally
- All UI components follow a rigorous, dark-themed, zero-radius design system (see `components.md`)

## Coding Conventions

- **React Compiler is active project-wide** (`vite.config.ts`, `babel-plugin-react-compiler`). Don't add manual `useMemo`, `useCallback`, or `React.memo` — the compiler memoizes automatically.
- **Use the `React.*` global namespace for types** (`React.ReactNode`, `React.ComponentProps<...>`, etc.) instead of importing them from `"react"`. This works in type position with no import and no `tsconfig` change — only _value_ access to an unimported `React` (e.g. calling `React.useState` without importing) requires `allowUmdGlobalAccess`, which this project doesn't set and doesn't need for this pattern.
- **Component props pattern**: type a component's props as `React.ComponentProps<Element | Primitive> & CustomProps` (e.g. `Collapsible.Root.Props & { displayState: ... }`, or `React.ComponentProps<"div"> & { approveLabel?: string }`). Destructure the custom props plus `className` out, and spread the rest onto the underlying element/primitive. See `src/components/ui/tool-call.tsx` for a worked example across several sub-components.
- **Prefer `function name() {}` declarations over arrow functions** for anything bound to a name and called by that name (components, hooks, module-level helpers, local helpers inside a component/hook body). Arrow functions stay for actual callbacks — passed inline as an argument (`.map((x) => ...)`, `onClick={() => ...}`, `useEffect(() => {...}, [deps])`) — and for object-literal property values (route handler configs, mock factories, context defaults), which aren't declarations and are a separate style call.
- **Capturing mocked call arguments in tests**: when a test mocks a third-party hook/function to inspect what your code passed into it, type the mock against the real signature (`vi.fn<typeof actual.someFn>((...) => ...)`) and read `mock.lastCall`, with an explicit `expect(lastCall).toBeDefined()` before destructuring it. Never reach for `mock.calls.at(-1)! as any` — the cast throws away type safety `mock.lastCall` already gives you for free, and the bare `!` asserts something the test never actually checked. If you need the mock's _return value_ rather than its arguments (e.g. to spy into a nested method on what it returned), there's no `lastResult` equivalent — `mock.results.at(-1)!.value` is the real API; typing the mock still removes the need for `as any` there.
- **Don't test Drizzle's own migration output**: verifying that a migration actually created the index/constraint your `schema.ts` declares (via raw `sqlite_master`/`PRAGMA` queries) is testing Drizzle's declaration→SQL translation, not our code — that's Drizzle's responsibility, not ours. If schema↔migration drift (editing `schema.ts` without regenerating/committing the migration) is a real concern, address it with `drizzle-kit check` in CI, not an application test that re-verifies the ORM's own output.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (`imjoe-dev/plata`) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary, used as-is (no repo-specific renaming). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
