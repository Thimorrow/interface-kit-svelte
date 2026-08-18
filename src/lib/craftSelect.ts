/**
 * InterfaceKit's inspector is Interface Craft (dark #2a2a2a popovers).
 * One control is not: Typeface is a native <select>, so the OS paints a
 * light system menu on top of the dark panel. Same story if the host app
 * styles [data-slot=popover-content] globally — color uses !important
 * utilities, shadow/border do not.
 *
 * This module:
 *  1. Replaces native <select> pickers inside the kit shadow root with a
 *     Craft listbox (same surface as ShadeSelector).
 *  2. Forces portaled kit popovers onto that surface so host tokens cannot
 *     restyle them.
 */

const MENU_ID = 'interface-kit-craft-select';
const STYLE_ID = 'interface-kit-craft-select-styles';
const OPTION_ATTR = 'data-ik-craft-option';

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

const MENU_CSS = `[data-ik-craft-select] {
  position: fixed;
  z-index: 1000000;
  display: none;
  box-sizing: border-box;
  min-width: 180px;
  max-width: 280px;
  max-height: 280px;
  overflow-y: auto;
  padding: 8px;
  border: 0;
  border-radius: 12px;
  background: #2a2a2a;
  color: rgba(255, 255, 255, 0.8);
  box-shadow:
    0 0 0 2px #2a2a2a,
    0 20px 25px -5px rgba(0, 0, 0, 0.4);
  outline: none;
  font: 500 13px/1.3 ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  transform: scale(0.96);
  opacity: 0;
  transform-origin: top right;
  transition:
    opacity 160ms ${EASE_OUT},
    transform 160ms ${EASE_OUT};
}
[data-ik-craft-select].is-open {
  transform: scale(1);
  opacity: 1;
}
[data-ik-craft-select] button {
  display: block;
  width: 100%;
  margin: 0;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
[data-ik-craft-select] button[aria-selected="true"] {
  background: #363636;
  color: #fff;
}
@media (hover: hover) and (pointer: fine) {
  [data-ik-craft-select] button:hover {
    background: rgba(255, 255, 255, 0.06);
  }
  [data-ik-craft-select] button[aria-selected="true"]:hover {
    background: #3f3f3f;
  }
}
[data-ik-craft-select] button:active {
  transform: scale(0.97);
}
[data-interface-kit][data-slot="popover-content"] {
  background: #2a2a2a !important;
  color: rgba(255, 255, 255, 0.8) !important;
  border: 0 !important;
  outline: none !important;
  animation: none !important;
}
@media (prefers-reduced-motion: reduce) {
  [data-ik-craft-select] {
    transition: opacity 120ms ${EASE_OUT};
    transform: none;
  }
  [data-ik-craft-select].is-open {
    transform: none;
  }
}
`;

