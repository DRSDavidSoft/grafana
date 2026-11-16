(() => {
  const boot = window.grafanaBootData;
  const html = document.documentElement;
  const root = document.getElementById('reactRoot');
  const isWelcome = document.body.classList.contains('dm-welcome');
  const base = boot?.settings?.appSubUrl ?? '';
  const user = boot?.user;
  const defaultLanguage = 'en-US';
  const persianLanguage = 'fa-IR';
  const languageKey = 'digitalogic.monitoring.language';
  const themeKey = 'digitalogic.monitoring.theme';
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  const url = new URL(location.href);
  const validTheme = /^(?:[a-z][a-z0-9_]{0,63})$/;
  let themeId = user?.theme;
  let themeHandlers;
  let pendingLink;

  function readPreference(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function savePreference(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // The current page can still be switched when browser storage is disabled.
    }
  }

  const urlLanguage = url.searchParams.get('lang');
  const guestLanguage = readPreference(languageKey);
  const language = urlLanguage || (user?.isSignedIn ? user.language : guestLanguage || user?.language);
  const persian = /^fa(?:-|$)/i.test(language ?? '');
  if (persian) {
    html.lang = persianLanguage;
    html.dir = 'rtl';
    if (user) {
      user.language = persianLanguage;
      user.locale = persianLanguage;
    }
  } else if (language && language !== 'detect') {
    html.lang = language;
  }

  const englishFont = 'Aptos, "Segoe UI", system-ui, sans-serif';
  const persianFont = 'Vazirmatn, ' + englishFont;
  const palette = {
    light: {
      primary: '#0758d4', primaryHover: '#0846ab', contrast: '#ffffff',
      canvas: '#eef3f8', surface: '#ffffff', secondary: '#f6faff', elevated: '#ffffff',
      text: '#263d4a', muted: '#465e78', border: '#cfdeef',
    },
    dark: {
      primary: '#83acff', primaryHover: '#9abbff', contrast: '#0b1220',
      canvas: '#0b1220', surface: '#121b2d', secondary: '#162238', elevated: '#172842',
      text: '#e5ecf7', muted: '#b2c9e2', border: '#2a4968',
    },
  };

  function brandTheme(mode) {
    const colors = palette[mode];
    return {
      colors: {
        mode,
        primary: { main: colors.primary, mainEmphasis: colors.primaryHover, contrastText: colors.contrast },
        background: {
          canvas: colors.canvas, page: colors.canvas, primary: colors.surface,
          secondary: colors.secondary, elevated: colors.elevated,
        },
        text: { primary: colors.text, secondary: colors.muted, link: colors.primary },
        border: { weak: colors.border, medium: colors.border, strong: colors.primary },
        gradients: { brandHorizontal: 'linear-gradient(90deg, #00b3eb, #0168cd)' },
      },
      shape: { borderRadiusSm: 6, borderRadius: 9, borderRadiusLg: 18 },
    };
  }

  function setThemeStyles(mode, assets = boot?.assets) {
    document.body.classList.toggle('theme-dark', mode === 'dark');
    document.body.classList.toggle('theme-light', mode === 'light');
    updateControls();
    const href = assets?.[mode];
    if (!href || pendingLink?.getAttribute('href') === href) return;

    pendingLink?.remove();
    pendingLink = undefined;
    const hrefs = [assets.dark, assets.light].filter(Boolean).map((asset) => new URL(asset, document.baseURI).href);
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).filter((link) => hrefs.includes(link.href));
    const existing = links.find((link) => link.href === new URL(href, document.baseURI).href);
    if (existing) {
      for (const link of links) if (link !== existing) link.remove();
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    pendingLink = link;
    link.onload = () => {
      if (pendingLink !== link) return;
      for (const previous of links) previous.remove();
      pendingLink = undefined;
    };
    link.onerror = () => {
      if (pendingLink !== link) return;
      link.remove();
      pendingLink = undefined;
    };
    document.head.insertBefore(link, document.head.firstChild);
  }

  function setThemeHandlers(handlers) {
    themeHandlers = handlers;
    if (themeId === 'system') setThemeStyles(scheme.matches ? 'dark' : 'light');
  }

  function publishTheme(id) {
    themeId = id;
    channel?.postMessage(id);
  }

  const scope = user?.isSignedIn ? `user:${user.id}:${user.orgId}` : 'guest';
  const channel = typeof BroadcastChannel === 'function'
    ? new BroadcastChannel(`digitalogic:monitoring:theme:${base}:${scope}`)
    : undefined;
  if (channel) channel.onmessage = ({ data }) => {
    if (typeof data !== 'string' || !validTheme.test(data)) return;
    themeId = data;
    if (themeHandlers) themeHandlers.apply(data);
    else setThemeStyles(data === 'system' ? (scheme.matches ? 'dark' : 'light') : data);
  };
  scheme.addEventListener('change', (event) => {
    if (themeId !== 'system') return;
    if (themeHandlers) themeHandlers.apply('system');
    else setThemeStyles(event.matches ? 'dark' : 'light');
  });

  function loadPersian(catalog = 'grafana') {
    return fetch(`${base}/public/locales/fa-IR/${catalog}.json?v=13.2.3-2`).then((response) => {
      if (!response.ok) throw new Error(`Could not load Persian translations (${response.status})`);
      return response.json();
    }).catch((error) => {
      console.error(error);
      return {};
    });
  }

  function rtlGridProps(layout, columns, model) {
    if (!persian) return {};

    const mirrorItem = (item) => ({ ...item, x: columns - item.x - item.w });
    const mirrorLayout = (items) => items.map(mirrorItem);
    return {
      layout: mirrorLayout(layout),
      resizeHandles: ['sw'],
      onDragStart: (items) => model.onDragStart(mirrorLayout(items)),
      onDragStop: (items, oldItem, newItem) =>
        model.onDragStop(mirrorLayout(items), mirrorItem(oldItem), mirrorItem(newItem)),
      onResizeStop: (items, oldItem, newItem) =>
        model.onResizeStop(mirrorLayout(items), mirrorItem(oldItem), mirrorItem(newItem)),
      onLayoutChange: (items) => model.onLayoutChange(mirrorLayout(items)),
    };
  }

  function typography(options) {
    return { ...options, fontFamily: persian ? persianFont : options.fontFamily ?? englishFont };
  }

  const controls = document.createElement('div');
  controls.className = 'dm-preference-controls';
  const themeButton = document.createElement('button');
  themeButton.type = 'button';
  themeButton.className = 'dm-preference-theme';
  const languageButton = document.createElement('button');
  languageButton.type = 'button';
  languageButton.className = 'dm-preference-language';
  languageButton.textContent = persian ? 'EN' : 'فا';
  languageButton.lang = persian ? 'en' : 'fa';
  languageButton.title = persian ? 'Switch to English' : 'تغییر زبان به فارسی';
  languageButton.setAttribute('aria-label', languageButton.title);

  const feedback = document.createElement('span');
  feedback.setAttribute('role', 'status');
  feedback.className = 'dm-preference-status';
  controls.append(themeButton, languageButton, feedback);

  function updateControls() {
    const dark = document.body.classList.contains('theme-dark');
    const label = persian
      ? (dark ? 'تغییر به پوستهٔ روشن' : 'تغییر به پوستهٔ تیره')
      : (dark ? 'Switch to light theme' : 'Switch to dark theme');
    themeButton.title = label;
    themeButton.setAttribute('aria-label', label);
  }

  themeButton.onclick = async () => {
    const dark = themeHandlers?.get() === 'dark' || (!themeHandlers && document.body.classList.contains('theme-dark'));
    const next = dark ? 'light' : 'dark';
    themeButton.disabled = true;
    feedback.textContent = '';
    try {
      if (themeHandlers) await themeHandlers.change(next, !user?.isSignedIn);
      else {
        setThemeStyles(next);
        publishTheme(next);
      }
      if (!user?.isSignedIn) savePreference(themeKey, next);
    } catch {
      feedback.textContent = persian ? 'ذخیرهٔ پوسته ممکن نشد.' : 'Could not save the theme.';
    } finally {
      themeButton.disabled = false;
    }
  };

  languageButton.onclick = async () => {
    const next = persian ? defaultLanguage : persianLanguage;
    languageButton.disabled = true;
    feedback.textContent = '';
    try {
      if (user?.isSignedIn) {
        const response = await fetch(`${base}/api/user/preferences`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: next }),
        });
        if (!response.ok) throw new Error('Could not save language');
      }
      savePreference(languageKey, next);
      const nextUrl = new URL(location.href);
      nextUrl.searchParams.delete('lang');
      if (isWelcome) {
        // Apache serves the public welcome when the root URL has no query string.
        location.href = nextUrl;
      } else if (urlLanguage) {
        location.replace(nextUrl);
      } else {
        location.reload();
      }
    } catch {
      feedback.textContent = persian ? 'ذخیرهٔ زبان ممکن نشد.' : 'Could not save the language.';
      languageButton.disabled = false;
    }
  };

  function mount() {
    const slot = root?.querySelector('[data-dm-preferences]');
    if (slot) {
      slot.closest('header')?.classList.add('dm-app-nav');
      if (controls.parentElement !== slot) slot.append(controls);
    } else if (isWelcome) {
      document.querySelector('.dm-header')?.append(controls);
    } else if (html.classList.contains('digitalogic-monitoring-login') && !controls.isConnected) {
      controls.classList.add('dm-entry-controls');
      document.body.append(controls);
    }
  }

  window.digitalogicPreferences = {
    brandTheme, loadPersian, setThemeStyles, setThemeHandlers, publishTheme, typography, rtlGridProps,
  };

  const manualTheme = url.searchParams.get('theme');
  const guestTheme = readPreference(themeKey);
  if (!manualTheme && !user?.isSignedIn && (guestTheme === 'light' || guestTheme === 'dark')) {
    themeId = guestTheme;
    if (user) {
      user.theme = guestTheme;
      user.lightTheme = guestTheme === 'light';
    }
    setThemeStyles(guestTheme);
  } else if (isWelcome) {
    themeId = 'system';
    setThemeStyles(scheme.matches ? 'dark' : 'light');
  }
  updateControls();
  mount();
  if (root) new MutationObserver(mount).observe(root, { childList: true, subtree: true });
})();
