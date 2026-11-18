#!/usr/bin/env python3
"""Attach the Digitalogic overlay assets to the current branding templates."""
import argparse
import re
from pathlib import Path

ASSETS = (
    '<link rel="stylesheet" href="/public/img/preferences.css?v=6" />\n'
    '<script defer src="/public/img/preferences.js?v=5"></script>\n'
    '<script defer src="/public/img/branding-fa.js?v=3"></script>\n'
)


WORKSPACE_ASSETS = (
    '<link rel="stylesheet" href="/public/img/workspace-cards.css?v=1" />\n'
    '<script defer src="/public/img/workspace-cards.js?v=1"></script>\n'
)


DASHBOARD_LOCALES_ASSET = '<script defer src="/public/img/dashboard-locales.js?v=2"></script>\n'


def update_template(source, workspace=False):
    # Preserve the template and any independent workspace asset updates.
    for asset in re.findall(r'/public/img/[^"?]+\?v=\d+', ASSETS):
        prefix = asset.rsplit("=", 1)[0] + "="
        source = re.sub(rf'{re.escape(prefix)}\d+(?=")', lambda _: asset, source)
    if ASSETS not in source:
        if "preferences.js" in source or source.count("</head>") != 1:
            raise ValueError("Expected a recognized Grafana branding template")
        source = source.replace("</head>", ASSETS + "</head>", 1)
    if workspace and "workspace-cards.js" not in source:
        source = source.replace(ASSETS, ASSETS + WORKSPACE_ASSETS, 1)
    if workspace:
        source = re.sub(r'/public/img/dashboard-locales\.js\?v=\d+', '/public/img/dashboard-locales.js?v=2', source)
    if workspace and "dashboard-locales.js" not in source:
        source = source.replace("</head>", DASHBOARD_LOCALES_ASSET + "</head>", 1)
    return source


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("branding", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for file in ("index.html", "monitoring-welcome.html"):
        source = (args.branding / file).read_text()
        (args.output_dir / file).write_text(update_template(source, workspace=file == "index.html"))
