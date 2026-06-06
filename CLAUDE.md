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
