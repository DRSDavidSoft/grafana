(() => {
  if (!document.documentElement.lang.startsWith('fa') || !window.grafanaBootData?.user?.isSignedIn) return;

  const root = document.getElementById('reactRoot');
  const subUrl = window.grafanaBootData.settings.appSubUrl ?? '';
  const displaySurface = '#pageContent, header.dm-app-nav, #grafana-portal-container, [role="tooltip"]';
  const editableSurface = 'input, textarea, select, option, [contenteditable]:not([contenteditable="false"]), ' +
    '.monaco-editor, pre, code, script, style, [role="textbox"]';
  const displayAttributes = ['aria-label', 'title'];
  const pendingNodes = new Set();
  const translatedText = new Map();
  const translatedAttrs = new Map();
  let currentUid;
  let catalog;
  let frame;

  function dashboardUid() {
    return location.pathname.slice(subUrl.length).match(/^\/d(?:-solo)?\/([\w-]{1,40})(?:\/|$)/)?.[1];
  }

  function localize(text) {
    const trimmed = text.trim();
    const localized = Object.hasOwn(catalog, trimmed) ? catalog[trimmed] : undefined;
    return localized ? text.replace(trimmed, () => localized) : text;
  }

  function localizeText(node) {
    const parent = node.parentElement;
    if (!parent || !parent.closest(displaySurface) || parent.closest(editableSurface)) return;
    const previous = translatedText.get(node);
    if (previous?.value === node.data) return;
    const value = localize(node.data);
    if (value !== node.data) {
      translatedText.set(node, { original: node.data, value });
      node.data = value;
    } else {
      translatedText.delete(node);
    }
  }

  function localizeAttributes(element) {
    if (!element.closest(displaySurface) || element.closest(editableSurface)) return;
    for (const name of displayAttributes) {
      const original = element.getAttribute(name);
      if (!original || translatedAttrs.get(element)?.[name]?.value === original) continue;
      const value = localize(original);
      if (value !== original) {
        const fields = translatedAttrs.get(element) ?? {};
        fields[name] = { original, value };
        translatedAttrs.set(element, fields);
        element.setAttribute(name, value);
      }
    }
  }

  function visit(node) {
    if (!node.isConnected) return;
    if (node.nodeType === Node.TEXT_NODE) {
      localizeText(node);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    localizeAttributes(node);
    for (const element of node.querySelectorAll('[aria-label], [title]')) localizeAttributes(element);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) localizeText(walker.currentNode);
  }

  function restoreOriginalText() {
    for (const [node, { original, value }] of translatedText) {
      if (node.isConnected && node.data === value) node.data = original;
    }
    for (const [element, fields] of translatedAttrs) {
      if (!element.isConnected) continue;
      for (const [name, { original, value }] of Object.entries(fields)) {
        if (element.getAttribute(name) === value) element.setAttribute(name, original);
      }
    }
    translatedText.clear();
    translatedAttrs.clear();
  }

  function translateVisibleContent() {
    for (const node of document.querySelectorAll(displaySurface)) visit(node);
    translateTitle();
  }

  let dashboardTitle;
  function translateTitle() {
    const title = document.querySelector('title');
    const text = title?.firstChild;
    if (!text || !dashboardTitle) return;
    const { original, value } = dashboardTitle;
    const localized = text.data.replace(new RegExp('^' + original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s*(?:[|–-]|$))'),
      () => value);
    if (localized !== text.data) {
      translatedText.set(text, { original: text.data, value: localized });
      text.data = localized;
    }
  }

  async function load(uid) {
    try {
      const response = await fetch(`${subUrl}/_monitoring/dashboard-locales/${uid}.json`, { cache: 'no-store' });
      if (!response.ok || uid !== currentUid) return;
      const { strings, title } = await response.json();
      if (uid !== currentUid) return;
      catalog = strings;
      dashboardTitle = title;
      translateVisibleContent();
    } catch {
      // The dashboard can still render while its display catalog is unavailable.
    }
  }

  function refresh() {
    frame = undefined;
    const uid = dashboardUid();
    if (uid !== currentUid) {
      currentUid = uid;
      catalog = undefined;
      dashboardTitle = undefined;
      restoreOriginalText();
      pendingNodes.clear();
      if (uid) load(uid);
      return;
    }
    if (catalog) {
      for (const node of pendingNodes) visit(node);
      translateTitle();
      for (const node of translatedText.keys()) if (!node.isConnected) translatedText.delete(node);
      for (const node of translatedAttrs.keys()) if (!node.isConnected) translatedAttrs.delete(node);
    }
    pendingNodes.clear();
  }

  function schedule() {
    frame ??= requestAnimationFrame(refresh);
  }

  const mutations = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData' || record.type === 'attributes') pendingNodes.add(record.target);
      for (const node of record.addedNodes) pendingNodes.add(node);
    }
    schedule();
  });
  mutations.observe(root, { childList: true, characterData: true, attributes: true, subtree: true, attributeFilter: displayAttributes });
  mutations.observe(document.querySelector('title'), { childList: true, characterData: true, subtree: true });
  window.addEventListener('popstate', schedule);
  refresh();
})();
