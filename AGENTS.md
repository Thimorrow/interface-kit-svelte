# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is

A single SvelteKit 2 / Svelte 5 (runes) app built with Vite 8. It's both the reusable
`src/lib/InterfaceKit.svelte` binding and a demo playground (`src/routes/+page.svelte`) for
[`interface-kit`](https://www.npmjs.com/package/interface-kit), a dev-only visual styling tool.
There is no backend, database, or other service — the only thing to run is the Vite dev server.

### Commands

Standard scripts live in `package.json` (`dev`, `build`, `preview`, `check`). Node ≥ 22.12
(or ^20.19) is required. There is **no lint** setup and **no automated test** suite; static
validation is `npm run check` (svelte-check, expects 0 errors).

- Dev server: `npm run dev` → http://localhost:5173 (single required service).
- Type check: `npm run check`.
- Prod build: `npm run build`; preview built output: `npm run preview` → http://localhost:4173.

### Key gotcha: first browser load after starting `npm run dev` looks broken — reload once

`interface-kit` is a heavy React dependency that is pulled in via a **lazy dynamic import inside
`onMount`** in `src/lib/InterfaceKit.svelte`. Vite's dep scanner does not see it at cold start,
so the **first** browser load after starting/restarting the dev server (or after clearing
`node_modules/.vite`) triggers on-the-fly dependency re-optimization. During that pass Vite
returns `504 (Outdated Optimize Dep)` for in-flight modules and client hydration fails: the page
shows the static SSR HTML but the InterfaceKit toolbar never appears.

Fix: just **hard-reload the page once** (Ctrl/Cmd+Shift+R). Subsequent loads work because the
deps are now optimized and cached in the running server. When testing the tool, always reload
once after a fresh `npm run dev`.

### Finding the tool in the running app

The InterfaceKit control is a **small dark circular paintbrush button in the top-right corner**.
It renders into a shadow root under the `[data-interface-kit]` element and is **dev-only**
(inactive in `build`/`preview`). Do not confuse it with the `$24/mo` pricing card and the dark
"Style / Layout" panel in the hero section — those are static decorative mockups, not the tool.
Click the paintbrush to arm selection mode, click a page element to select it, then edit styles
in the inspector panel (Copy Edits toolbar appears at the top).
