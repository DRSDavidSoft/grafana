const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
assert.ok(process.argv[2], 'Pass the directory produced by patch_assets.py');
const build = path.resolve(process.argv[2]);
const chunkName = fs
  .readdirSync(build)
  .find((name) => /^6540\.digitalogic\..*\.js$/.test(name));
assert.ok(chunkName, 'Generated Grafana core bundle was not found');
const source = fs.readFileSync(path.join(build, chunkName), 'utf8');
const start = source.indexOf('getValueStyles(){');
const end = source.indexOf('getPercentChangeStyles(', start);
assert.ok(start > 0 && end > start);
// Exercise the pinned renderer without loading Grafana's browser runtime.
const method = source.slice(start, end);
function style(
  text,
  numeric,
  lang = 'fa-IR',
  width = 380,
  height = 130,
  size = 150
) {
  const Stat = vm.runInNewContext(`(class { ${method} })`, {
    document: { documentElement: { lang } },
    v: 1.2,
    g: 700,
    u: {
      yp: {
        Value: 'value',
        None: 'none',
        Background: 'background',
        BackgroundSolid: 'solid',
      },
    },
    d: { mZ: () => '#fff' },
  });
  const instance = Object.assign(new Stat(), {
    props: {
      value: { numeric },
      colorMode: 'none',
      theme: { colors: { text: { primary: '#222' } } },
    },
    textValues: { text },
    valueFontSize: size,
    justifyCenter: true,
    maxTextWidth: width,
    maxTextHeight: height,
  });
  return instance.getValueStyles();
}
let checks = 0;
for (const [text, numeric] of [
  ['No data', NaN],
  ['داده‌ای وجود ندارد', NaN],
  ['An entirely new unmapped status message', NaN],
  ['۱۳ دقیقه پیش', 1795000000000],
  ['Queue clear', 0],
  ['خروجی دریافت نشده است', NaN],
  ['N/A', NaN],
]) {
  const actual = style(text, numeric);
  assert.ok(actual.fontSize <= 24, text);
  assert.equal(actual.fontWeight, 400);
  assert.equal(actual.whiteSpace, 'normal');
  assert.equal(actual.overflowWrap, 'anywhere');
  assert.equal(actual['--dm-stat-kind'], 'text');
  checks++;
}
for (const text of ['8,363', '۱۲٬۳۴۵', '0', '99.9', '−12', '1e+6']) {
  const actual = style(text, 42);
  assert.equal(actual.fontSize, 64, text);
  assert.equal(actual.fontWeight, 700);
  assert.equal(actual.direction, 'ltr');
  assert.equal(style(text, 42, 'fa-IR', 380, 130, 16).fontSize, 16);
  checks++;
}
assert.equal(style('No data', NaN, 'fa-IR', 100, 70).fontSize, 12);
assert.equal(style('No data', NaN, 'en-US').fontSize, 150);
assert.equal(
  (source.match(/"data-dm-stat-kind":G\["--dm-stat-kind"\]/g) || []).length,
  2
);
checks += 3;

const overlay = fs.readFileSync(
  path.join(root, 'dashboard-locales.js'),
  'utf8'
);
const functions = overlay.slice(
  overlay.indexOf('  function compileTemplates('),
  overlay.indexOf('  function localizeText(')
);
const sharedDefinition = overlay.slice(
  overlay.indexOf('  const sharedCatalog'),
  overlay.indexOf('  const subUrl')
);
const commonStrings = vm.runInNewContext(
  `(() => { ${sharedDefinition}; return sharedCatalog; })()`
);
// Synthetic authored labels exercise interpolation without an instance catalog.
const catalog = {
  ...commonStrings,
  Current: 'به‌روز',
  'Last known': 'آخرین ثبت معتبر',
  'Sensor {{sensor}} · {{state}}': 'حسگر {{sensor}} · {{state}}',
  'Remaining · {{sensor}}': 'مانده · {{sensor}}',
  'Used · {{service}} / {{window}}': 'مصرف · {{service}} / {{window}}',
  '{{service}} / {{window}}': '{{service}} · {{window}}',
  'Window length · {{service}} / {{window}}':
    'طول بازه · {{service}} / {{window}}',
  'Credits · {{service}}': 'اعتبار · {{service}}',
  telemetry: 'پایش',
  primary: 'بازهٔ اصلی',
  secondary: 'بازهٔ دوم',
  'Sensor node-special · Current': 'ترجمهٔ اختصاصی',
  'Sampling period': 'بازهٔ نمونه‌برداری',
  'Telemetry dashboard': 'داشبورد پایش',
};
const translate = vm.runInNewContext(
  `(() => { const catalog = input; ${functions}; const templates = compileTemplates(catalog); return localize; })()`,
  { input: catalog }
);
for (const [original, expected] of [
  ['Sensor node-a · Current', 'حسگر node-a · به‌روز'],
  ['Sensor node-b · Last known', 'حسگر node-b · آخرین ثبت معتبر'],
  ['Remaining · node-a', 'مانده · node-a'],
  ['Used · telemetry / primary', 'مصرف · پایش / بازهٔ اصلی'],
  ['telemetry / secondary', 'پایش · بازهٔ دوم'],
  ['Window length · telemetry / primary', 'طول بازه · پایش / بازهٔ اصلی'],
  ['  Remaining · node-a  ', '  مانده · node-a  '],
  ['Credits · service-$x', 'اعتبار · service-$x'],
  [
    'Unrelated English outside authored templates',
    'Unrelated English outside authored templates',
  ],
  ['Sensor node-special · Current', 'ترجمهٔ اختصاصی'],
  ['Current', 'به‌روز'],
  [' days', ' روز'],
  ['hours', 'ساعت'],
  [
    'ویرایش رنگ برای Remaining · telemetry &#x2F; primary',
    'ویرایش رنگ مانده · پایش · بازهٔ اصلی',
  ],
  ['منوی پانل Sampling period', 'منوی پنل بازهٔ نمونه‌برداری'],
  [
    '"Telemetry dashboard" را به عنوان مورد علاقه علامت بزنید',
    'نشان‌گذاری «داشبورد پایش» به‌عنوان مورد علاقه',
  ],
]) {
  assert.equal(translate(original), expected);
  checks++;
}

// Template text is literal, repeated variables must agree, unknown labels survive.
const custom = {
  'Cost (p95) · {{host}}': 'هزینه · {{host}}',
  '{{name}} = {{name}}': '{{name}} برابر است',
};
const customTranslate = vm.runInNewContext(
  `(() => { const catalog = input; ${functions}; const templates = compileTemplates(catalog); return localize; })()`,
  { input: custom }
);
assert.equal(customTranslate('Cost (p95) · host1'), 'هزینه · host1');
assert.equal(customTranslate('Cost Xp95Y · host1'), 'Cost Xp95Y · host1');
assert.equal(customTranslate('one = two'), 'one = two');
assert.equal(customTranslate('one = one'), 'one برابر است');
assert.equal(customTranslate('Cost (p95) · <label>'), 'هزینه · <label>');
assert.equal(
  customTranslate('Cost (p95) · ' + 'x'.repeat(2048)),
  'Cost (p95) · ' + 'x'.repeat(2048)
);
checks += 6;
console.log(JSON.stringify({ checks, chunkName, passed: true }));
