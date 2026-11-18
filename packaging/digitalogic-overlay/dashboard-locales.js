(() => {
  if (!document.documentElement.lang.startsWith('fa') || !window.grafanaBootData?.user?.isSignedIn) return;

  const sharedCatalog = {
    day: 'روز', days: 'روز', hour: 'ساعت', hours: 'ساعت',
    minute: 'دقیقه', minutes: 'دقیقه', second: 'ثانیه', seconds: 'ثانیه',
    week: 'هفته', weeks: 'هفته', month: 'ماه', months: 'ماه', year: 'سال', years: 'سال',
    'No data': 'داده‌ای وجود ندارد', 'No data points': 'داده‌ای برای نمایش وجود ندارد',
    Unavailable: 'در دسترس نیست',
    'Edit color for {{series}}': 'ویرایش رنگ {{series}}',
    'ویرایش رنگ برای {{series}}': 'ویرایش رنگ {{series}}',
    'Panel menu {{panel}}': 'منوی پنل {{panel}}',
    'منوی پانل {{panel}}': 'منوی پنل {{panel}}',
    'همه سریال ها انتخاب شدند': 'همهٔ سری‌ها انتخاب شده‌اند',
    '"{{dashboard}}" را به عنوان مورد علاقه علامت بزنید': 'نشان‌گذاری «{{dashboard}}» به‌عنوان مورد علاقه',
  };

  const subUrl = window.grafanaBootData.settings.appSubUrl ?? '';
  const displaySurface = '#pageContent, header.dm-app-nav, #grafana-portal-container, ' +
    '[role="tooltip"], [role="listbox"], [role="menu"], [role="dialog"]';
  const editableSurface = 'input, textarea, select, option, [contenteditable]:not([contenteditable="false"]), ' +
    '.monaco-editor, pre, code, script, style, [role="textbox"]';
  const displayAttributes = ['aria-label', 'title', 'placeholder'];
  const pendingNodes = new Set();
  const translatedText = new Map();
  const translatedAttrs = new Map();
  let currentUid;
  let catalog;
  let templates = [];
  let frame;

  function dashboardUid() {
    return location.pathname.slice(subUrl.length).match(/^\/d(?:-solo)?\/([\w-]{1,40})(?:\/|$)/)?.[1];
  }

  function compileTemplates(strings) {
    // Only authored catalog templates may match a whole display label.
    // Captures remain data; never interpret labels as regular expressions or HTML.
    return Object.entries(strings).flatMap(([original, value]) => {
      const names = [];
      let literalSize = 0;
      const parts = original.split(/({{\s*[\w-]+\s*}})/g);
      if (parts.length === 1) return [];
      const pattern = parts.map(part => {
        const parameter = /^{{\s*([\w-]+)\s*}}$/.exec(part);
        if (parameter) {
          names.push(parameter[1]);
          return '(.+?)';
        }
        literalSize += part.length;
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('');
      if (!literalSize || names.length > 8) return [];
      return [{ pattern: new RegExp('^' + pattern + '$'), names, value, literalSize }];
    }).sort((a, b) => b.literalSize - a.literalSize);
  }

  function localize(text, depth = 0) {
    const trimmed = text.trim();
    let localized = Object.hasOwn(catalog, trimmed) ? catalog[trimmed] : undefined;
    if (!localized && trimmed.length <= 2048 && depth < 4) {
      for (const template of templates) {
        // Grafana escapes a slash in some generated accessible series names.
        const match = template.pattern.exec(trimmed.replace(/&#(?:x2f|47);/gi, '/'));
        if (!match) continue;
        const values = new Map();
        let consistent = true;
        template.names.forEach((name, i) => {
          const raw = match[i + 1];
          if (values.has(name) && values.get(name) !== raw) consistent = false;
          values.set(name, raw);
        });
        if (!consistent) continue;
        localized = template.value.replace(/{{\s*([\w-]+)\s*}}/g, (token, name) => {
          const raw = values.get(name);
          return raw === undefined ? token : localize(raw, depth + 1);
        });
        break;
      }
    }
    return localized ? text.replace(trimmed, () => localized) : text;
  }

  function localizeText(node) {
    const parent = node.parentElement;
    if (!parent || !parent.closest(displaySurface) || parent.closest(editableSurface)) return;
    const previous = translatedText.get(node);
    if (previous?.value === node.data) {
      return;
    }
    const value = localize(node.data);
    if (value !== node.data) {
      translatedText.set(node, { original: node.data, value });
      node.data = value;
    } else {
      translatedText.delete(node);
    }
  }

  function localizeAttributes(element) {
    // Ignore bidi formatting marks when recognizing the query-expression placeholder.
    const placeholder = element.getAttribute('placeholder')?.replace(/[\u200e\u200f\u2066-\u2069]/g, '');
    const filterInput = element.tagName === 'INPUT' &&
      (placeholder === '+ label = value' || placeholder === '+ برچسب = مقدار');
    if (filterInput) {
      const control = element.closest('[data-testid="data-testid template variable"]');
      control?.querySelector(':scope > div')?.setAttribute('data-dm-filter-expression', '');
    }
    if (!element.closest(displaySurface) || (!filterInput && element.closest(editableSurface))) return;
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
    for (const element of node.querySelectorAll('[aria-label], [title], [placeholder]')) localizeAttributes(element);
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
      catalog = { ...sharedCatalog, ...strings };
      templates = compileTemplates(catalog);
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
      templates = [];
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
  mutations.observe(document.body, { childList: true, characterData: true, attributes: true, subtree: true, attributeFilter: displayAttributes });
  mutations.observe(document.querySelector('title'), { childList: true, characterData: true, subtree: true });
  window.addEventListener('popstate', schedule);
  refresh();
})();
