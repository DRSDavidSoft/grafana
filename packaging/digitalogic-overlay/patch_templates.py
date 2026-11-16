#!/usr/bin/env python3
"""Attach the Digitalogic overlay assets to the current branding templates."""
import argparse
from pathlib import Path

ASSETS = (
    '<link rel="stylesheet" href="/public/img/preferences.css?v=2" />\n'
    '<script defer src="/public/img/preferences.js?v=1"></script>\n'
    '<script defer src="/public/img/branding-fa.js?v=2"></script>\n'
)


WORKSPACE_ASSETS = (
    '<link rel="stylesheet" href="/public/img/workspace-cards.css?v=1" />\n'
    '<script defer src="/public/img/workspace-cards.js?v=1"></script>\n'
)


def update_template(source, workspace=False):
    previous_assets = ASSETS.replace("preferences.css?v=2", "preferences.css?v=1").replace(
        "branding-fa.js?v=2", "branding-fa.js?v=1"
    )
    if previous_assets in source:
        source = source.replace(previous_assets, ASSETS, 1)
    if ASSETS not in source:
        if "preferences.js" in source or source.count("</head>") != 1:
            raise ValueError("Expected a recognized Grafana branding template")
        source = source.replace("</head>", ASSETS + "</head>", 1)
    if workspace and WORKSPACE_ASSETS not in source:
        if "workspace-cards.js" in source:
            raise ValueError("Expected a recognized workspace asset version")
        source = source.replace(ASSETS, ASSETS + WORKSPACE_ASSETS, 1)
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
