<script lang="ts">
	import { onMount } from 'svelte';
	import type { InterfaceKitController, InterfaceKitOptions } from 'interface-kit';

	// `enabled` explizit setzen: das Paket würde sonst auf process.env.NODE_ENV
	// zurückfallen, das im Browser nicht zuverlässig existiert.
	let { enabled = import.meta.env.DEV, ...options }: InterfaceKitOptions = $props();

	const PORTAL_STYLE_ID = 'interface-kit-portal-styles';
	const RUNTIME_STYLE_ID = 'interface-kit-runtime-styles';

	/**
	 * Das Kit rendert sein UI in einen Shadow Root, seine Popover (Farbwähler,
	 * Schatten, Font-Auswahl) portalt Radix aber nach document.body — also aus
	 * dem Shadow heraus, wo das Stylesheet des Kits nicht mehr greift. Ohne
	 * diesen Fix erscheinen sie als ungestyltes Fragment auf der Seite.
	 *
	 * Wir spiegeln das Stylesheet deshalb ins Light-DOM, per @scope streng auf
	 * den Portal-Container begrenzt, damit Tailwinds Preflight nicht auf die
	 * eigene App durchschlägt.
	 */
	function mirrorStylesForPortals(shadow: ShadowRoot) {
		if (document.getElementById(PORTAL_STYLE_ID)) return true;

		const source = shadow.getElementById(RUNTIME_STYLE_ID);
		const css = source?.textContent;
		if (!css) return false;

		const style = document.createElement('style');
		style.id = PORTAL_STYLE_ID;
		// :root existiert innerhalb des Scopes nicht — auf den Scope-Root
		// umbiegen, sonst fehlen alle Custom Properties (und damit die Farben).
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

		// Dynamischer Import: das Paket greift auf `document` zu und darf
		// deshalb nie ins SSR-Bundle geraten.
		import('interface-kit').then(({ createInterfaceKit }) => {
			if (disposed) return;

			controller = createInterfaceKit({ ...options, enabled: true });
			controller.mount();

			// Der Shadow Root entsteht erst, wenn React gemountet hat.
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
