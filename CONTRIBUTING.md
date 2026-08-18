# Contributing

This repository is a **Svelte binding** for [interface-kit](https://github.com/joshpuckett/interfacekit). The engine, inspector and prompt export stay upstream. Changes here should stay in the binding, the demo, or the docs.

## Setup

```bash
npm install
npm run dev
```

```bash
npm test
npm run check
```

`npm test` covers snap, distance writes, modifier keys and the drag spring. `npm run check` is `svelte-check`.

## Pull requests

1. Open an issue first when the change is a new behavior, not a typo or a broken demo.
2. Keep the PR to one feature or fix.
3. Do not add a dependency unless the issue explains why the binding cannot do it itself.
4. Docs and comments are English, matching the rest of the repo.
5. Credit stays with Josh Puckett for the tool. Do not rebrand the inspector or imply this is a fork of the engine.

## What belongs where

| Change | Where |
| --- | --- |
| Style / Type / Layout, Copy as prompt, the paintbrush | Upstream `interface-kit` |
| SvelteKit mount, SSR, shadow-root popovers, native selects | This repo |
| Move, snap, distances, ancestry, tokens, hover chrome | This repo |

Copy `src/lib/InterfaceKit.svelte` and every module it imports. The demo page under `src/routes` is not part of the binding.
