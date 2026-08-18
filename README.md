# InterfaceKit for Svelte

[InterfaceKit](https://www.npmjs.com/package/interface-kit) is a visual design tool: click an element in the running app, restyle it in place, then copy the accumulated changes as a prompt for your coding agent. It ships with a React binding. This repo wires it into **SvelteKit**, and adds the spatial controls the package does not have.

[Guide](./GUIDE.md) · [Contributing](./CONTRIBUTING.md) · [License](./LICENSE)

## Credits

The tool, its interface and the entire engine are by **[Josh Puckett](https://github.com/joshpuckett)**:

- npm: [interface-kit](https://www.npmjs.com/package/interface-kit)
- Repo: [joshpuckett/interfacekit](https://github.com/joshpuckett/interfacekit)
- License: MIT

This repo only contains the Svelte binding. It is not a fork and not a replacement.

## Try it

```bash
npm install
npm run dev
```

The demo page is a playground: headings, cards, a table, form controls and code blocks to aim the brush at. The toolbar sits in the top right corner.

## Usage

Copy `src/lib/InterfaceKit.svelte` and the modules next to it into your project, install `interface-kit`, and mount the component in your root layout:

```svelte
<script>
	import InterfaceKit from '$lib/InterfaceKit.svelte';
</script>

{@render children()}

<InterfaceKit />
```

That is all. The component renders nothing itself and is inactive in production builds.

| Prop | Default | Meaning |
| --- | --- | --- |
| `enabled` | `import.meta.env.DEV` | Mount the kit. Must be passed as `true` into the package; see below. |
| `movable` | `true` | Drag, resize, snap, arrow nudge. |
| `guides` | `true` | Alignment lines on hover and on the selection. |

## What this binding adds

On top of Style / Type / Layout and Copy as prompt:

- **Move and resize** the selection (`translate`, `width`, `height`), with 6px edge/center snap
- **Alignment guides** and **distance labels** you can click to write margin, padding or gap
- **Parent / child** via Escape, Enter and double-click
- **This / All**, **Rest / Hover**, and **token preservation** (`var(--paper)` instead of a hex)
- **Draggable inspector** (grab the Copy Edits bar)
- **Popover and native-select fixes** so the kit’s UI matches Craft inside a shadow root

The [guide](./GUIDE.md) is the full map: keyboard, distances, tokens, and the two Svelte gotchas.

## Two things that matter

### 1. Dynamic import, not static

The package touches `document` on load. A static import pulls it into the SSR bundle, where it breaks. So it is only loaded inside `onMount`:

```js
import('interface-kit').then(({ createInterfaceKit }) => { ... });
```

This keeps the server bundle clean and lets the client load it as its own chunk.

### 2. `enabled` has to be set explicitly

Without the flag the package calls its internal `resolveEnabled()`, which falls back to `process.env.NODE_ENV`. That is not reliably present in the browser, and the tool then renders nothing at all: container mounted, UI empty, no error anywhere.

```js
createInterfaceKit({ enabled: true });
```

## License

[MIT](./LICENSE) for the Svelte binding in this repo. `interface-kit` itself is MIT as well, copyright Josh Puckett.