export function enableCraftSelect(doc: Document): () => void {
	const win = doc.defaultView ?? window;
	const styleEl = ensureStyles(doc);
	const menu = ensureMenu(doc);
	doc.body.append(menu);

	let owner: HTMLSelectElement | null = null;
	let activeIndex = 0;
	let shadowObserver: MutationObserver | null = null;
	let hostObserver: MutationObserver | null = null;
	const bound = new WeakSet<HTMLSelectElement>();

	function attach(select: HTMLSelectElement): void {
		if (bound.has(select)) return;
		bound.add(select);
		select.addEventListener('mousedown', onSelectMouseDown, true);
		select.addEventListener('keydown', onSelectKeyDown, true);
	}

	function scan(root: ParentNode): void {
		root.querySelectorAll('select').forEach((el) => attach(el));
	}

	function watchShadow(shadow: ShadowRoot): void {
		scan(shadow);
		shadowObserver?.disconnect();
		shadowObserver = new MutationObserver(() => scan(shadow));
		shadowObserver.observe(shadow, { childList: true, subtree: true });
	}

	function findShadow(): ShadowRoot | null {
		for (const el of doc.querySelectorAll('[data-interface-kit]')) {
			if (el.shadowRoot) return el.shadowRoot;
		}
		return null;
	}

	const existing = findShadow();
	if (existing) {
		watchShadow(existing);
	} else {
		hostObserver = new MutationObserver(() => {
			const shadow = findShadow();
			if (!shadow) return;
			hostObserver?.disconnect();
			hostObserver = null;
			watchShadow(shadow);
		});
		hostObserver.observe(doc.body, { childList: true, subtree: true });
	}

	function onSelectMouseDown(event: MouseEvent): void {
		if (event.button !== 0) return;
		const select = event.currentTarget;
		if (!(select instanceof HTMLSelectElement) || select.disabled) return;
		event.preventDefault();
		event.stopPropagation();
		if (owner === select && menu.style.display === 'block') {
			closeMenu();
			return;
		}
		openMenu(select);
	}

	function onSelectKeyDown(event: KeyboardEvent): void {
		const select = event.currentTarget;
		if (!(select instanceof HTMLSelectElement) || select.disabled) return;
		if (
			event.key !== 'ArrowDown' &&
			event.key !== 'ArrowUp' &&
			event.key !== 'Enter' &&
			event.key !== ' '
		) {
			return;
		}
		event.preventDefault();
		openMenu(select);
	}

	function openMenu(select: HTMLSelectElement): void {
		owner = select;
		select.focus();
		const options = [...select.options];
		if (options.length === 0) return;

		activeIndex = Math.max(
			0,
			options.findIndex((option) => option.value === select.value)
		);

		menu.replaceChildren();
		for (const [index, option] of options.entries()) {
			const btn = doc.createElement('button');
			btn.type = 'button';
			btn.setAttribute(OPTION_ATTR, '');
			btn.setAttribute('role', 'option');
			btn.setAttribute('aria-selected', String(index === activeIndex));
			btn.dataset.index = String(index);
			btn.textContent = option.label;
			btn.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopPropagation();
				choose(index);
			});
			menu.append(btn);
		}

		placeMenu(select, menu);
		menu.classList.remove('is-open');
		menu.style.display = 'block';
		void menu.offsetWidth;
		menu.classList.add('is-open');
		focusOption(activeIndex);
	}

	function placeMenu(select: HTMLSelectElement, panel: HTMLElement): void {
		const rect = select.getBoundingClientRect();
		const width = Math.min(280, Math.max(180, Math.ceil(rect.width) + 24));
		const gap = 6;
		const below = rect.bottom + gap;
		const spaceBelow = win.innerHeight - below - 12;
		const spaceAbove = rect.top - 12;
		const maxHeight = 280;
		const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;

		panel.style.width = `${width}px`;
		panel.style.maxHeight = `${Math.min(maxHeight, openUp ? spaceAbove : spaceBelow)}px`;
		panel.style.left = `${Math.max(12, rect.right - width)}px`;
		panel.style.transformOrigin = openUp ? 'bottom right' : 'top right';

		if (openUp) {
			panel.style.top = 'auto';
			panel.style.bottom = `${win.innerHeight - rect.top + gap}px`;
		} else {
			panel.style.bottom = 'auto';
			panel.style.top = `${below}px`;
		}
	}

	function focusOption(index: number): void {
		const btn = menu.querySelectorAll<HTMLButtonElement>(`[${OPTION_ATTR}]`)[index];
		btn?.focus();
	}

	function choose(index: number): void {
		if (!owner) return;
		const option = owner.options[index];
		if (!option) return;
		const select = owner;
		select.value = option.value;
		select.dispatchEvent(new Event('input', { bubbles: true }));
		select.dispatchEvent(new Event('change', { bubbles: true }));
		closeMenu();
		select.focus();
	}

	function closeMenu(): void {
		owner = null;
		menu.classList.remove('is-open');
		menu.style.display = 'none';
		menu.replaceChildren();
	}

	function onDocPointerDown(event: PointerEvent): void {
		if (menu.style.display !== 'block') return;
		const path = event.composedPath();
		if (path.includes(menu)) return;
		if (owner && path.includes(owner)) return;
		closeMenu();
	}

	function onMenuKeyDown(event: KeyboardEvent): void {
		if (menu.style.display !== 'block') return;
		if (event.key === 'Escape') {
			event.preventDefault();
			const select = owner;
			closeMenu();
			select?.focus();
			return;
		}
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') {
			return;
		}
		event.preventDefault();
		const count = menu.querySelectorAll(`[${OPTION_ATTR}]`).length;
		if (count === 0) return;
		if (event.key === 'Enter') {
			choose(activeIndex);
			return;
		}
		activeIndex =
			event.key === 'ArrowDown'
				? (activeIndex + 1) % count
				: (activeIndex - 1 + count) % count;
		for (const btn of menu.querySelectorAll<HTMLButtonElement>(`[${OPTION_ATTR}]`)) {
			btn.setAttribute('aria-selected', String(Number(btn.dataset.index) === activeIndex));
		}
		focusOption(activeIndex);
	}

	function onViewportChange(): void {
		if (owner && menu.style.display === 'block') placeMenu(owner, menu);
	}

	doc.addEventListener('pointerdown', onDocPointerDown, true);
	doc.addEventListener('keydown', onMenuKeyDown, true);
	win.addEventListener('resize', onViewportChange);
	win.addEventListener('scroll', onViewportChange, true);

	return () => {
		shadowObserver?.disconnect();
		hostObserver?.disconnect();
		doc.removeEventListener('pointerdown', onDocPointerDown, true);
		doc.removeEventListener('keydown', onMenuKeyDown, true);
		win.removeEventListener('resize', onViewportChange);
		win.removeEventListener('scroll', onViewportChange, true);
		closeMenu();
		menu.remove();
		styleEl.remove();
	};
}

function ensureStyles(doc: Document): HTMLStyleElement {
	const existing = doc.getElementById(STYLE_ID);
	if (existing instanceof HTMLStyleElement) return existing;
	const style = doc.createElement('style');
	style.id = STYLE_ID;
	style.textContent = MENU_CSS;
	doc.head.append(style);
	return style;
}

function ensureMenu(doc: Document): HTMLDivElement {
	const existing = doc.getElementById(MENU_ID);
	if (existing instanceof HTMLDivElement) return existing;
	const menu = doc.createElement('div');
	menu.id = MENU_ID;
	menu.setAttribute('data-interface-kit', '');
	menu.setAttribute('data-ik-craft-select', '');
	menu.setAttribute('role', 'listbox');
	return menu;
}
