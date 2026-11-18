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


def patch_chrome_direction(source):
    # AppChrome navigation, the mobile drawer, and dashboard controls use logical edges.
    edges = [
        ('dockedMegaMenu:(0,jt.css)({background:le?M.colors.background.canvas:M.colors.background.primary,borderRight:',
         'dockedMegaMenu:(0,jt.css)({insetInlineStart:0,background:le?M.colors.background.canvas:M.colors.background.primary,borderInlineEnd:'),
        ('scopesDashboardsContainerDocked:(0,jt.css)({left:fl},le&&{left:',
         'scopesDashboardsContainerDocked:(0,jt.css)({insetInlineStart:fl},le&&{insetInlineStart:'),
        ('zIndex:M.zIndex.navbarFixed,left:0,right:0,background:le?',
         'zIndex:M.zIndex.navbarFixed,insetInline:0,background:le?'),
        ('topNavMenuDocked:(0,jt.css)({left:fl})', 'topNavMenuDocked:(0,jt.css)({insetInlineStart:fl})'),
        ('pageContainerMenuDocked:(0,jt.css)({paddingLeft:fl})', 'pageContainerMenuDocked:(0,jt.css)({paddingInlineStart:fl})'),
        ('pageContainerMenuDockedScopes:(0,jt.css)({paddingLeft:', 'pageContainerMenuDockedScopes:(0,jt.css)({paddingInlineStart:'),
        ('paddingLeft:B?M.spacing(J?.5:3.5):M.spacing(1)', 'paddingInlineStart:B?M.spacing(J?.5:3.5):M.spacing(1)'),
        ('right:0}),sidebarContainerFloating', 'insetInlineEnd:0}),sidebarContainerFloating'),
        ('enable:{left:!0},onResize:(Us,Uo,dr)=>Me(dr.getBoundingClientRect().width),handleClasses:{left:Pa.dragHandleBaseVertical}',
         'enable:{[document.dir==="rtl"?"right":"left"]:!0},onResize:(Us,Uo,dr)=>Me(dr.getBoundingClientRect().width),handleClasses:{[document.dir==="rtl"?"right":"left"]:Pa.dragHandleBaseVertical}'),
        ('menu:(0,jt.css)({display:"flex",bottom:0,flexDirection:"column",left:0,right:0,',
         'menu:(0,jt.css)({display:"flex",bottom:0,flexDirection:"column",insetInlineStart:0,insetInlineEnd:0,'),
        ('[M.breakpoints.up("md")]:{right:"unset"}}),wrapper:',
         '[M.breakpoints.up("md")]:{insetInlineEnd:"unset"}}),wrapper:'),
        ('zIndex:M.zIndex.modal,position:"fixed",top:`${(0,gl.vn)()}px`,borderRight:',
         'zIndex:M.zIndex.modal,position:"fixed",top:`${(0,gl.vn)()}px`,borderInlineEnd:'),
        ('rightControls:(0,n.css)({display:"flex",gap:Pt.spacing(1),float:"right"',
         'rightControls:(0,n.css)({display:"flex",gap:Pt.spacing(1),float:"inline-end"'),
    ]
    for old, new in edges:
        source = replace(source, old, new)
    return source


def patch_toolbar_direction(source):
    # Keep the outside of a split button rounded in the current writing direction.
    source = replace(
        source,
        'borderTopLeftRadius:"unset",borderBottomLeftRadius:"unset",borderLeft:"1px solid rgba(255, 255, 255, 0.12)"',
        'borderStartStartRadius:0,borderEndStartRadius:0,borderInlineStart:"1px solid rgba(255, 255, 255, 0.12)"',
    )
    source = replace(
        source,
        'borderTopRightRadius:"unset",borderBottomRightRadius:"unset",borderRight:"1px solid rgba(0, 0, 0, 0.12)"',
        'borderStartEndRadius:0,borderEndEndRadius:0,borderInlineEnd:"1px solid rgba(0, 0, 0, 0.12)"',
    )
    source = replace(
        source,
        '!j&&(0,t.jsx)(d.f,{className:(0,n.css)({borderTopLeftRadius:"unset",borderBottomLeftRadius:"unset"}),value:Q',
        '!j&&(0,t.jsx)(d.f,{value:Q',
    )
    for old, new in [
        ('height:"16px",marginRight:p.spacing(1)}),buttonFullWidth:',
         'height:"16px",marginInlineEnd:p.spacing(1)}),buttonFullWidth:'),
        ('contentWithIcon:(0,n.css)({display:"none",paddingLeft:', 'contentWithIcon:(0,n.css)({display:"none",paddingInlineStart:'),
        ('contentWithRightIcon:(0,n.css)({paddingRight:', 'contentWithRightIcon:(0,n.css)({paddingInlineEnd:'),
        ('icon:"angle-double-left",type:"button",iconSize:"xl","data-testid":d.Tp.components.TimePicker.moveBackwardButton',
         'icon:document.dir==="rtl"?"angle-double-right":"angle-double-left",type:"button",iconSize:"xl",'
         '"data-testid":d.Tp.components.TimePicker.moveBackwardButton'),
        ('icon:"angle-double-right",type:"button",variant:Ue,iconSize:"xl","data-testid":d.Tp.components.TimePicker.moveForwardButton',
         'icon:document.dir==="rtl"?"angle-double-left":"angle-double-right",type:"button",variant:Ue,iconSize:"xl",'
         '"data-testid":d.Tp.components.TimePicker.moveForwardButton'),
    ]:
        source = replace(source, old, new)
    # Localize visible durations and accessible names while preserving Grafana's URL values.
    return replace(
        source,
        'return{label:C,value:C,ariaLabel:I}});return D&&x.unshift',
        """
        const locale = document.documentElement.lang;
        const duration = /^(\\d+)(ms|[smhdwMy])$/.exec(C);
        if (/^fa(?:-|$)/.test(locale) && duration) {
          const units = {ms:"millisecond",s:"second",m:"minute",h:"hour",d:"day",w:"week",M:"month",y:"year"};
          const label = new Intl.NumberFormat(locale, {
            style:"unit",unit:units[duration[2]],unitDisplay:"long"
          }).format(Number(duration[1]));
          return {label,value:C,ariaLabel:label};
        }
        return{label:C,value:C,ariaLabel:I}});return D&&x.unshift""",
    )


