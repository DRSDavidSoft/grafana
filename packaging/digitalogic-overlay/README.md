# Digitalogic Monitoring frontend for Grafana 13.2.3

The overlay adds the Persian Grafana and Scenes catalogs, right-to-left layout, the Digitalogic palette and typography, and language and theme buttons on the app navigation and public entry pages. The browser sends theme previews to peer tabs before saving and applies messages locally. Language changes use Grafana's user preference API when signed in and browser storage on public pages.

Signed-in users can collapse the details of each workspace shortcut and drag cards by their handles. The grip button also offers Move earlier and Move later for keyboard use. The browser stores each user's layout separately for each organization. Dashboard link dropdowns show the current dashboard with a checkmark when it matches the dropdown's tags.

The catalogs match Grafana 13.2.3 and Scenes 8.13.5. They were machine translated, checked against the English message keys and placeholders, and edited for common interface terminology. Crowdin is the upstream translation workflow. Submit the catalog that matches the source revision in the project and route it through proofreading. Dashboard titles, queries, and text entered by users retain their stored content.

## Preparing the native overlay

Run from this directory using the installed Grafana 13.2.3 build and the existing Digitalogic branding templates.

```sh
python3 patch_assets.py /opt/digitalogic-monitoring/grafana/public/build /tmp/grafana-build
python3 patch_templates.py /etc/digitalogic-monitoring/grafana/branding /tmp/grafana-templates
```

The bundle generator verifies the original files against the vendor manifest. It emits distinct filenames and updated integrity hashes. It requires compatible assets after a Grafana upgrade. Keep a copy of the original manifest and templates for rollback.

Install the generated JavaScript chunks and manifest in Grafana's `public/build`, and install the generated index as `public/views/index.html` and as the managed branding copy. Install the welcome template in the managed branding directory and as the public welcome page. Put `preferences.js`, `preferences.css`, `branding-fa.js`, `workspace-cards.js`, and `workspace-cards.css` in `public/img`. Use the existing licensed Digitalogic `YekanBakhFaNum-VF.woff2` beside the stylesheet. Install the two catalogs under `public/locales/fa-IR` using their existing filenames. Restart the native Grafana service to reload the index and manifest. Restore the original manifest and templates and restart the service to roll back.

## Verification

Check Persian sign-in and the signed-in Profile page on desktop and mobile. Switch the navbar language and reload to verify the saved preference. Open two tabs for the same account and organization and change the Profile theme without saving. The second tab should reflect the preview while the preference API reports the previously saved value. Check both theme palettes and confirm the Yekan Bakh FaNum VF face loads.
