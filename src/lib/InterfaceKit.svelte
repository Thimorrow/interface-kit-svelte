<script lang="ts">
	import { onMount } from 'svelte';
	import type { InterfaceKitController, InterfaceKitOptions } from 'interface-kit';

	// Set `enabled` explicitly: otherwise the package falls back to
	// process.env.NODE_ENV, which is not reliably present in the browser.
	let { enabled = import.meta.env.DEV, ...options }: InterfaceKitOptions = $props();

	const PORTAL_STYLE_ID = 'interface-kit-portal-styles';
	const RUNTIME_STYLE_ID = 'interface-kit-runtime-styles';

	/**
	 * The kit renders its UI into a shadow root, but Radix portals its popovers
	 * (color picker, shadow, border) into document.body, i.e. out of the shadow
	 * root where the kit's stylesheet no longer applies. Without this fix they
	 * show up as an unstyled fragment in the middle of the page.
	 *
	 * So we mirror the stylesheet into the light DOM, scoped strictly to the
	 * portal container so Tailwind's preflight never leaks into the host app.
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

		// Dynamic import: the package touches `document` on load, so it must
		// never end up in the SSR bundle.
		import('interface-kit').then(({ createInterfaceKit }) => {
			if (disposed) return;

			controller = createInterfaceKit({ ...options, enabled: true });
			controller.mount();

			// The shadow root only exists once React has mounted.
			observer = new MutationObserver(() => {
				const shadow = document.querySelector('[data-interface-kit]')?.shadowRoot;
				if (shadow && mirrorStylesForPortals(shadow)) {
					observer?.disconnect();
					observer = null;
				}
			});
			observer.observe(document.body, { childList: true, subtree: true });
		});

		return () => {
			disposed = true;
			observer?.disconnect();
			controller?.destroy();
			controller = null;
			document.getElementById(PORTAL_STYLE_ID)?.remove();
		};
	});
</script>