def patch_core(source):
    source = patch_toolbar_direction(patch_chrome_direction(source))
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
    # BigValue uses the same weight when fitting values and when drawing them.
    source = replace(source, 'v=1.2,b=30,g=500;class y{constructor(j)', 'v=1.2,b=30,g=700;class y{constructor(j)')
    source = replace(
        source,
        'fontWeight:g,lineHeight:v,position:"relative",zIndex:1};switch(this.justifyCenter',
        'fontWeight:g,lineHeight:v,position:"relative",zIndex:1};'
        'if(Number.isFinite(this.props.value.numeric)&&/^[+−-]?[\\p{Nd}]/u.test(this.textValues.text)){j.direction="ltr";j.unicodeBidi="isolate"}'
        'if(/^fa(?:-|$)/.test(document.documentElement.lang)){'
        'const dmNumber=Number.isFinite(this.props.value.numeric)&&/^[+−-]?[\\p{Nd}\\s.,٫٬%٪eE+−-]+$/u.test(this.textValues.text.trim());'
        'j["--dm-stat-kind"]=dmNumber?"number":"text";'
        'j.fontSize=Math.min(j.fontSize,dmNumber?64:Math.max(12,Math.min(24,this.maxTextWidth/9,this.maxTextHeight/2.6)));'
        'j.maxWidth="100%";j.whiteSpace="normal";j.overflowWrap="anywhere";j.lineHeight=1.3;'
        'if(!dmNumber){j.fontWeight=400;j.direction="rtl";j.unicodeBidi="plaintext"}}'
        'switch(this.justifyCenter',
    )
    # Stable semantic hooks, independent of generated CSS names and inline weights.
    source = replace(source, 'style:V,onClick:j,title:H,children:',
                     'style:V,onClick:j,title:H,"data-dm-stat":"","data-dm-stat-kind":G["--dm-stat-kind"],children:')
    source = replace(source, 'className:W,style:V,title:H,children:',
                     'className:W,style:V,title:H,"data-dm-stat":"","data-dm-stat-kind":G["--dm-stat-kind"],children:')
    title = '("div",{style:U,children:Q.title})'
    if source.count(title) != 2:
        raise ValueError('Expected both linked and unlinked Stat title renderers')
    source = source.replace(title, '("div",{style:U,"data-dm-stat-name":"",children:Q.title})')
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
    source = replace(
        source,
        'o=async i=>(await a[i]()).default',
        'o=async i=>i==="fa-IR"?window.digitalogicPreferences.loadPersian("grafana-scenes"):(await a[i]()).default',
    )
    # RGL translates from the physical left. Mirror at its boundary before rendering and after edits.
    source = replace(
        source,
        'className:"react-grid-layout"},a.createElement(v(),{width:se',
        'className:"react-grid-layout","data-dm-rtl-grid":document.dir==="rtl"?"":void 0},a.createElement(v(),{width:se',
    )
    return replace(
        source,
        'onResizeStop:ee.onResizeStop,onLayoutChange:ee.onLayoutChange,isBounded:!1,resizeHandle:a.createElement(O,null)',
        'onResizeStop:ee.onResizeStop,onLayoutChange:ee.onLayoutChange,isBounded:!1,resizeHandle:a.createElement(O,null),'
        '...window.digitalogicPreferences.rtlGridProps(Pe,n.cV,ee)',
    )


def prepare(build, output, core_only=False):
    manifest = json.loads((build / "assets-manifest.json").read_text())
    assets = manifest["entrypoints"]["app"]["assets"]["js"]
    output.mkdir(parents=True, exist_ok=True)
    patches = [(CORE_CHUNK, patch_core)]
    if not core_only:
        patches.append((SCENES_CHUNK, patch_scenes))
    for chunk, patch in patches:
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
    parser.add_argument("--core-only", action="store_true")
    args = parser.parse_args()
    prepare(args.original_build, args.output_dir, core_only=args.core_only)
