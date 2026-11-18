(() => {
  const root = document.getElementById('reactRoot');
  const user = window.grafanaBootData?.user;
  if (!root || !user?.isSignedIn) return;

  const storageKey = `digitalogic.monitoring.workspace.v1:${user.uid || user.id}:${user.orgId}`;
  const persian = document.documentElement.lang === 'fa-IR';
  const strings = persian
    ? {
        collapse: (title) => `جمع‌کردن توضیحات «${title}»`,
        expand: (title) => `بازکردن توضیحات «${title}»`,
        reorder: (title) => `جابه‌جایی «${title}»`,
        earlier: 'انتقال به قبل',
        later: 'انتقال به بعد',
      }
    : {
        collapse: (title) => `Collapse details for ${title}`,
        expand: (title) => `Expand details for ${title}`,
        reorder: (title) => `Reorder ${title}`,
        earlier: 'Move earlier',
        later: 'Move later',
      };

  function readLayout() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return {
        order: Array.isArray(saved?.order) ? saved.order : [],
        collapsed: new Set(Array.isArray(saved?.collapsed) ? saved.collapsed : []),
      };
    } catch {
      return { order: [], collapsed: new Set() };
    }
  }

  function createButton(className, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.setAttribute('aria-label', label);
    return button;
  }

  function initialize(board) {
    const links = Array.from(board.querySelectorAll(':scope > a.dm-tile[href]:has(> h2):has(> p)'));
    if (!links.length) return;

    const cards = new Map();
    const { order, collapsed } = readLayout();
    let drag;
    let ignoreHandleClick = false;
    let openMenu;

    function orderedCards() {
      return Array.from(board.children).filter((child) => child.matches('.dm-shortcut'));
    }

    function saveLayout() {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          order: orderedCards().map((card) => card.dataset.shortcut),
          collapsed: Array.from(collapsed),
        }));
      } catch {
        // The controls still work when browser storage is unavailable.
      }
    }

    function moveCard(card, target) {
      if (!target || card === target) return;
      const moveLater = card.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING;
      board.insertBefore(card, moveLater ? target.nextElementSibling : target);
      saveLayout();
    }

    function closeMenu() {
      if (!openMenu) return;
      const { panel, handle } = openMenu;
      panel.hidden = true;
      handle.setAttribute('aria-expanded', 'false');
      openMenu = undefined;
    }

    function setTarget(target) {
      if (drag.target === target) return;
      drag.target?.classList.remove('dm-shortcut-drop');
      drag.target = target;
      target?.classList.add('dm-shortcut-drop');
    }

    function finishDrag(event, apply) {
      if (drag?.pointerId !== event.pointerId) return;
      const { card, target, started } = drag;
      setTarget(undefined);
      drag = undefined;
      card.classList.remove('dm-shortcut-dragging');
      if (apply && started) moveCard(card, target);
    }

    for (const [index, link] of links.entries()) {
      const id = link.getAttribute('href');
      const heading = link.querySelector(':scope > h2');
      const details = link.querySelector(':scope > p');
      const title = heading.textContent.trim();
      const card = document.createElement('article');
      card.className = 'dm-shortcut';
      card.dataset.shortcut = id;
      heading.id = `dm-shortcut-title-${index}`;
      details.id = `dm-shortcut-details-${index}`;
      link.setAttribute('aria-labelledby', heading.id);

      const toggle = createButton('dm-shortcut-toggle', '');
      toggle.setAttribute('aria-controls', details.id);
      function renderCollapsed() {
        const isCollapsed = collapsed.has(id);
        const label = isCollapsed ? strings.expand(title) : strings.collapse(title);
        toggle.setAttribute('aria-expanded', String(!isCollapsed));
        toggle.setAttribute('aria-label', label);
        toggle.title = label;
        details.hidden = isCollapsed;
      }
      toggle.addEventListener('click', () => {
        if (collapsed.has(id)) collapsed.delete(id);
        else collapsed.add(id);
        renderCollapsed();
        saveLayout();
      });
      renderCollapsed();

      const handle = createButton('dm-shortcut-handle', strings.reorder(title));
      handle.title = strings.reorder(title);
      handle.setAttribute('aria-expanded', 'false');
      const panel = document.createElement('div');
      panel.className = 'dm-shortcut-moves';
      panel.id = `dm-shortcut-moves-${index}`;
      panel.hidden = true;
      handle.setAttribute('aria-controls', panel.id);
      const earlier = createButton('dm-shortcut-move', strings.earlier);
      const later = createButton('dm-shortcut-move', strings.later);
      earlier.textContent = strings.earlier;
      later.textContent = strings.later;
      panel.append(earlier, later);

      handle.addEventListener('click', (event) => {
        if (ignoreHandleClick && event.detail) return;
        const wasOpen = openMenu?.handle === handle;
        closeMenu();
        if (wasOpen) return;
        const cards = orderedCards();
        const position = cards.indexOf(card);
        earlier.disabled = position === 0;
        later.disabled = position === cards.length - 1;
        panel.hidden = false;
        handle.setAttribute('aria-expanded', 'true');
        openMenu = { panel, handle };
      });
      for (const [button, offset] of [[earlier, -1], [later, 1]]) {
        button.addEventListener('click', () => {
          const cards = orderedCards();
          moveCard(card, cards[cards.indexOf(card) + offset]);
          closeMenu();
          handle.focus({ preventScroll: true });
        });
      }
      card.addEventListener('focusout', (event) => {
        if (openMenu?.handle === handle && !card.contains(event.relatedTarget)) closeMenu();
      });
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || openMenu?.handle !== handle) return;
        closeMenu();
        handle.focus({ preventScroll: true });
      });

      handle.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary || event.button !== 0) return;
        ignoreHandleClick = false;
        drag = { card, pointerId: event.pointerId, x: event.clientX, y: event.clientY, started: false };
        handle.setPointerCapture(event.pointerId);
      });
      handle.addEventListener('pointermove', (event) => {
        if (drag?.pointerId !== event.pointerId) return;
        if (!drag.started) {
          if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
          drag.started = true;
          ignoreHandleClick = true;
          closeMenu();
          card.classList.add('dm-shortcut-dragging');
        }
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.dm-shortcut');
        setTarget(target !== card && target?.parentElement === board ? target : undefined);
      });
      handle.addEventListener('pointerup', (event) => finishDrag(event, true));
      handle.addEventListener('lostpointercapture', (event) => finishDrag(event, false));

      const actions = document.createElement('div');
      actions.className = 'dm-shortcut-actions';
      actions.append(toggle, handle);
      link.before(card);
      card.append(link, actions, panel);
      cards.set(id, card);
    }

    // Match saved IDs against the current template so new cards can appear automatically.
    for (const id of new Set([...order, ...cards.keys()])) {
      const card = cards.get(id);
      if (card) board.append(card);
    }
  }

  let board;
  function mount() {
    if (location.pathname !== '/' || board?.isConnected) return;
    board = root.querySelector('.dm-workspace .dm-tiles');
    if (board) initialize(board);
  }

  new MutationObserver(mount).observe(root, { childList: true, subtree: true });
  mount();
})();
