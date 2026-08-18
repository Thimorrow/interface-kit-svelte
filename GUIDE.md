# Guide

How to run the demo, drop the binding into a SvelteKit app, and use every control this repo adds on top of [interface-kit](https://www.npmjs.com/package/interface-kit).

The engine, inspector and “Copy as prompt” export are [Josh Puckett’s](https://github.com/joshpuckett). This file covers the Svelte wiring plus move, snap, distances, ancestry, tokens and state.

## Contents

- [Run the demo](#run-the-demo)
- [Drop it into an app](#drop-it-into-an-app)
- [Props](#props)
- [The loop](#the-loop)
- [Move and resize](#move-and-resize)
- [Alignment guides](#alignment-guides)
- [Distances](#distances)
- [Parent and child](#parent-and-child)
- [This / All](#this--all)
- [Tokens](#tokens)
- [Rest / Hover / Focus](#rest--hover--focus)
- [Move the inspector](#move-the-inspector)
- [Keyboard](#keyboard)
- [Svelte wiring](#svelte-wiring)
- [Popover fix](#popover-fix)
- [Native selects](#native-selects)
- [Browser support](#browser-support)
- [Verify](#verify)

## Run the demo

```bash
npm install
npm run dev
```

The page is a playground: headings, cards, a table, form controls and code blocks. The paintbrush sits in the top right.

```bash
npm test          # geometry: snap, distances, modifiers
npm run check     # svelte-check
```

## Drop it into an app

Copy `src/lib/InterfaceKit.svelte` and the other files next to it in `src/lib/` (the binding is several modules, not a single component). Mount it in the root layout:

```svelte
<script>
	import InterfaceKit from '$lib/InterfaceKit.svelte';
</script>

{@render children()}

<InterfaceKit />
```

Install the engine:

```bash
npm install interface-kit
```

The component renders nothing itself. In production builds `enabled` defaults to `false`, so the kit never loads.

## Props

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `import.meta.env.DEV` | Mount the kit. Pass `true` explicitly in the browser; see [Svelte wiring](#svelte-wiring). |
| `movable` | `boolean` | `true` | Drag, resize handles, snap and arrow nudge. |
| `guides` | `boolean` | `true` | Viewport alignment lines on hover and on the selection. |
| `…options` | `InterfaceKitOptions` | — | Forwarded to `createInterfaceKit` (for example `ownerDocument`). |

```svelte
<InterfaceKit movable={false} guides={false} />
```

Distances, ancestry, This / All, tokens and Rest / Hover / Focus stay on whenever the kit is enabled. They have no extra props.

## The loop

1. Click the paintbrush.
2. Hover to outline a node, click to select it. The inspector opens.
3. Restyle in Style, Type or Layout. Every write is recorded.
4. **Copy Edits** puts the accumulated diff on the clipboard as a prompt for your coding agent.

No Tailwind or CSS setup is required. The package injects its own stylesheet at runtime.

## Move and resize

InterfaceKit itself never repositions a node. The Layout tab writes width, height, padding, margin, flex and gap. This binding adds drag and handles on the selection rect.

Select an element, then:

- **Drag it.** The drag engages after 3px, so a short click still selects. Edges and centers **snap** to nearby boxes within 6px (left / center / right, top / middle / bottom). Hold **⌘** (Ctrl on Windows) to move freely.
- **Drag a handle** to resize. The dragged edges snap the same way. Corner handles with **Shift** lock aspect ratio; **⌘** still releases the magnet. West / north handles also write `translate` so the opposite edge stays put.
- **Arrow keys** nudge by 1px, **Shift + arrow** by 10px.
- **Escape** cancels a drag in progress and puts the element back.

There is no 8px grid and no snap to a parent’s padding. Snap is alignment against other boxes — the same six lines the guides already draw.

Moving is applied as CSS [`translate`](https://developer.mozilla.org/en-US/docs/Web/CSS/translate); resize as `width` / `height`. All three go through `applyStyleGroup` with a Tailwind class, so they show up in pending changes and in Copy as prompt.

`applyStyleGroup` is called with a single element on purpose. The `applyStyle` shortcut expands to `[element, ...getSimilarElements(element)]`, which is right for a color and wrong for a position: it would move every similar button at once.

Pass `movable={false}` to turn drag and handles off.

## Alignment guides

While the brush is active, hovering an element draws six viewport-spanning lines from its box: left, center and right (vertical), top, center and bottom (horizontal). Use them to check whether other elements share an edge or a midline.

The same guides stay on the selected element, so they keep tracking while you drag or resize. Center lines are dashed; edges are solid. Both use the kit’s hover blue.

Pass `guides={false}` to turn them off.

## Distances

With an element selected, hover another one. A line and a `12px` label show the gap between the same edges the guides use. Nested boxes show inset distances (padding-like).

- **Click the label** to write `margin` (or `padding` when the selection contains the hovered node) through `applyStyleGroup`.
- **Shift-click** writes `gap` on a flex or grid parent.

No modifier key. Alt is Option on Mac, so distances just appear.

## Parent and child

A click hits the innermost node: a tag, a heading, a quote — almost never the card wrapper that actually holds padding and radius.

- The path on the selection rect (`article.card › .tags › span.tag`) is the ancestry. Click a segment to jump there.
- **Escape** (no drag running) moves the selection one element up.
- **Enter** or **double-click** moves one element in, toward the node under the cursor.

The DOM does not change. Only `getSelectedElement()` does, so Move, Snap and the inspector all follow.

A one-line hint under the path: `⌘ free · esc parent · ↵ child`. During a drag it becomes `⌘ free · esc cancel`. On Windows / Linux the free key is Ctrl.

## This / All

Color and type writes in the package hit every similar button. Position already stays on the selected node.

When similar nodes exist, **This / All N** sits next to Rest / Hover / Focus. **All** is the default (package behavior). **This** restores the others after an inspector write so only the selected element keeps the preview.

## Tokens

When a color you apply matches a `:root` custom property (`--paper`, `--ink`, …), the pending change stores `var(--paper)` and the Tailwind class `bg-[var(--paper)]` instead of the computed hex. Copy as prompt then keeps the design token.

There is no token editor. The binding only preserves what is already a custom property.

## Rest / Hover / Focus

The same chrome as the path. **Rest** is the default inspector target. Switch to **Hover** or **Focus**, then restyle: those writes export as `hover:…` / `focus:…` utilities next to the rest style.

There is no Active / Disabled set in this version.

## Move the inspector

The package only lets you drag the collapsed paintbrush. With the kit open, grab the **Copy Edits** bar to move the inspector. The Style / Layout panel (and Settings) stay attached.

A short click still hits Copy Edits, delete, settings and close; the drag engages after 5px. Escape cancels a drag in progress. Closing the kit puts the panel back in the corner.

## Keyboard

| Key | Action |
| --- | --- |
| Click paintbrush | Arm / disarm the kit |
| Click element | Select |
| Drag selection | Move (`translate`) |
| Drag handle | Resize (`width` / `height`) |
| ⌘ / Ctrl (held) | Ignore snap |
| Shift + corner handle | Lock aspect ratio |
| Arrow | Nudge 1px |
| Shift + arrow | Nudge 10px |
| Escape during drag | Cancel move, resize or inspector drag |
| Escape (idle) | Select parent |
| Enter / double-click | Select child toward the cursor |
| Click path segment | Jump to that ancestor |
| Click distance label | Write margin or padding |
| Shift-click distance label | Write gap on the flex / grid parent |

## Svelte wiring

Two details make the binding work under SvelteKit. Skip either and the kit is silent.

### Dynamic import, not static

The package touches `document` on load. A static import pulls it into the SSR bundle, where it breaks. It is only loaded inside `onMount`:

```js
import('interface-kit').then(({ createInterfaceKit }) => {
	const controller = createInterfaceKit({ ...options, enabled: true });
	controller.mount();
});
```

That keeps the server bundle clean and lets the client load the kit as its own chunk.

### `enabled` has to be set explicitly

Without the flag the package calls its internal `resolveEnabled()`, which falls back to `process.env.NODE_ENV`. That is not reliably present in the browser, and the tool then renders nothing at all: container mounted, UI empty, no error anywhere.

```js
createInterfaceKit({ enabled: true });
```

The component still defaults `enabled` to `import.meta.env.DEV`, so production builds stay dark. The explicit `true` is what is passed into the package once that gate is open.

## Popover fix

**Symptom:** the color picker (and the border and shadow popovers) open as a completely unstyled fragment in the middle of the page.

**Cause:** InterfaceKit renders its UI into a shadow root, but Radix portals its popovers into `document.body`, i.e. out of the shadow root. The kit’s stylesheet does not reach them there.

This is not a Svelte problem. React runs the same shadow mount with the same portals and breaks the same way.

**Fix:** mirror the stylesheet into the light DOM, scoped strictly to the portal container with [`@scope`](https://developer.mozilla.org/en-US/docs/Web/CSS/@scope):

```js
style.textContent = `@scope ([data-radix-popper-content-wrapper]) {
${css.replaceAll(':root', ':scope')}
}`;
```

Two details carry this:

- **Without `@scope`**, Tailwind’s preflight would reset the entire host app, wrecking the very design you are trying to judge.
- **`:root` has to become `:scope`**, because `html` sits outside the scope. Otherwise every custom property, and with it every color, goes missing.

The package uses popper-based portals exclusively (no dialogs), so a single scope selector covers every popover it has.

Color / shadow / border still inherit a second look if the host app styles `[data-slot=popover-content]` globally (shadcn, bits-ui). Color wins via `!important` utilities; the others do not. The binding forces those portaled surfaces onto the kit’s `#2a2a2a` panel.

## Native selects

**Symptom:** Typeface (and any other kit `<select>`) opens the OS menu — a light system list on top of the dark inspector — instead of the Interface Craft popover used for color and shadow.

**Cause:** The package uses a native `<select>`. The picker is painted by the browser, not by the kit, and is not in the DOM, so neither the shadow stylesheet nor the portal mirror can restyle it.

**Fix:** intercept mousedown / keyboard on kit `<select>` elements and open a Craft listbox (`#2a2a2a`, 12px radius, same shadow as ShadeSelector). Choosing an option writes `select.value` and dispatches `change`, so the React handler still runs.

## Browser support

`@scope` needs Chrome 118+, Safari 17.4+ or Firefox 128+. The tool only ever runs in development, so that is not a constraint in practice.

## Verify

```bash
npm test
npm run check
```

Playwright checks against real Chrome (when you run them) cover:

- The color picker renders at the package’s own values: `bg #2a2a2a`, `radius 12px`, 240px wide
- Applying a color takes effect: `rgb(0, 0, 0)` becomes `rgb(240, 10, 10)`
- Host app styles stay untouched (font sizes, spacing, radii and backgrounds identical before and after mount)
- The server bundle does not contain the package
