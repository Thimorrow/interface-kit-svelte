<script lang="ts">
	const schritte = [
		{
			nr: '01',
			titel: 'Pinsel aktivieren',
			text: 'Oben rechts sitzt die Werkzeugleiste. Ein Klick auf den Pinsel schaltet den Auswahlmodus ein.'
		},
		{
			nr: '02',
			titel: 'Element auswählen',
			text: 'Fahre über die Seite. Jedes Element bekommt einen Rahmen samt Namen. Ein Klick wählt es aus.'
		},
		{
			nr: '03',
			titel: 'Änderungen mitnehmen',
			text: 'Schrift, Farbe, Abstände, Radius. Am Ende sammelt „Copy Edits" alles als fertigen Prompt.'
		}
	];

	const eigenschaften = [
		{ name: 'Typografie', wert: 'Schriftart, Größe, Laufweite, Zeilenhöhe' },
		{ name: 'Farbe', wert: 'Hintergrund, Text, Deckkraft, Tailwind-Raster' },
		{ name: 'Layout', wert: 'Breite, Höhe, Padding, Margin, Flex, Gap' },
		{ name: 'Effekte', wert: 'Rahmen, Radius, Schatten, Backdrop-Blur' }
	];

	let email = $state('');
	let gesendet = $state(false);
</script>

