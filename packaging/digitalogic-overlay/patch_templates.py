#!/usr/bin/env python3
"""Attach the preference and Persian branding assets to Digitalogic's current templates."""
import argparse
from pathlib import Path

ASSETS = (
    '<link rel="stylesheet" href="/public/img/preferences.css?v=2" />\n'
    '<script defer src="/public/img/preferences.js?v=1"></script>\n'
    '<script defer src="/public/img/branding-fa.js?v=2"></script>\n'
)


def update_template(source):
    if ASSETS.strip() in source:
        return source
    if ASSETS.strip().replace("preferences.css?v=2", "preferences.css?v=1").replace("branding-fa.js?v=2", "branding-fa.js?v=1") in source:
        return source.replace("preferences.css?v=1", "preferences.css?v=2").replace("branding-fa.js?v=1", "branding-fa.js?v=2")
    if "preferences.js" in source or source.count("</head>") != 1:
        raise ValueError("Expected an unmodified Grafana branding template")
    return source.replace("</head>", ASSETS + "</head>", 1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("branding", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for file in ("index.html", "monitoring-welcome.html"):
        (args.output_dir / file).write_text(update_template((args.branding / file).read_text()))
