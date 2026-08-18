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

## Moving elements

InterfaceKit itself has no way to reposition or drag-resize an element: the Layout tab exposes width, height, padding, margin, flex direction, alignment and gap, and the tool never touches the DOM tree. This repo adds moving and resize handles on top of it.

Select an element, then:

- **Drag it.** The drag engages after 3px, so a short click still selects as usual. Edges and centers **snap** to nearby elements within 6px (left/center/right, top/middle/bottom). Hold **Alt** to move freely.
- **Drag a handle** on the selection rect to resize. The dragged edges snap the same way. Corner handles with **Shift** lock aspect ratio; **Alt** still releases the magnet. West/north handles also write `translate` so the opposite edge stays put.
- **Arrow keys** nudge by 1px, **Shift + arrow** by 10px.
- **Escape** cancels a drag in progress and puts the element back. After that, Escape walks the selection up one parent.

There is no 8px grid and no snap to a parent's padding edges. Snap is alignment against other boxes, the same six lines the guides already draw.

Moving is applied as the CSS [`translate`](https://developer.mozilla.org/en-US/docs/Web/CSS/translate) property; resize as `width` / `height`. All three go through `controller.applyStyleGroup` with a Tailwind class, so they show up in the pending changes and in the "Copy as prompt" export like any other edit.

It uses `applyStyleGroup` with a single element on purpose. The `applyStyle` shortcut expands to `[element, ...getSimilarElements(element)]` internally, which is right for a color but wrong for a position: it would move every similar button at once.

Pass `movable={false}` to turn it off:

```svelte
<InterfaceKit movable={false} />
```

## Moving the inspector

The package only lets you drag the collapsed paintbrush. With the kit open, grab the Copy Edits bar to move the inspector. The Style / Layout panel (and Settings) stay attached. A short click still hits Copy Edits, delete, settings and close; the drag engages after 5px. Escape cancels a drag in progress. Closing the kit puts the panel back in the corner.

## Alignment guides

While the brush is active, hovering an element draws six viewport-spanning lines from its box: left, center and right (vertical), top, center and bottom (horizontal). Use them to check whether other elements share an edge or a midline.

The same guides stay on the selected element, so they keep tracking while you drag or resize. Center lines are dashed; edges are solid. Both use the kit's hover blue.

Pass `guides={false}` to turn them off:

```svelte
<InterfaceKit guides={false} />
```

## Distances

With an element selected, hold **Alt** and hover another one. A line and a `12px` label show the gap between the same edges the guides use. Nested boxes show inset distances (padding-like). This is a readout, not a style write — apply `gap` or `margin` in the Layout tab if it should land in the prompt.

## Parent / Child

A click hits the innermost node: a tag, a heading, a quote — almost never the card wrapper that actually holds padding and radius.

- **Escape** (no drag running) moves the selection one element up.
- **Enter** or **double-click** moves one element in, toward the node under the cursor.

The DOM does not change. Only `getSelectedElement()` does, so Move, Snap and the inspector all follow.

## Tokens

When a color you apply matches a `:root` custom property (`--paper`, `--ink`, …), the pending change stores `var(--paper)` and the Tailwind class `bg-[var(--paper)]` instead of the computed hex. Copy as prompt then keeps the design token. No token editor — it only preserves what is already a custom property.

## Rest / Hover / Focus

A small switcher sits on the selection rect. Rest is the default inspector target. Switch to Hover or Focus, then restyle: those writes export as `hover:…` / `focus:…` utilities next to the rest style. There is no Active/Disabled set in this version.

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

Color / shadow / border still inherit a second look if the host app styles `[data-slot=popover-content]` globally (shadcn, bits-ui). Color wins via `!important` utilities; the others do not. The binding forces those portaled surfaces onto the kit's `#2a2a2a` panel.

## Native selects

**Symptom:** Typeface (and any other kit `<select>`) opens the OS menu — a light system list on top of the dark inspector — instead of the Interface Craft popover used for color and shadow.

**Cause:** The package uses a native `<select>`. The picker is painted by the browser, not by the kit, and is not in the DOM, so neither the shadow stylesheet nor the portal mirror can restyle it.

**Fix:** intercept mousedown / keyboard on kit `<select>` elements and open a Craft listbox (`#2a2a2a`, 12px radius, same shadow as ShadeSelector). Choosing an option writes `select.value` and dispatches `change`, so the React handler still runs.

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
