<script lang="ts">
	import { onMount } from 'svelte';
	import type { InterfaceKitController, InterfaceKitOptions } from 'interface-kit';
	import { enableAlignmentGuides } from './alignmentGuides.js';
	import { enableCraftSelect } from './craftSelect.js';
	import { enableDistanceGuides } from './distanceGuides.js';
	import { enableInspectorDrag } from './inspectorDrag.js';
	import { enableMoveSelected } from './moveSelected.js';
	import { enableSelectAncestry } from './selectAncestry.js';
	import { enableStyleState } from './styleState.js';

	// Set `enabled` explicitly: otherwise the package falls back to
	// process.env.NODE_ENV, which is not reliably present in the browser.
	// `movable` and `guides` are our own additions, not part of
	// InterfaceKitOptions, so they must be destructured out before
	// `...options` is passed to the package.
	// When `movable` is true it also draws resize handles on the selection rect.
	let {
		enabled = import.meta.env.DEV,
		movable = true,
		guides = true,
		...options
	}: InterfaceKitOptions & { movable?: boolean; guides?: boolean } = $props();

	const PORTAL_STYLE_ID = 'interface-kit-portal-styles';
	const RUNTIME_STYLE_ID = 'interface-kit-runtime-styles';

	/**
	 * The kit renders its UI into a shadow root, but Radix portals its popovers
	 * (color picker, shadow, border) into document.body, i.e. out of the shadow
	 * root where the kit's stylesheet no longer applies. Without this fix they
	 * show up as an unstyled fragment in the middle of the page — or, in a host
	 * app that styles [data-slot=popover-content], as that app's popover look.
	 *
	 * So we mirror the stylesheet into the light DOM, scoped strictly to the
	 * portal container so Tailwind's preflight never leaks into the host app.
	 * Native <select> pickers (Typeface) are swapped for a Craft listbox in
	 * enableCraftSelect: those never enter the DOM, so CSS cannot restyle them.
	 */
	function mirrorStylesForPortals(shadow: ShadowRoot) {
		if (document.getElementById(PORTAL_STYLE_ID)) return true;

		const source = shadow.getElementById(RUNTIME_STYLE_ID);
		const css = source?.textContent;
		if (!css) return false;

		const style = document.createElement('style');
		style.id = PORTAL_STYLE_ID;
		// :root does not match inside the scope, so point it at the scope root.
		// Otherwise every custom property, and with it every color, goes missing.
		style.textContent = `@scope ([data-radix-popper-content-wrapper]) {\n${css.replaceAll(
			':root',
			':scope'
		)}\n}`;
		document.head.appendChild(style);
		return true;
	}

	onMount(() => {
		if (!enabled) return;

		let controller: InterfaceKitController | null = null;
		let disposed = false;
		let observer: MutationObserver | null = null;
		let disposeMoveSelected: (() => void) | null = null;
		let disposeInspectorDrag: (() => void) | null = null;
		let disposeAlignmentGuides: (() => void) | null = null;
		let disposeDistanceGuides: (() => void) | null = null;
		let disposeSelectAncestry: (() => void) | null = null;
		let disposeStyleState: (() => void) | null = null;
		let disposeCraftSelect: (() => void) | null = null;
		const doc = options.ownerDocument ?? document;

		// Dynamic import: the package touches `document` on load, so it must
		// never end up in the SSR bundle.
		import('interface-kit').then(({ createInterfaceKit }) => {
			if (disposed) return;

			controller = createInterfaceKit({ ...options, enabled: true });
			controller.mount();

			if (movable) {
				disposeMoveSelected = enableMoveSelected(controller, doc);
			}
			// Before selectAncestry so Escape can cancel a panel drag without
			// walking the selection up — both listen on window capture.
			disposeInspectorDrag = enableInspectorDrag(controller, doc);
			if (guides) {
				disposeAlignmentGuides = enableAlignmentGuides(controller, doc);
			}
			disposeDistanceGuides = enableDistanceGuides(controller, doc);
			disposeSelectAncestry = enableSelectAncestry(controller, doc);
			disposeStyleState = enableStyleState(controller, doc);
			disposeCraftSelect = enableCraftSelect(doc);

			// The shadow root only exists once React has mounted.
			observer = new MutationObserver(() => {
				const host = [...document.querySelectorAll('[data-interface-kit]')].find(
					(el) => el.shadowRoot
				);
				if (host?.shadowRoot && mirrorStylesForPortals(host.shadowRoot)) {
					observer?.disconnect();
					observer = null;
				}
			});
			observer.observe(document.body, { childList: true, subtree: true });
		});

		return () => {
			disposed = true;
			observer?.disconnect();
			disposeMoveSelected?.();
			disposeInspectorDrag?.();
			disposeAlignmentGuides?.();
			disposeDistanceGuides?.();
			disposeSelectAncestry?.();
			disposeStyleState?.();
			disposeCraftSelect?.();
			controller?.destroy();
			controller = null;
			document.getElementById(PORTAL_STYLE_ID)?.remove();
		};
	});
</script>
