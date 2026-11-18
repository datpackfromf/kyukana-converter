import './style.css';
import wasmUrl from 'lindera-wasm-web-ipadic/lindera_wasm_bg.wasm?url';
import dictJson from '../data/dict.json';
import { createAnalyzer } from './analyzer.js';
import { createDict } from './engine/dict.js';
import { createConverter } from './engine/convert.js';
import { countX, X_LIMIT } from './engine/count.js';

const $ = (id) => document.getElementById(id);
const input = $('input');
const output = $('output');
const status = $('status');
const count = $('count');
const copyBtn = $('copy');
const post = $('post');
const small = $('small-to-large');
const STORE_KEY = 'kyukana:smallToLarge';
const EMPTY = 'ここに旧かなが出ます';

let converter = null;
let result = '';
let timer = 0;
let copyTimer = 0;

try {
  if (localStorage.getItem(STORE_KEY) === 'false') small.checked = false;
} catch {
  // 保存できなくても動く
}

function showMessage(text) {
  status.textContent = text;
  status.hidden = false;
  output.hidden = true;
}

function render() {
  if (!converter) return;
  const text = input.value;
  let out = '';
  if (text === '') {
    showMessage(EMPTY);
  } else {
    const r = converter.convert(text, { smallToLarge: small.checked });
    out = r.output;
    const frag = document.createDocumentFragment();
    for (const seg of r.segments) {
      if (seg.status === 'kept') {
        frag.append(document.createTextNode(seg.text));
        continue;
      }
      const span = document.createElement('span');
      span.textContent = seg.text;
      if (seg.status === 'unverified') {
        span.className = 'unverified';
        span.title = '未確認';
      } else {
        span.className = 'converted';
      }
      frag.append(span);
    }
    output.replaceChildren(frag);
    output.hidden = false;
    status.hidden = true;
  }
  result = out;
  const n = countX(out);
  count.textContent = `${n} / ${X_LIMIT}`;
  count.classList.toggle('over', n > X_LIMIT);
  copyBtn.disabled = out === '';
  if (out === '') {
    post.removeAttribute('href');
    post.setAttribute('aria-disabled', 'true');
  } else {
    post.href = 'https://x.com/intent/tweet?text=' + encodeURIComponent(out);
    post.setAttribute('aria-disabled', 'false');
  }
}

function flashCopy(label) {
  copyBtn.textContent = label;
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copyBtn.textContent = 'コピー';
  }, 1500);
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
  document.body.append(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

async function copy() {
  if (!result) return;
  let ok = false;
  try {
    await navigator.clipboard.writeText(result);
    ok = true;
  } catch {
    ok = fallbackCopy(result);
  }
  flashCopy(ok ? 'コピーしました' : 'コピーできませんでした');
}

input.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(render, 100);
});
small.addEventListener('change', () => {
  try {
    localStorage.setItem(STORE_KEY, String(small.checked));
  } catch {
    // 無視
  }
  clearTimeout(timer);
  render();
});
copyBtn.addEventListener('click', copy);
copyBtn.setAttribute('aria-live', 'polite');
post.addEventListener('click', (e) => {
  if (post.getAttribute('aria-disabled') === 'true') e.preventDefault();
});

showMessage('辞書を読み込んでいます…');
try {
  const analyzer = await createAnalyzer(wasmUrl);
  converter = createConverter({ analyzer, dict: createDict(dictJson) });
  render();
} catch (e) {
  console.error(e);
  showMessage('辞書を読み込めませんでした。再読み込みしてください。');
}