<div class="seite">
	<header class="kopf">
		<div class="wortmarke">
			<span class="marke-punkt" aria-hidden="true"></span>
			<span class="marke-text">InterfaceKit<span class="marke-schmal">/svelte</span></span>
		</div>
		<nav class="kopf-nav">
			<span class="pille">nur im Dev-Modus</span>
			<a href="https://github.com/joshpuckett/interfacekit">Original von Josh Puckett</a>
		</nav>
	</header>

	<main>
		<section class="hero">
			<p class="kicker">Visuelles Styling direkt im Browser</p>
			<h1>
				Klick auf ein Element.<br />
				<em>Ändere,</em> was dich stört.
			</h1>
			<p class="lead">
				Diese Seite ist eine Spielwiese. Alles, was du hier siehst, lässt sich mit InterfaceKit
				auswählen und umgestalten, ohne eine Zeile Code anzufassen. Die gesammelten Änderungen
				wandern als Prompt in die Zwischenablage.
			</p>
			<div class="hero-aktionen">
				<button class="knopf knopf-voll">Pinsel oben rechts</button>
				<button class="knopf knopf-leer">Alles zurücksetzen</button>
				<span class="hinweis">
					Tastenkürzel <kbd>Esc</kbd> hebt die Auswahl auf
				</span>
			</div>
		</section>

		<section class="schritte" aria-label="Anleitung">
			{#each schritte as schritt (schritt.nr)}
				<article class="schritt">
					<span class="schritt-nr">{schritt.nr}</span>
					<h3>{schritt.titel}</h3>
					<p>{schritt.text}</p>
				</article>
			{/each}
		</section>

		<section class="spielwiese">
			<div class="abschnitt-kopf">
				<h2>Spielwiese</h2>
				<p class="abschnitt-text">
					Verschiedene Bausteine, an denen sich das Werkzeug ausprobieren lässt.
				</p>
			</div>

			<div class="raster">
				<article class="karte karte-profil">
					<div class="avatar" aria-hidden="true">MK</div>
					<h3>Marlene Koch</h3>
					<p class="rolle">Design Engineer, Leipzig</p>
					<p class="zitat">
						„Ich beschreibe Änderungen nicht mehr in Worten. Ich zeige sie und lasse mir den Prompt
						geben."
					</p>
					<div class="marken">
						<span class="marke">Svelte 5</span>
						<span class="marke">Runen</span>
						<span class="marke">Shadow DOM</span>
					</div>
				</article>

				<article class="karte karte-preis">
					<p class="karte-label">Was es kostet</p>
					<p class="preis"><span class="preis-zahl">0</span><span class="preis-waehrung">€</span></p>
					<p class="preis-text">
						MIT-Lizenz, offener Quellcode. Läuft ausschließlich in deiner Entwicklungsumgebung und
						wird im Produktions-Build automatisch abgeschaltet.
					</p>
					<button class="knopf knopf-voll knopf-breit">npm install interface-kit</button>
				</article>

				<article class="karte karte-tabelle">
					<p class="karte-label">Was sich anpassen lässt</p>
					<table>
						<tbody>
							{#each eigenschaften as e (e.name)}
								<tr>
									<th scope="row">{e.name}</th>
									<td>{e.wert}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</article>

				<article class="karte karte-zahlen">
					<div class="zahl">
						<span class="zahl-wert">44&thinsp;KB</span>
						<span class="zahl-text">Kern ohne Oberfläche</span>
					</div>
					<div class="zahl">
						<span class="zahl-wert">0</span>
						<span class="zahl-text">Zeilen im Produktions-Bundle</span>
					</div>
					<div class="zahl">
						<span class="zahl-wert">1</span>
						<span class="zahl-text">Komponente zum Einbinden</span>
					</div>
				</article>

				<article class="karte karte-formular">
					<p class="karte-label">Formularelemente</p>
					<form
						onsubmit={(e) => {
							e.preventDefault();
							gesendet = true;
						}}
					>
						<label for="email">E-Mail für Neuigkeiten</label>
						<div class="feld-zeile">
							<input
								id="email"
								type="email"
								placeholder="du@beispiel.de"
								bind:value={email}
								required
							/>
							<button class="knopf knopf-voll" type="submit">Eintragen</button>
						</div>
						<p class="feld-hinweis" aria-live="polite">
							{gesendet ? 'Danke, notiert.' : 'Reine Demo, es wird nichts verschickt.'}
						</p>
					</form>
				</article>

				<article class="karte karte-notiz">
					<p class="karte-label">Randnotiz</p>
					<p>
						Die Oberfläche des Werkzeugs rendert in einen eigenen Shadow Root. Deine Stile und die
						des Werkzeugs kommen sich deshalb nicht in die Quere.
					</p>
					<code>&lt;InterfaceKit /&gt;</code>
				</article>
			</div>
		</section>
	</main>

	<footer class="fuss">
		<div>
			<p class="fuss-stark">InterfaceKit für Svelte</p>
			<p class="fuss-zart">
				Svelte-Anbindung für <a href="https://www.npmjs.com/package/interface-kit">interface-kit</a>.
			</p>
		</div>
		<p class="fuss-zart">
			Werkzeug und Oberfläche stammen von
			<a href="https://github.com/joshpuckett">Josh Puckett</a>. MIT-Lizenz.
		</p>
	</footer>
</div>

<style>
	.seite {
		max-width: var(--rand);
		margin: 0 auto;
		padding: 0 32px 96px;
	}

	/* Kopf */
	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding: 28px 0;
		border-bottom: 1px solid var(--linie);
		flex-wrap: wrap;
	}

	.wortmarke {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.marke-punkt {
		width: 11px;
		height: 11px;
		border-radius: 50%;
		background: var(--zinnober);
		box-shadow: 0 0 0 4px rgba(192, 75, 42, 0.16);
	}

	.marke-text {
		font-family: var(--serif);
		font-weight: 600;
		font-size: 19px;
		letter-spacing: -0.01em;
	}

	.marke-schmal {
		color: var(--tinte-zart);
		font-weight: 400;
	}

	.kopf-nav {
		display: flex;
		align-items: center;
		gap: 18px;
		font-size: 15px;
	}

	.pille {
		font-family: var(--mono);
		font-size: 12px;
		letter-spacing: 0.04em;
		padding: 5px 11px;
		border-radius: 999px;
		background: rgba(29, 75, 71, 0.1);
		color: var(--petrol);
	}

	/* Hero */
	.hero {
		padding: 88px 0 72px;
		max-width: 780px;
	}

	.kicker {
		font-family: var(--mono);
		font-size: 12px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--zinnober);
		margin-bottom: 22px;
	}

	.hero h1 {
		font-size: clamp(46px, 8vw, 92px);
		font-weight: 500;
		font-variation-settings: 'SOFT' 20;
	}

	.hero h1 em {
		font-style: italic;
		color: var(--zinnober);
		font-weight: 400;
	}

	.lead {
		margin-top: 28px;
		font-size: 21px;
		line-height: 1.55;
		color: var(--tinte-weich);
		max-width: 62ch;
	}

	.hero-aktionen {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-top: 38px;
		flex-wrap: wrap;
	}

	.hinweis {
		font-size: 15px;
		color: var(--tinte-zart);
	}

	kbd {
		font-family: var(--mono);
		font-size: 12px;
		padding: 3px 7px;
		border-radius: 5px;
		border: 1px solid var(--linie);
		background: rgba(255, 255, 255, 0.6);
	}

	/* Knöpfe */
	.knopf {
		font-family: var(--text);
		font-size: 16px;
		padding: 12px 22px;
		border-radius: 10px;
		border: 1px solid transparent;
		cursor: pointer;
		transition:
			transform 140ms cubic-bezier(0.2, 0.8, 0.3, 1),
			box-shadow 140ms ease,
			background-color 140ms ease;
	}

	.knopf-voll {
		background: var(--tinte);
		color: var(--papier);
		box-shadow: 0 1px 2px rgba(23, 19, 15, 0.28);
	}

	.knopf-voll:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 16px rgba(23, 19, 15, 0.22);
	}

	.knopf-leer {
		background: transparent;
		border-color: var(--linie);
		color: var(--tinte);
	}

	.knopf-leer:hover {
		background: rgba(255, 255, 255, 0.5);
	}

	.knopf-breit {
		width: 100%;
		font-family: var(--mono);
		font-size: 14px;
	}

	/* Schritte */
	.schritte {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		background: var(--linie);
		border: 1px solid var(--linie);
		border-radius: 14px;
		overflow: hidden;
	}

	.schritt {
		background: var(--papier);
		padding: 32px 28px 34px;
	}

	.schritt-nr {
		font-family: var(--mono);
		font-size: 12px;
		color: var(--zinnober);
		letter-spacing: 0.1em;
	}

	.schritt h3 {
		font-size: 23px;
		font-weight: 600;
		margin: 14px 0 10px;
	}

	.schritt p {
		font-size: 16px;
		color: var(--tinte-weich);
		line-height: 1.55;
	}

	/* Spielwiese */
	.spielwiese {
		padding-top: 96px;
	}

	.abschnitt-kopf {
		display: flex;
		align-items: baseline;
		gap: 20px;
		padding-bottom: 26px;
		border-bottom: 1px solid var(--linie);
		flex-wrap: wrap;
	}

	.abschnitt-kopf h2 {
		font-size: 38px;
		font-weight: 500;
	}

	.abschnitt-text {
		color: var(--tinte-zart);
		font-size: 17px;
	}

	.raster {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 20px;
		margin-top: 34px;
	}

	.karte {
		background: rgba(255, 253, 250, 0.72);
		border: 1px solid var(--linie);
		border-radius: 16px;
		padding: 28px;
		backdrop-filter: blur(3px);
	}

	.karte-profil {
		grid-column: span 3;
	}
	.karte-preis {
		grid-column: span 3;
	}
	.karte-tabelle {
		grid-column: span 4;
	}
	.karte-zahlen {
		grid-column: span 2;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 22px;
	}
	.karte-formular {
		grid-column: span 3;
	}
	.karte-notiz {
		grid-column: span 3;
	}

	.karte-label {
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.13em;
		text-transform: uppercase;
		color: var(--tinte-zart);
		margin-bottom: 18px;
	}

	.avatar {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background: var(--petrol);
		color: var(--papier);
		display: grid;
		place-items: center;
		font-family: var(--serif);
		font-size: 18px;
		letter-spacing: 0.02em;
		margin-bottom: 18px;
	}

	.karte-profil h3 {
		font-size: 26px;
		font-weight: 600;
	}

	.rolle {
		color: var(--tinte-zart);
		font-size: 16px;
		margin-top: 4px;
	}

	.zitat {
		margin-top: 18px;
		font-size: 19px;
		font-style: italic;
		line-height: 1.5;
		color: var(--tinte-weich);
		border-left: 2px solid var(--zinnober);
		padding-left: 16px;
	}

	.marken {
		display: flex;
		gap: 8px;
		margin-top: 22px;
		flex-wrap: wrap;
	}

	.marke {
		font-family: var(--mono);
		font-size: 12px;
		padding: 5px 10px;
		border-radius: 7px;
		background: var(--papier-tief);
		color: var(--tinte-weich);
	}

	.preis {
		display: flex;
		align-items: flex-start;
		gap: 4px;
		font-family: var(--serif);
		line-height: 1;
	}

	.preis-zahl {
		font-size: 82px;
		font-weight: 500;
	}

	.preis-waehrung {
		font-size: 30px;
		color: var(--tinte-zart);
		margin-top: 8px;
	}

	.preis-text {
		margin: 18px 0 24px;
		color: var(--tinte-weich);
		font-size: 16px;
		line-height: 1.55;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	tr {
		border-top: 1px solid var(--linie);
	}

	tr:first-child {
		border-top: none;
	}

	th,
	td {
		text-align: left;
		padding: 13px 0;
		font-size: 16px;
	}

	th {
		font-family: var(--serif);
		font-weight: 600;
		width: 34%;
	}

	td {
		color: var(--tinte-weich);
	}

	.zahl-wert {
		display: block;
		font-family: var(--serif);
		font-size: 34px;
		font-weight: 500;
		line-height: 1.1;
	}

	.zahl-text {
		font-size: 14px;
		color: var(--tinte-zart);
	}

	label {
		display: block;
		font-size: 15px;
		color: var(--tinte-weich);
		margin-bottom: 9px;
	}

	.feld-zeile {
		display: flex;
		gap: 10px;
	}

	input {
		flex: 1;
		min-width: 0;
		font-family: var(--text);
		font-size: 16px;
		padding: 12px 14px;
		border-radius: 10px;
		border: 1px solid var(--linie);
		background: rgba(255, 255, 255, 0.75);
		color: var(--tinte);
	}

	input:focus-visible {
		outline: 2px solid var(--petrol);
		outline-offset: 1px;
	}

	.feld-hinweis {
		margin-top: 11px;
		font-size: 14px;
		color: var(--tinte-zart);
	}

	.karte-notiz p {
		color: var(--tinte-weich);
		font-size: 16px;
		line-height: 1.55;
	}

	code {
		display: inline-block;
		margin-top: 18px;
		font-family: var(--mono);
		font-size: 14px;
		padding: 8px 12px;
		border-radius: 8px;
		background: var(--papier-tief);
	}

	/* Fuß */
	.fuss {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 24px;
		margin-top: 96px;
		padding-top: 28px;
		border-top: 1px solid var(--linie);
		flex-wrap: wrap;
	}

	.fuss-stark {
		font-family: var(--serif);
		font-weight: 600;
		font-size: 17px;
	}

	.fuss-zart {
		color: var(--tinte-zart);
		font-size: 15px;
	}

	@media (max-width: 900px) {
		.schritte {
			grid-template-columns: 1fr;
		}
		.raster > .karte {
			grid-column: span 6;
		}
	}

	@media (max-width: 620px) {
		.seite {
			padding: 0 20px 64px;
		}
		.hero {
			padding: 56px 0 48px;
		}
		.feld-zeile {
			flex-direction: column;
		}
	}
</style>
