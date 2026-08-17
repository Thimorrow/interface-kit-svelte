<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import InterfaceKit from '$lib/InterfaceKit.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>InterfaceKit für Svelte</title>
	<meta
		name="description"
		content="InterfaceKit in SvelteKit: Elemente im Browser auswählen, Stile anpassen, Änderungen als Prompt kopieren."
	/>
</svelte:head>

{@render children()}

<!-- Läuft nur im Dev-Modus und rendert in einen eigenen Shadow Root. -->
<InterfaceKit />
