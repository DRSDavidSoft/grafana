#!/usr/bin/env python3
"""Generate a Digitalogic overlay for the Grafana 13.2.3 native frontend."""
import argparse
import base64
import hashlib
import json
import re
from pathlib import Path

CORE_CHUNK = "6540.acf453ee99146ad315f3.js"
SCENES_CHUNK = "7606.e8e4d98948a4bb1cf3bc.js"


def replace(source, old, new):
    if source.count(old) != 1:
        raise ValueError(f"Expected one occurrence of {old!r} in the pinned Grafana bundle")
    return source.replace(old, new)


def patch_core(source):
    source = replace(source, '{code:t.mz,name:"T\\xFCrk\\xE7e"}]',
                     '{code:t.mz,name:"T\\xFCrk\\xE7e"},{code:"fa-IR",name:"فارسی"}]')
    source = replace(
        source,
        '()=>e(7170)(`./${B}/grafana.json`)',
        '()=>B==="fa-IR"?window.digitalogicPreferences.loadPersian():e(7170)(`./${B}/grafana.json`)',
    )
    source = replace(
        source, "function V(de,Ce={}){const{fontFamily:",
        "function V(de,Ce={}){Ce=window.digitalogicPreferences?.typography(Ce)??Ce;const{fontFamily:",
    )
    # This is Grafana 13.2.3's theme service. Preserve both native persistence paths.
    start = 'async function f(u,P){const p=o.$.theme2,E=(0,n.g)(u);'
    end = 'if(!P&&c.TP.isSignedIn)'
    before, rest = source.split(start)
    _, after = rest.split(end, 1)
    source = before + '''
function applyDigitalogicTheme(themeId) {
  const theme = (0,n.g)(themeId);
  window.digitalogicPreferences.setThemeStyles(theme.colors.mode, o.$.bootData.assets);
  i.l.publish(new l.E8(theme));
}
window.digitalogicPreferences.setThemeHandlers({
  apply: applyDigitalogicTheme,
  change: f,
  get: () => o.$.theme2.colors.mode,
});
async function f(u,P){
  applyDigitalogicTheme(u);
  window.digitalogicPreferences.publishTheme(u);
''' + end + after
    source = replace(
        source, 'if(f.TP.user.theme!=="system")return;',
        'if(window.digitalogicPreferences||f.TP.user.theme!=="system")return;',
    )
    source = replace(
        source,
        '(0,m.jsx)(j0,{}),!jn&&(0,m.jsx)(nb,{})',
        '(0,m.jsx)(j0,{}),(0,m.jsx)("div",{"data-dm-preferences":""}),!jn&&(0,m.jsx)(nb,{})',
    )
    # Keep the open dashboard in tag-based dropdowns and mark it as the current page.
    source = replace(source, 'if(on.uid===Rt)continue;', 'if(!Pt.asDropdown&&on.uid===Rt)continue;')
    source = replace(
        source,
        'label:en.title,testId:s.Tp.components.DashboardLinks.link',
        'label:en.title,icon:en.uid===Pt?"check":void 0,ariaCurrent:en.uid===Pt?"page":void 0,'
        'testId:s.Tp.components.DashboardLinks.link',
    )
    source = replace(
        source,
        '"data-role":"menuitem",ref:q,"data-testid":k,"aria-label":T,"aria-checked":I',
        '"data-role":"menuitem",ref:q,"data-testid":k,"aria-label":T,"aria-current":g.ariaCurrent,"aria-checked":I',
    )
    # Built-in themes get the same palette as the branded pages. Keep accessible and
    # optional Grafana themes available under their own palettes.
    for mode in ("light", "dark"):
        snippet = f'({{colors:{{mode:"{mode}"}}}})'
        check = re.findall(r'build:\(\)=>\(0,[\w$.]+\)' + re.escape(snippet), source)
        if len(check) != 1:
            raise ValueError(f"Could not identify the built-in {mode} theme")
        source = replace(source, check[0], check[0].replace(snippet, f'(window.digitalogicPreferences.brandTheme("{mode}"))'))
    return source


def sri(data):
    return " ".join(f"{algorithm}-{base64.b64encode(hashlib.new(algorithm, data).digest()).decode()}"
                    for algorithm in ("sha384", "sha512"))


def patch_scenes(source):
    return replace(
        source,
        'o=async i=>(await a[i]()).default',
        'o=async i=>i==="fa-IR"?window.digitalogicPreferences.loadPersian("grafana-scenes"):(await a[i]()).default',
    )


def prepare(build, output):
    manifest = json.loads((build / "assets-manifest.json").read_text())
    assets = manifest["entrypoints"]["app"]["assets"]["js"]
    output.mkdir(parents=True, exist_ok=True)
    for chunk, patch in [(CORE_CHUNK, patch_core), (SCENES_CHUNK, patch_scenes)]:
        original = (build / chunk).read_bytes()
        original_entry = manifest.get(chunk)
        if not original_entry or original_entry["integrity"] != sri(original):
            raise ValueError("Start from Grafana 13.2.3's original, verified frontend assets")
        updated = patch(original.decode()).encode()
        digest = hashlib.sha256(updated).hexdigest()[:20]
        chunk_id = chunk.split(".")[0]
        name = f"{chunk_id}.digitalogic.{digest}.js"
        path = f"public/build/{name}"
        original_path = original_entry["src"]
        matches = [
            index for index, value in enumerate(assets)
            if value == original_path or value.startswith(f"public/build/{chunk_id}.digitalogic.")
        ]
        if len(matches) != 1:
            raise ValueError(f"Could not identify original entrypoint {chunk}")
        assets[matches[0]] = path
        manifest[name] = {"src": path, "integrity": sri(updated)}
        (output / name).write_bytes(updated)
    (output / "assets-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("original_build", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    prepare(args.original_build, args.output_dir)
