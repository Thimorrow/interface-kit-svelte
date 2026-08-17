<script lang="ts">
	const steps = [
		{
			n: '01',
			title: 'Arm the brush',
			body: 'The toolbar sits in the top corner. One click puts the page into selection mode.'
		},
		{
			n: '02',
			title: 'Point at anything',
			body: 'Hover to outline an element and read its name. Click to lock it and open the inspector.'
		},
		{
			n: '03',
			title: 'Take the diff with you',
			body: 'Every tweak is recorded. Copy Edits hands you the whole set as a prompt for your agent.'
		}
	];

	const properties = [
		{ group: 'Type', values: 'Family, size, weight, leading, tracking, align' },
		{ group: 'Color', values: 'Background, text, opacity, Tailwind snapping' },
		{ group: 'Layout', values: 'Width, height, padding, margin, flex, gap' },
		{ group: 'Effects', values: 'Border, radius, shadow, backdrop blur' }
	];

	const plans = [
		{ label: 'Core engine', value: '44', unit: 'KB' },
		{ label: 'Shipped to production', value: '0', unit: 'bytes' },
		{ label: 'Components to mount', value: '1', unit: '' }
	];

	let email = $state('');
	let sent = $state(false);
	let notify = $state(true);
</script>

<div class="page">
	<header class="topbar rise" style="--i: 0">
		<div class="brand">
			<span class="brand-mark" aria-hidden="true"></span>
			<span class="brand-name">InterfaceKit</span>
			<span class="brand-slash">/</span>
			<span class="brand-target">svelte</span>
		</div>
		<nav class="topnav">
			<span class="chip">dev only</span>
			<a href="https://github.com/joshpuckett/interfacekit">Built by Josh Puckett</a>
		</nav>
	</header>

	<main>
		<section class="hero">
			<div class="hero-copy">
				<p class="eyebrow rise" style="--i: 1">Visual styling, in the running app</p>
				<h1 class="rise" style="--i: 2">
					Stop describing<br />
					the change.<br />
					<em>Point at it.</em>
				</h1>
				<p class="lead rise" style="--i: 3">
					This page is a playground. Every heading, card and button below can be selected and
					restyled in place, without touching a line of code. When you are done, the accumulated
					diff goes to your clipboard as a prompt.
				</p>
				<div class="hero-actions rise" style="--i: 4">
					<button class="btn btn-solid">Open the brush, top right</button>
					<code class="cmd">npm i interface-kit</code>
				</div>
			</div>

			<!-- Static mock of what the tool looks like in use -->
			<div class="hero-visual rise" style="--i: 5" aria-hidden="true">
				<div class="mock">
					<span class="mock-tag">section.pricing</span>
					<div class="mock-card">
						<p class="mock-label">Team</p>
						<p class="mock-price tabular">$24<span>/mo</span></p>
						<p class="mock-note">Everything in Solo, plus shared workspaces.</p>
					</div>
				</div>
				<div class="mock-panel">
					<div class="mock-panel-head">
						<span>Style</span>
						<span class="mock-panel-tab">Layout</span>
					</div>
					<div class="mock-row">
						<span>Radius</span>
						<span class="mock-val tabular">16px</span>
					</div>
					<div class="mock-row">
						<span>Background</span>
						<span class="mock-swatch-wrap">
							<span class="mock-swatch"></span>
							<span class="mock-val tabular">F4F4F6</span>
						</span>
					</div>
					<div class="mock-row">
						<span>Shadow</span>
						<span class="mock-val tabular">0 1 2</span>
					</div>
					<div class="mock-row mock-row-active">
						<span>Padding</span>
						<span class="mock-val tabular">28px</span>
					</div>
				</div>
			</div>
		</section>

		<section class="steps">
			{#each steps as step, i (step.n)}
				<article class="step rise" style="--i: {6 + i}">
					<span class="step-n mono">{step.n}</span>
					<h3>{step.title}</h3>
					<p>{step.body}</p>
				</article>
			{/each}
		</section>

		<section class="block">
			<div class="block-head">
				<h2>Playground</h2>
				<p class="block-sub">
					A spread of components to aim at. Nothing here is real, all of it is selectable.
				</p>
			</div>

			<div class="grid">
				<article class="card card-person">
					<div class="avatar" aria-hidden="true">RA</div>
					<h3>Rina Adeyemi</h3>
					<p class="muted">Design engineer, Rotterdam</p>
					<blockquote>
						I used to write three paragraphs explaining a spacing change. Now I nudge it and paste
						the diff.
					</blockquote>
					<div class="tags">
						<span class="tag">Svelte 5</span>
						<span class="tag">Runes</span>
						<span class="tag">Shadow DOM</span>
					</div>
				</article>

				<article class="card card-stats">
					<p class="card-label mono">By the numbers</p>
					<dl>
						{#each plans as plan (plan.label)}
							<div class="stat">
								<dt>{plan.label}</dt>
								<dd class="tabular">{plan.value}<span class="unit">{plan.unit}</span></dd>
							</div>
						{/each}
					</dl>
				</article>

				<article class="card card-table">
					<p class="card-label mono">What you can change</p>
					<table>
						<tbody>
							{#each properties as p (p.group)}
								<tr>
									<th scope="row">{p.group}</th>
									<td>{p.values}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</article>

				<article class="card card-form">
					<p class="card-label mono">Form controls</p>
					<form
						onsubmit={(e) => {
							e.preventDefault();
							sent = true;
						}}
					>
						<label for="email">Get notified about releases</label>
						<div class="field-row">
							<input id="email" type="email" placeholder="you@studio.com" bind:value={email} required />
							<button class="btn btn-solid" type="submit">Subscribe</button>
						</div>

						<label class="switch">
							<input type="checkbox" bind:checked={notify} />
							<span class="switch-track"><span class="switch-thumb"></span></span>
							<span class="switch-text">Also send the changelog</span>
						</label>

						<p class="field-note" aria-live="polite">
							{sent ? 'Noted. Nothing was actually sent.' : 'Demo only, nothing leaves the page.'}
						</p>
					</form>
				</article>

				<article class="card card-code">
					<div class="code-copy">
						<p class="card-label mono">Mount it once</p>
						<h3>One component, in your root layout.</h3>
						<p class="muted small">
							It renders nothing itself, loads only in the browser and switches off in production
							builds. The engine is imported dynamically so it never reaches the server bundle.
						</p>
					</div>
					<pre><code>{`<script>
  import InterfaceKit from '$lib/InterfaceKit.svelte';
<`}/script{`>

{@render children()}

<InterfaceKit />`}</code></pre>
				</article>
			</div>
		</section>
	</main>

	<footer class="foot">
		<div class="foot-left">
			<p class="foot-strong">InterfaceKit for Svelte</p>
			<p class="muted small">
				A Svelte 5 binding for <a href="https://www.npmjs.com/package/interface-kit">interface-kit</a
				>, plus a fix for its popovers inside the shadow root.
			</p>
		</div>
		<p class="muted small">
			The tool, its interface and engine are by
			<a href="https://github.com/joshpuckett">Josh Puckett</a>. MIT licensed.
		</p>
	</footer>
</div>

<style>
	.page {
		max-width: var(--edge);
		margin: 0 auto;
		padding: 0 40px 120px;
	}

	.mono {
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.muted {
		color: var(--ink-faint);
	}

	.small {
		font-size: 14px;
	}

	/* ---- Topbar ---- */
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		height: 72px;
		border-bottom: 1px solid var(--hairline);
		flex-wrap: wrap;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 7px;
		font-weight: 600;
		font-size: 15px;
		letter-spacing: -0.01em;
	}

	.brand-mark {
		width: 9px;
		height: 9px;
		border-radius: 2px;
		background: var(--accent);
		margin-right: 3px;
		box-shadow: 0 0 0 3px var(--accent-wash);
	}

	.brand-slash,
	.brand-target {
		color: var(--ink-faint);
		font-weight: 500;
	}

	.topnav {
		display: flex;
		align-items: center;
		gap: 20px;
		font-size: 14px;
	}

	.chip {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--signal);
		padding: 4px 9px;
		border: 1px solid rgba(15, 122, 78, 0.24);
		border-radius: 5px;
	}

	/* ---- Hero ---- */
	.hero {
		display: grid;
		grid-template-columns: 1.05fr 0.95fr;
		gap: 72px;
		align-items: center;
		padding: 104px 0 96px;
	}

	.eyebrow {
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: var(--accent);
		margin-bottom: 26px;
	}

	h1 {
		font-family: var(--display);
		font-size: clamp(52px, 6.4vw, 88px);
		letter-spacing: -0.025em;
	}

	h1 em {
		font-style: italic;
		color: var(--ink-faint);
	}

	.lead {
		margin-top: 28px;
		font-size: 18px;
		line-height: 1.6;
		color: var(--ink-soft);
		max-width: 50ch;
	}

	.hero-actions {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-top: 36px;
		flex-wrap: wrap;
	}

	.cmd {
		font-family: var(--mono);
		font-size: 13px;
		color: var(--ink-soft);
		padding: 11px 14px;
		border: 1px solid var(--hairline);
		border-radius: 9px;
		background: var(--paper-sunk);
	}

	/* ---- Buttons ---- */
	.btn {
		font-family: var(--ui);
		font-size: 14px;
		font-weight: 600;
		padding: 12px 20px;
		border-radius: 9px;
		border: 1px solid transparent;
		cursor: pointer;
		transition:
			transform 180ms var(--ease),
			box-shadow 180ms var(--ease),
			background-color 180ms var(--ease);
	}

	.btn-solid {
		background: var(--ink);
		color: var(--paper);
		box-shadow:
			0 1px 1px rgba(10, 10, 11, 0.16),
			0 4px 12px rgba(10, 10, 11, 0.1);
	}

	.btn-solid:hover {
		transform: translateY(-1px);
		box-shadow:
			0 1px 1px rgba(10, 10, 11, 0.2),
			0 10px 24px rgba(10, 10, 11, 0.16);
	}

	.btn-solid:active {
		transform: translateY(0);
	}

	.btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* ---- Hero visual ---- */
	.hero-visual {
		position: relative;
		display: flex;
		justify-content: flex-end;
		align-items: flex-start;
		gap: 18px;
		padding: 12px 0;
	}

	.mock {
		position: relative;
		flex: 1;
	}

	.mock-tag {
		position: absolute;
		top: -11px;
		left: 10px;
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.05em;
		color: #fff;
		background: var(--accent);
		padding: 2px 7px;
		border-radius: 4px;
	}

	.mock-card {
		border: 1.5px solid var(--accent);
		border-radius: 14px;
		background: #fff;
		padding: 28px 26px 30px;
		box-shadow:
			0 0 0 4px var(--accent-wash),
			0 18px 40px -22px rgba(10, 10, 11, 0.4);
	}

	.mock-label {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}

	.mock-price {
		font-family: var(--display);
		font-size: 46px;
		line-height: 1.1;
		margin-top: 10px;
	}

	.mock-price span {
		font-family: var(--ui);
		font-size: 14px;
		color: var(--ink-faint);
		margin-left: 3px;
	}

	.mock-note {
		margin-top: 8px;
		font-size: 14px;
		color: var(--ink-soft);
	}

	.mock-panel {
		width: 186px;
		flex: none;
		border-radius: 12px;
		background: #232326;
		padding: 8px;
		box-shadow: 0 20px 40px -20px rgba(10, 10, 11, 0.55);
	}

	.mock-panel-head {
		display: flex;
		gap: 4px;
		font-size: 11px;
		font-weight: 600;
		color: #f2f2f4;
		margin-bottom: 6px;
	}

	.mock-panel-head span {
		flex: 1;
		text-align: center;
		padding: 5px 0;
		border-radius: 6px;
		background: #313136;
	}

	.mock-panel-tab {
		background: transparent !important;
		color: #85858f;
	}

	.mock-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 7px 9px;
		border-radius: 7px;
		font-size: 11px;
		color: #a7a7b0;
	}

	.mock-row-active {
		background: #313136;
		color: #f2f2f4;
	}

	.mock-val {
		font-family: var(--mono);
		font-size: 10.5px;
		color: #e6e6ea;
	}

	.mock-swatch-wrap {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.mock-swatch {
		width: 11px;
		height: 11px;
		border-radius: 3px;
		background: var(--paper-sunk);
	}

	/* ---- Steps ---- */
	.steps {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border-top: 1px solid var(--hairline);
	}

	.step {
		padding: 34px 34px 38px 0;
		border-right: 1px solid var(--hairline);
	}

	.step:not(:first-child) {
		padding-left: 34px;
	}

	.step:last-child {
		border-right: none;
	}

	.step-n {
		color: var(--accent);
	}

	.step h3 {
		font-family: var(--display);
		font-size: 25px;
		margin: 14px 0 9px;
	}

	.step p {
		font-size: 15px;
		color: var(--ink-soft);
	}

	/* ---- Playground ---- */
	.block {
		padding-top: 110px;
	}

	.block-head {
		display: flex;
		align-items: baseline;
		gap: 22px;
		padding-bottom: 24px;
		border-bottom: 1px solid var(--hairline);
		flex-wrap: wrap;
	}

	.block-head h2 {
		font-family: var(--display);
		font-size: 40px;
	}

	.block-sub {
		color: var(--ink-faint);
		font-size: 15px;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 18px;
		margin-top: 32px;
	}

	.card {
		border: 1px solid var(--hairline);
		border-radius: 14px;
		background: #fff;
		padding: 26px;
		transition: box-shadow 220ms var(--ease);
	}

	.card:hover {
		box-shadow: 0 12px 32px -22px rgba(10, 10, 11, 0.5);
	}

	.card-person {
		grid-column: span 4;
		display: flex;
		flex-direction: column;
	}
	.card-stats {
		grid-column: span 2;
	}
	.card-table {
		grid-column: span 3;
	}
	.card-form {
		grid-column: span 3;
	}
	.card-code {
		grid-column: span 6;
		display: grid;
		grid-template-columns: 0.85fr 1.15fr;
		gap: 34px;
		align-items: center;
	}

	.code-copy h3 {
		font-family: var(--display);
		font-size: 26px;
		margin-bottom: 12px;
	}

	.code-copy .card-label {
		margin-bottom: 14px;
	}

	.card-label {
		color: var(--ink-faint);
		margin-bottom: 18px;
	}

	.avatar {
		width: 46px;
		height: 46px;
		border-radius: 11px;
		background: var(--ink);
		color: var(--paper);
		display: grid;
		place-items: center;
		font-size: 14px;
		font-weight: 600;
		letter-spacing: 0.02em;
		margin-bottom: 18px;
	}

	.card-person h3 {
		font-family: var(--display);
		font-size: 27px;
	}

	blockquote {
		margin: 18px 0 0;
		padding-left: 16px;
		border-left: 2px solid var(--accent);
		font-family: var(--display);
		font-size: 20px;
		line-height: 1.4;
		color: var(--ink-soft);
	}

	.tags {
		display: flex;
		gap: 7px;
		/* Pin to the bottom so the card fills its grid row cleanly */
		margin-top: auto;
		padding-top: 24px;
		flex-wrap: wrap;
	}

	.tag {
		font-family: var(--mono);
		font-size: 11px;
		padding: 4px 9px;
		border-radius: 6px;
		background: var(--paper-sunk);
		color: var(--ink-soft);
	}

	dl {
		margin: 0;
	}

	.stat {
		padding: 14px 0;
		border-top: 1px solid var(--hairline);
	}

	.stat:first-child {
		border-top: none;
		padding-top: 0;
	}

	dt {
		font-size: 13px;
		color: var(--ink-faint);
	}

	dd {
		margin: 3px 0 0;
		font-family: var(--display);
		font-size: 32px;
		line-height: 1.1;
	}

	.unit {
		font-family: var(--ui);
		font-size: 13px;
		font-weight: 500;
		color: var(--ink-faint);
		margin-left: 5px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	tr {
		border-top: 1px solid var(--hairline);
	}

	tr:first-child {
		border-top: none;
	}

	th,
	td {
		text-align: left;
		padding: 12px 0;
		font-size: 14px;
	}

	th {
		width: 32%;
		font-weight: 600;
	}

	td {
		color: var(--ink-soft);
	}

	label {
		display: block;
		font-size: 13px;
		color: var(--ink-faint);
		margin-bottom: 9px;
	}

	.field-row {
		display: flex;
		gap: 9px;
	}

	input[type='email'] {
		flex: 1;
		min-width: 0;
		font-family: var(--ui);
		font-size: 14px;
		padding: 12px 13px;
		border: 1px solid var(--hairline-strong);
		border-radius: 9px;
		background: var(--paper);
		color: var(--ink);
		transition:
			border-color 160ms var(--ease),
			box-shadow 160ms var(--ease);
	}

	input[type='email']:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-wash);
	}

	/* Switch */
	.switch {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 20px 0 0;
		cursor: pointer;
		font-size: 14px;
		color: var(--ink-soft);
	}

	.switch input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.switch-track {
		width: 34px;
		height: 20px;
		border-radius: 999px;
		background: var(--hairline-strong);
		padding: 2px;
		transition: background-color 200ms var(--ease);
		flex: none;
	}

	.switch-thumb {
		display: block;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 1px 2px rgba(10, 10, 11, 0.3);
		transition: transform 220ms var(--ease);
	}

	.switch input:checked + .switch-track {
		background: var(--accent);
	}

	.switch input:checked + .switch-track .switch-thumb {
		transform: translateX(14px);
	}

	.switch input:focus-visible + .switch-track {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.switch-text {
		margin: 0;
	}

	.field-note {
		margin-top: 14px;
		font-size: 13px;
		color: var(--ink-faint);
	}

	/* Code card */
	pre {
		margin: 0;
		padding: 20px 22px;
		border-radius: 11px;
		background: var(--ink);
		overflow-x: auto;
	}

	pre code {
		font-family: var(--mono);
		font-size: 13px;
		line-height: 1.7;
		color: #e6e6ea;
		white-space: pre;
	}


	/* ---- Footer ---- */
	.foot {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 24px;
		margin-top: 110px;
		padding-top: 26px;
		border-top: 1px solid var(--hairline);
		flex-wrap: wrap;
	}

	.foot-strong {
		font-weight: 600;
		font-size: 15px;
	}

	.foot-left .muted {
		margin-top: 4px;
		max-width: 52ch;
	}

	/* ---- Responsive ---- */
	@media (max-width: 1000px) {
		.hero {
			grid-template-columns: 1fr;
			gap: 56px;
			padding: 72px 0 80px;
		}
		.hero-visual {
			justify-content: flex-start;
		}
		.steps {
			grid-template-columns: 1fr;
		}
		.step {
			border-right: none;
			border-bottom: 1px solid var(--hairline);
			padding: 28px 0 30px;
		}
		.step:not(:first-child) {
			padding-left: 0;
		}
		.step:last-child {
			border-bottom: none;
		}
		.grid > .card {
			grid-column: span 6;
		}
		.card-code {
			grid-template-columns: 1fr;
			gap: 24px;
		}
	}

	@media (max-width: 620px) {
		.page {
			padding: 0 20px 80px;
		}
		.hero-visual {
			flex-direction: column;
		}
		.mock-panel {
			width: 100%;
		}
		.field-row {
			flex-direction: column;
		}
	}
</style>
