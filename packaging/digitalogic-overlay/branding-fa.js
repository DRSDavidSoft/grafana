(() => {
  if (document.documentElement.lang !== 'fa-IR') return;

  const labels = new Map(Object.entries({
    'Digitalogic': 'دیجیتالاجیک',
    'Monitoring': 'پایش',
    'Digitalogic Monitoring': 'پایش دیجیتالاجیک',
    'Digitalogic · Private team workspace': 'دیجیتالاجیک · فضای کاری ویژهٔ تیم',
    'Loading Digitalogic Monitoring': 'در حال بارگیری سامانهٔ پایش دیجیتالاجیک',
    'Monitoring home': 'صفحهٔ اصلی پایش',
    'Monitoring shortcuts': 'میان‌برهای پایش',
    'See what’s': 'وضعیت سرویس‌ها را',
    'running.': 'دنبال کنید',
    'Open infrastructure dashboards, check storage and UPS health, and investigate alerts.': 'داشبوردهای زیرساخت را باز کنید، سلامت فضای ذخیره‌سازی و برق اضطراری را ببینید و هشدارها را بررسی کنید.',
    'Check infrastructure, storage, and alerts across Digitalogic.': 'زیرساخت، فضای ذخیره‌سازی و هشدارهای دیجیتالاجیک را بررسی کنید.',
    'See how Digitalogic’s infrastructure is running, investigate changes, and respond to alerts from one workspace.': 'وضعیت زیرساخت دیجیتالاجیک را ببینید، تغییرات را بررسی کنید و به هشدارها پاسخ دهید.',
    'Visit Digitalogic': 'وب‌سایت دیجیتالاجیک',
    'Team access': 'دسترسی تیم',
    'Sign in with your Digitalogic account to open the monitoring workspace.': 'برای ورود به فضای پایش از حساب دیجیتالاجیک خود استفاده کنید.',
    'Sign in to Monitoring': 'ورود به سامانهٔ پایش',
    'Need access? Contact your system administrator.': 'برای دریافت دسترسی با مدیر سامانه تماس بگیرید.',
    'Sign in': 'ورود',
    'Sign in with Digitalogic': 'ورود با حساب دیجیتالاجیک',
    'Sign in with a local account': 'ورود با حساب محلی',
    'Back to sign-in': 'بازگشت به صفحهٔ ورود',
    'Reset password': 'بازنشانی رمز عبور',
    'Local Grafana account': 'حساب محلی گرافانا',
    'Recover your Digitalogic.ir account': 'بازیابی حساب دیجیتالاجیک',
    'Reset email is currently unavailable. Contact your Monitoring administrator to reset your password.': 'ارسال ایمیل بازیابی فعلاً در دسترس نیست. برای بازنشانی رمز عبور با مدیر سامانهٔ پایش تماس بگیرید.',
    'Open overview': 'نمای کلی',
    'Infrastructure': 'زیرساخت',
    'See host, network, and service metrics together in the Digitalogic Overview dashboard.': 'سنجه‌های میزبان‌ها، شبکه و سرویس‌ها را یک‌جا در داشبورد نمای کلی ببینید.',
    'Storage & power': 'ذخیره‌سازی و برق',
    'Track free space, SSD health, and UPS readings across the office.': 'فضای خالی، سلامت SSD و داده‌های UPS را در دفتر پایش کنید.',
    'Alerting': 'هشدارها',
    'Review firing alerts and check which rules are monitoring your services.': 'هشدارهای فعال و قوانین پایش سرویس‌ها را بررسی کنید.',
    'Network & VPN': 'شبکه و VPN',
    'WAN bandwidth, link reachability, tunnels, and proxies.': 'پهنای باند WAN، دسترسی پیوندها، تونل‌ها و پراکسی‌ها.',
    'Hosts & services': 'میزبان‌ها و سرویس‌ها',
    'CPU, memory, PHP workers, packages, and unit health.': 'پردازنده، حافظه، پردازه‌های PHP، بسته‌ها و سلامت واحدها.',
    'Linux storage': 'فضای ذخیره‌سازی لینوکس',
    'Free space, drive health, and disk I/O.': 'فضای خالی، سلامت دیسک و عملیات خواندن و نوشتن.',
    'Power & UPS': 'برق و UPS',
    'Power events and live Faratel readings.': 'رویدادهای برق و داده‌های لحظه‌ای فاراتل.',
    'Voice & mail': 'تلفن و ایمیل',
    'Asterisk, Grandstream, and mail delivery.': 'استریسک، گرنداستریم و تحویل ایمیل.',
    'Commerce & automation': 'فروشگاه و خودکارسازی',
    'WooCommerce, Patris snapshots, and n8n.': 'ووکامرس، تصاویر لحظه‌ای پاتریس و n8n.',
    'Security & errors': 'امنیت و خطاها',
    'Bans, abuse activity, and processed errors.': 'مسدودسازی‌ها، فعالیت‌های مخرب و خطاهای پردازش‌شده.',
    'Platform services': 'سرویس‌های پلتفرم',
    'Jitsi, object storage, MQTT, cameras, and database health.': 'جیتسی، ذخیره‌سازی شیء، MQTT، دوربین‌ها و سلامت پایگاه داده.',
    'Git activity': 'فعالیت گیت',
    'Commits, pull requests, releases, and CI runs.': 'کامیت‌ها، درخواست‌های ادغام، انتشارها و اجراهای CI.',
    'Google Search Console': 'کنسول جست‌وجوی گوگل',
    'Search clicks, impressions, and top pages and queries.': 'کلیک‌ها و نمایش‌ها در نتایج جست‌وجو و صفحه‌ها و عبارت‌های برتر.',
    'Alert rules': 'قوانین هشدار',
    'Review rules and their current state.': 'قوانین هشدار و وضعیت فعلی آن‌ها را بررسی کنید.',
  }));

  function translateRegion(region) {
    const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const key = node.data.trim();
      if (labels.has(key)) node.data = node.data.replace(key, labels.get(key));
    }
    for (const element of region.querySelectorAll('[aria-label]')) {
      const key = element.getAttribute('aria-label');
      if (labels.has(key)) element.setAttribute('aria-label', labels.get(key));
    }
  }

  if (document.body.classList.contains('dm-welcome')) {
    for (const region of document.querySelectorAll('.dm-header, .dm-shell')) translateRegion(region);
  } else {
    for (const template of document.querySelectorAll('template[id^="dm-"]')) translateRegion(template.content);
    const preloader = document.querySelector('.preloader');
    if (preloader) translateRegion(preloader);
    if (!document.documentElement.classList.contains('digitalogic-monitoring-login')) return;
    const root = document.getElementById('reactRoot');
    const localRegions = '.dm-local-login-title, .login-content-box h1, .login-content-box legend, a[href$="/generic_oauth"]';
    const refresh = () => {
      for (const region of root.querySelectorAll(localRegions)) translateRegion(region);
    };
    new MutationObserver(refresh).observe(root, { childList: true, subtree: true });
    refresh();
  }
})();
