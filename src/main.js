import './style.css';
import wasmUrl from 'lindera-wasm-web-ipadic/lindera_wasm_bg.wasm?url';
import dictJson from '../data/dict.json';
import { createAnalyzer } from './analyzer.js';
import { createDict } from './engine/dict.js';
import { createConverter } from './engine/convert.js';
import { changedMask } from './diff.js';
import { countX, X_LIMIT } from './engine/count.js';

const $ = (id) => document.getElementById(id);
const input = $('input');
const output = $('output');
const status = $('status');
const count = $('count');
const copyBtn = $('copy');
const post = $('post');
const copyLive = $('copy-live');
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
  output.replaceChildren();
  output.hidden = true;
}

/** 変換後の字（text）のうち元の字（source）から変わった所だけを圏点の span にする */
function appendConverted(frag, seg) {
  const chars = Array.from(seg.text);
  const mask = changedMask(seg.source, seg.text);
  let run = '';
  let runChanged = false;
  const flush = () => {
    if (!run) return;
    if (runChanged) {
      const span = document.createElement('span');
      span.className = 'converted';
      span.textContent = run;
      frag.append(span);
    } else {
      frag.append(document.createTextNode(run));
    }
    run = '';
  };
  chars.forEach((ch, i) => {
    if (mask[i] !== runChanged) flush();
    runChanged = mask[i];
    run += ch;
  });
  flush();
}

function render() {
  if (!converter) return;
  const text = input.value;
  let out = '';
  if (text === '') {
    showMessage(EMPTY);
  } else {
    let r;
    try {
      r = converter.convert(text, { smallToLarge: small.checked });
    } catch (e) {
      console.error(e);
      showMessage('変換できませんでした');
      r = null;
    }
    if (r) renderResult(r);
    out = r ? r.output : '';
  }
  finish(out);
}

function renderResult(r) {
  const frag = document.createDocumentFragment();
  for (const seg of r.segments) {
    if (seg.status === 'kept') {
      frag.append(document.createTextNode(seg.text));
    } else if (seg.status === 'converted') {
      appendConverted(frag, seg);
    } else {
      const span = document.createElement('span');
      span.textContent = seg.text;
      span.className = 'unverified';
      span.title = '未確認';
      frag.append(span);
    }
  }
  output.replaceChildren(frag);
  output.hidden = false;
  status.hidden = true;
}

function finish(out) {
  result = out;
  const n = countX(out);
  count.textContent = `${n} / ${X_LIMIT}${n > X_LIMIT ? '（超過）' : ''}`;
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
  copyLive.textContent = label;
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copyBtn.textContent = 'コピー';
    copyLive.textContent = '';
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
