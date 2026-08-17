# InterfaceKit for Svelte

[InterfaceKit](https://www.npmjs.com/package/interface-kit) is a visual design tool: click an element in the running app, restyle it in place, then copy the accumulated changes as a prompt for your coding agent. It ships with a React binding. This repo wires it into **SvelteKit**, and fixes a bug that breaks its popovers.

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

Copy `src/lib/InterfaceKit.svelte` into your project and mount it in your root layout:

```svelte
<script>
	import InterfaceKit from '$lib/InterfaceKit.svelte';
</script>

{@render children()}

<InterfaceKit />
```

That is all. The component renders nothing itself and is inactive in production builds.

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

## The popover fix

**Symptom:** the color picker (and the border and shadow popovers) open as a completely unstyled fragment in the middle of the page.

**Cause:** InterfaceKit renders its UI into a shadow root, but Radix portals its popovers into `document.body`, i.e. out of the shadow root. The kit's stylesheet does not reach them there.

This is not a Svelte problem. React runs the same shadow mount with the same portals and breaks the same way.

**Fix:** mirror the stylesheet into the light DOM, scoped strictly to the portal container with [`@scope`](https://developer.mozilla.org/en-US/docs/Web/CSS/@scope):

```js
style.textContent = `@scope ([data-radix-popper-content-wrapper]) {
${css.replaceAll(':root', ':scope')}
}`;
```

Two details carry this:

- **Without `@scope`**, Tailwind's preflight would reset the entire host app, wrecking the very design you are trying to judge.
- **`:root` has to become `:scope`**, because `html` sits outside the scope. Otherwise every custom property, and with it every color, goes missing.

The package uses popper-based portals exclusively (no dialogs), so a single scope selector covers every popover it has.

## Verified

Tested with Playwright against real Chrome:

- The color picker renders at the package's own values: `bg #2a2a2a`, `radius 12px`, 240px wide
- Applying a color takes effect: `rgb(0, 0, 0)` becomes `rgb(240, 10, 10)`
- Host app styles stay untouched (font sizes, spacing, radii and backgrounds identical before and after mount)
- The server bundle does not contain the package, and `npm run check` reports 0 errors

## Browser support

`@scope` needs Chrome 118+, Safari 17.4+ or Firefox 128+. Since the tool only ever runs in development, that is not a constraint in practice.

## License

[MIT](./LICENSE) for the Svelte binding in this repo. `interface-kit` itself is MIT as well, copyright Josh Puckett.
