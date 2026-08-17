<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import InterfaceKit from '$lib/InterfaceKit.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>InterfaceKit for Svelte</title>
	<meta
		name="description"
		content="Pick an element, restyle it in the browser, copy the changes as a prompt. InterfaceKit wired into SvelteKit."
	/>
</svelte:head>

{@render children()}

<!-- Dev-only. Renders into its own shadow root. -->
<InterfaceKit />
