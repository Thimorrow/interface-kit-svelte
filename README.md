# InterfaceKit für Svelte

[InterfaceKit](https://www.npmjs.com/package/interface-kit) ist ein visuelles Design-Werkzeug: Element im Browser anklicken, Stile anpassen, Änderungen als fertigen Prompt kopieren. Das Paket wird als React-Integration ausgeliefert. Dieses Repo zeigt, wie es sich in **SvelteKit** einbinden lässt, plus einen Fix für ein Problem mit den Popover-Fenstern.

> **English:** InterfaceKit ships with a React binding. This repo provides a Svelte 5 wrapper plus a fix for its popovers breaking inside the Shadow DOM. All credit for the tool itself goes to [Josh Puckett](https://github.com/joshpuckett).

## Credits

Das Werkzeug, seine Oberfläche und die gesamte Engine stammen von **[Josh Puckett](https://github.com/joshpuckett)**:

- npm: [interface-kit](https://www.npmjs.com/package/interface-kit)
- Repo: [joshpuckett/interfacekit](https://github.com/joshpuckett/interfacekit)
- Lizenz: MIT

Dieses Repo enthält lediglich die Svelte-Anbindung. Es ist kein Fork und kein Ersatz.

## Ausprobieren

```bash
npm install
npm run dev
```

Die Demo-Seite ist eine Spielwiese mit Überschriften, Karten, Tabelle, Formular und Buttons, an denen sich das Werkzeug direkt ausprobieren lässt. Der Pinsel sitzt oben rechts.

## Einbinden

`src/lib/InterfaceKit.svelte` kopieren und im Layout einhängen:

```svelte
<script>
	import InterfaceKit from '$lib/InterfaceKit.svelte';
</script>

{@render children()}

<InterfaceKit />
```

Das war es. Die Komponente rendert selbst nichts und ist im Produktions-Build automatisch inaktiv.

## Zwei Dinge, auf die es ankommt

### 1. Dynamischer Import statt statischem

Das Paket greift beim Laden auf `document` zu. Ein statischer Import zieht es ins SSR-Bundle, wo es bricht. Deshalb wird es erst in `onMount` geladen:

```js
import('interface-kit').then(({ createInterfaceKit }) => { ... });
```

So bleibt das Server-Bundle sauber, der Client lädt es als eigenen Chunk.

### 2. `enabled` muss explizit gesetzt werden

Ohne das Flag ruft das Paket intern `resolveEnabled()` auf, das auf `process.env.NODE_ENV` zurückfällt. Im Browser ist das nicht zuverlässig vorhanden, und dann rendert das Werkzeug kommentarlos nichts: Container vorhanden, Oberfläche leer, keine Fehlermeldung.

```js
createInterfaceKit({ enabled: true });
```

## Der Popover-Fix

**Symptom:** Der Farbwähler (ebenso Border- und Shadow-Popover) öffnet als komplett ungestyltes Fragment mitten auf der Seite.

**Ursache:** InterfaceKit rendert seine Oberfläche in einen Shadow Root, seine Popover portalt Radix aber nach `document.body`, also aus dem Shadow heraus. Dort greift das Stylesheet des Werkzeugs nicht mehr.

Das ist kein Svelte-Problem. In React läuft derselbe Shadow-Mount mit denselben Portalen und bricht genauso.

**Lösung:** Das Stylesheet wird zusätzlich ins Light-DOM gespiegelt, per [`@scope`](https://developer.mozilla.org/en-US/docs/Web/CSS/@scope) streng auf den Portal-Container begrenzt:

```js
style.textContent = `@scope ([data-radix-popper-content-wrapper]) {
${css.replaceAll(':root', ':scope')}
}`;
```

Zwei Details entscheiden hier:

- **Ohne `@scope`** würde Tailwinds Preflight die gesamte Anwendung resetten, also genau das Design zerschießen, das man gerade beurteilen will.
- **`:root` muss zu `:scope` werden**, weil `html` außerhalb des Scopes liegt. Sonst fehlen alle Custom Properties und damit sämtliche Farben.

Das Paket verwendet ausschließlich Popper-basierte Portale (keine Dialoge), ein Scope-Selektor deckt daher alle Popover ab.

## Verifiziert

Getestet mit Playwright gegen echtes Chrome:

- Farbwähler rendert mit den Soll-Werten aus dem Paket: `bg #2a2a2a`, `radius 12px`, 240px Breite
- Farbe anwenden greift durch: `rgb(0, 0, 0)` wird zu `rgb(240, 10, 10)`
- Stile der eigenen Anwendung bleiben unverändert (Schriftgrößen, Abstände, Radien, Hintergründe vor und nach dem Mount identisch)
- Server-Bundle enthält das Paket nicht, `npm run check` meldet 0 Fehler

## Browser-Unterstützung

`@scope` benötigt Chrome 118+, Safari 17.4+ oder Firefox 128+. Da das Werkzeug ohnehin nur in der Entwicklungsumgebung läuft, ist das unkritisch.

## Lizenz

[MIT](./LICENSE) für die Svelte-Anbindung in diesem Repo. `interface-kit` selbst steht ebenfalls unter MIT, Copyright Josh Puckett.
