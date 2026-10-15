"""Convert the Landing.dc.html canvas artboard into a React component (JSX + logic shim)."""
import re, sys, json
from html.parser import HTMLParser

src = open(sys.argv[1], encoding='utf-8').read()
out_dir = sys.argv[2]

css = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
body = re.search(r'</helmet>(.*)</x-dc>', src, re.S).group(1)
script = re.search(r'<script type="text/x-dc"[^>]*>(.*?)</script>', src, re.S).group(1)

LINKS = {'Onboarding.dc.html': '/comecar', 'Login.dc.html': '/entrar', 'Main.dc.html': '/entrar',
         'MeuDia.dc.html': '/entrar', 'Ajuda.dc.html': '#duvidas'}
for k, v in LINKS.items():
    body = body.replace(f'href="{k}"', f'href="{v}"')
    script = script.replace(f"'{k}'", f"'{v}'")
body = re.sub(r'<!--.*?-->', '', body, flags=re.S)

ATTR = {'class': 'className', 'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin',
        'fill-rule': 'fillRule', 'clip-rule': 'clipRule', 'text-anchor': 'textAnchor', 'font-size': 'fontSize', 'font-weight': 'fontWeight',
        'onclick': 'onClick', 'for': 'htmlFor', 'tabindex': 'tabIndex', 'viewbox': 'viewBox', 'preserveaspectratio': 'preserveAspectRatio',
        'aria-labelledby': 'aria-labelledby'}
HOLE = re.compile(r'\{\{\s*([^}]+?)\s*\}\}')
LOOPVARS = set(re.findall(r'<sc-for[^>]*\bas="([a-zA-Z_]+)"', src))
def ref(h):
    root = re.match(r'[A-Za-z_$][\w$]*', h).group(0)
    return h if root in LOOPVARS else 'v.' + h

def expr(v):
    """attribute/text value with holes -> JS expression"""
    parts = HOLE.split(v)
    if len(parts) == 3 and parts[0] == '' and parts[2] == '':
        return ref(parts[1])
    s = ''
    for i, p in enumerate(parts):
        s += ('${' + ref(p) + '}') if i % 2 else p.replace('`', '\\`')
    return '`' + s + '`'

def camel(p):
    p = p.strip()
    if p.startswith('--'): return f"'{p}'"
    return re.sub(r'-([a-z])', lambda m: m.group(1).upper(), p)

def style_obj(v):
    items = []
    for decl in [d for d in re.split(r';(?![^(]*\))', v) if d.strip()]:
        k, _, val = decl.partition(':')
        val = val.strip()
        items.append(f"{camel(k)}: {expr(val) if HOLE.search(val) else json.dumps(val, ensure_ascii=False)}")
    return '{{ ' + ', '.join(items) + ' }}'

VOID = {'br', 'img', 'input', 'meta', 'link', 'hr'}

class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.o = []
        self.stack = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'sc-for':
            lst = ref(HOLE.search(a['list']).group(1))
            self.o.append(f"{{({lst} || []).map(({a['as']}: any, __i{len(self.stack)}: number) => (<Fragment key={{__i{len(self.stack)}}}>")
            self.stack.append('sc-for'); return
        if tag == 'sc-if':
            v = ref(HOLE.search(a['value']).group(1))
            self.o.append(f"{{!!({v}) && (<>")
            self.stack.append('sc-if'); return
        s = '<' + tag
        for k, v in attrs:
            if k.startswith('hint-'): continue
            name = ATTR.get(k, k)
            if v is None: s += f' {name}'; continue
            if k == 'style': s += f' style={style_obj(v)}'
            elif HOLE.search(v): s += f' {name}={{{expr(v)}}}'
            else: s += f' {name}={json.dumps(v, ensure_ascii=False)}'
        if tag in VOID: s += ' />'
        else: s += '>'; self.stack.append(tag)
        self.o.append(s)
    def handle_endtag(self, tag):
        if tag in VOID: return
        t = self.stack.pop()
        if t == 'sc-for': self.o.append('</Fragment>))}')
        elif t == 'sc-if': self.o.append('</>)}')
        else: self.o.append(f'</{tag}>')
    def handle_data(self, d):
        d = d.replace('{', '\x00').replace('}', '\x01')
        d = re.sub(r'\x00\x00\s*([^\x01]+?)\s*\x01\x01', lambda m: '{' + ref(m.group(1)) + '}', d)
        d = d.replace('\x00', "{'{'}").replace('\x01', "{'}'}")
        self.o.append(d)
    def handle_entityref(self, name): self.o.append(f'&{name};')
    def handle_charref(self, name): self.o.append(f'&#{name};')

p = P(); p.feed(body)
jsx = ''.join(p.o)

# logic: keep the DC class, run it through a tiny shim
logic = script.replace('class Component extends DCLogic', 'class LandingLogic extends DCLogic')

tsx = f'''// Generated from the canvas artboard Landing.dc.html (scripts/dc2jsx.py). Edit the canvas, then regenerate.
/* eslint-disable */
// @ts-nocheck
import {{ Fragment, useEffect, useReducer, useRef }} from 'react';
import './landing.css';

class DCLogic {{
  props: any; state: any = {{}}; _update: () => void = () => {{}};
  constructor(props: any) {{ this.props = props; }}
  setState(patch: any) {{ this.state = {{ ...this.state, ...patch }}; this._update(); }}
}}

{logic}

export default function Landing() {{
  const [, force] = useReducer((n: number) => n + 1, 0);
  const ref = useRef<any>(null);
  if (!ref.current) ref.current = new LandingLogic({{}});
  const inst = ref.current;
  inst._update = force;
  useEffect(() => {{ inst.componentDidMount?.(); return () => inst.componentWillUnmount?.(); }}, []);
  const v = inst.renderVals();
  return (
    {jsx.strip()}
  );
}}
'''
open(f'{out_dir}/Landing.tsx', 'w', encoding='utf-8').write(tsx)
open(f'{out_dir}/landing.css', 'w', encoding='utf-8').write('/* Generated from Landing.dc.html */\n' + css.strip() + '\n')
print('ok', len(tsx))
