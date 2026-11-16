#!/usr/bin/env python3
"""Collect user-facing text from provisioned Grafana dashboards."""
import argparse
import json
import re
from pathlib import Path

DISPLAY_KEYS = {"title", "description", "label", "legendFormat", "displayName", "displayNameFromDS", "noValue"}
SINGLE_QUOTED = re.compile(r"'((?:[^']|'')*)'")
DOUBLE_QUOTED = re.compile(r'"((?:[^"\\]|\\.)*)"')
HUMAN_LITERAL = re.compile(r"[A-Z][A-Za-z][A-Za-z0-9 &(),./+:%–-]{3,165}")
TECHNICAL = re.compile(r"(?:https?://|[/][a-z0-9]+[/]|\b[\w-]+\.(?:com|ir|net|org|local)\b)", re.I)


def read_dashboards(directory):
    for file in sorted(directory.glob("*.json")):
        value = json.loads(file.read_text())
        uid = value.get("uid") or value.get("metadata", {}).get("name")
        if isinstance(uid, str):
            yield uid, value


def dashboard_text(value):
    entries = {}

    def add(text, field):
        if isinstance(text, str) and re.search(r"[A-Za-z]", text.strip()) and not TECHNICAL.search(text):
            entries.setdefault(text.strip(), set()).add(field)

    def walk(node, path=()):
        if isinstance(node, list):
            for item in node:
                walk(item, path)
        elif isinstance(node, dict):
            for key, child in node.items():
                if key in DISPLAY_KEYS and key != "label" or key == "label" and ("variables" in path or "templating" in path):
                    add(child, key)
                if key == "text" and ("mappings" in path or "options" in path or "current" in path):
                    add(child, "text")
                if key == "value" and node.get("id") in {"displayName", "noValue"}:
                    add(child, node["id"])
                if key in {"renameByName"} and isinstance(child, dict):
                    for source, destination in child.items():
                        add(source, "column")
                        add(destination, "column")
                if key == "content" and isinstance(child, str) and "options" in path:
                    for line in child.splitlines():
                        add(re.sub(r"^[#>* -]+", "", line.strip()), "markdown")
                if key in {"expr", "rawSql"} and isinstance(child, str):
                    for match in (DOUBLE_QUOTED if key == "expr" else SINGLE_QUOTED).finditer(child):
                        literal = match[1].replace("''", "'")
                        if HUMAN_LITERAL.fullmatch(literal) and " " in literal:
                            add(literal, "literal")
                    if key == "rawSql":
                        for match in re.finditer(r'(?i)\bAS\s+"([^"]+)"', child):
                            add(match[1], "column")
                walk(child, (*path, key))

    walk(value)
    return entries


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dashboards", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    result = {uid: {text: sorted(fields) for text, fields in sorted(dashboard_text(value).items())}
              for uid, value in read_dashboards(args.dashboards)}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
