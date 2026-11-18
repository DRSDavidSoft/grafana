# Digitalogic Monitoring frontend for Grafana 13.2.3

The overlay adds the Persian Grafana and Scenes catalogs, right-to-left layout, the Digitalogic palette and typography, and language and theme buttons on the app navigation and public entry pages. The browser sends theme previews to peer tabs before saving and applies messages locally. Language changes use Grafana's user preference API when signed in and browser storage on public pages.

Signed-in users can collapse the details of each workspace shortcut and drag cards by their handles. The grip button also offers Move earlier and Move later for keyboard use. The browser stores each user's layout separately for each organization. Dashboard link dropdowns show the current dashboard with a checkmark when it matches the dropdown's tags.

For Persian, Grafana's sidebar docks on the right and the grid starts at the right edge. The grid converts physical column positions back to Grafana's stored coordinates when items are moved or resized. Time series retain their chronological axis direction. Persian typography uses the Farsi Digits webfonts from [Vazirmatn v33.003](https://github.com/rastikerdar/vazirmatn/tree/v33.003), distributed with the SIL Open Font License 1.1 in `fonts/vazirmatn/OFL.txt`.

The catalogs match Grafana 13.2.3 and Scenes 8.13.5. They were machine translated, checked against the English message keys and placeholders, and edited for common interface terminology. Crowdin is the upstream translation workflow. Submit the catalog that matches the source revision in the project and route it through proofreading. Dashboard titles, queries, and text entered by users retain their stored content.

## Persian dashboard content

Provisioned dashboard definitions can have a separate Persian display catalog. In the signed-in Persian view the overlay translates authored labels, descriptions, legend entries, and known status values. It leaves the saved dashboard, queries, and value mappings in their original form. Persian numeric Stat values use weight 700, retain units in reading order, and are capped at 64px. All text Stat values, including unknown mappings, relative times and no-data states, wrap at a maximum of 24px and weight 400 in the native renderer. This does not depend on the display catalog loading or a list of known messages. Series names have a separate 18px cap. Exact authored catalog entries take precedence over anchored display templates; captured labels are preserved or translated through exact catalog entries. Queries and editable controls are never translated. Run the maintained presentation regression checks after generating a new native bundle. Ad hoc filter expressions retain label/operator/value order while the surrounding variable labels follow the interface direction. The display catalog also covers generated table headings and dropdown labels.

Keep the catalog outside public assets. Use dashboard UIDs as the top-level JSON keys. Each value contains a `strings` object mapping exact English display strings to Persian and an optional `title` object with `original` and `value` fields for the browser page title. The optional `extract_dashboard_text.py` utility lists candidate strings from provisioned V1 and V2 JSON files for review.

Run `dashboard-locales-server.py` with Python 3 as a native service and pass the trusted Grafana address as `--backend host:port` and its configured host name as `--virtual-host host`. Set the systemd credential `dashboard-catalog` to the private catalog file. Route `/_monitoring/dashboard-locales/` on the Grafana origin to the loopback service before the general Grafana proxy rule. The service returns a single dashboard catalog after Grafana grants the same browser session access to that dashboard and marks responses private and uncached.

## Preparing the native overlay

Run from this directory using the installed Grafana 13.2.3 build and the existing Digitalogic branding templates.

```sh
python3 patch_assets.py /opt/digitalogic-monitoring/grafana/public/build /tmp/grafana-build
python3 patch_templates.py /etc/digitalogic-monitoring/grafana/branding /tmp/grafana-templates
```

The bundle generator verifies the original files against the vendor manifest. It emits distinct filenames and updated integrity hashes. It requires compatible assets after a Grafana upgrade. Keep a copy of the original manifest and templates for rollback.

Install the generated JavaScript chunks and manifest in Grafana's `public/build`, and install the generated index as `public/views/index.html` and as the managed branding copy. Install the welcome template in the managed branding directory and as the public welcome page. Put `preferences.js`, `preferences.css`, `branding-fa.js`, `dashboard-locales.js`, `workspace-cards.js`, and `workspace-cards.css` in `public/img`. Copy the `fonts/vazirmatn` directory into `public/img/fonts` beside the stylesheet path. Install the two catalogs under `public/locales/fa-IR` using their existing filenames. Restart the native Grafana service to reload the index and manifest. Restore the original manifest and templates and restart the service to roll back.

## Verification

Check Persian sign-in and the signed-in Profile page on desktop and mobile. Switch the navbar language and reload to verify the saved preference. Open two tabs for the same account and organization and change the Profile theme without saving. The second tab should reflect the preview while the preference API reports the previously saved value. Check both theme palettes and confirm the Vazirmatn Farsi Digits font loads.

Load a dashboard with a known status mapping in Persian and English. In the Persian view check the row and panel titles, a tooltip, the current status, and table headers. Check the live stat weight and unit order on narrow and wide screens. Confirm that unauthorized dashboard requests also deny access to the matching catalog.

Generate the pinned bundle and run the presentation checks with Node.js and Python 3.

```sh
python3 patch_assets.py /opt/digitalogic-monitoring/grafana/public/build /tmp/grafana-build --core-only
node presentation-regression/test_dashboard_presentation.cjs /tmp/grafana-build
```

The checks exercise the generated renderer and synthetic display templates using Node.js built-ins. Shared duration words and generated accessible labels use the same display adapter. Nested template expansion is bounded to four levels.
