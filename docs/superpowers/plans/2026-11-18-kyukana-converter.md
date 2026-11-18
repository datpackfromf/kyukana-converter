# 旧かな変換Webページ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 現代仮名遣いの文をブラウザ内で歴史的仮名遣いに変換し、コピー／Xで投稿できる1ページのWebアプリを GitHub Pages で公開する。

**Architecture:** lindera(IPADIC, WASM) で分かち書き → 規則層（活用語尾・助動詞）→ 辞書層（data/dict.json、出典付き）の3層。エンジンは解析器を引数で受け取る純粋関数で、Node のテストとブラウザで同じ wasm を使う。画面は Vite でまとめた静的ページ。

**Tech Stack:** JavaScript (ESM, JSDoc), Vite, lindera-wasm-web-ipadic@2.0.0, node:test, Playwright（画面確認）, GitHub Actions + Pages。

**Spec:** `docs/superpowers/specs/2026-11-18-kyukana-converter-design.md`（判断は `docs/decisions.md`、出典は `docs/sources.md`）

## Global Constraints

- 入力テキストを外部へ送信しない（fetch/XHR は自サイトの wasm・json の取得だけ）。
- 乱暴な推測変換をしない。決まらない仮名部分はそのまま残し `unverified` にする。
- 漢字は変えない。旧字体変換はしない。
- 小書き→大書きオプションの初期値は ON。
- 文字数は twitter-text v3: U+0000–U+10FF, U+2000–U+200D, U+2010–U+201F, U+2032–U+2037 が重み1、他は2、絵文字1つ2、URL 23、上限 280。
- X投稿URL: `https://x.com/intent/tweet?text=` + `encodeURIComponent(結果)`。
- `data/dict.json` の全項目に `src` を持たせる。出典のない対応は入れない。
- Vite の `base` は `/kyukana-converter/`。
- 判断は `docs/decisions.md` に1行ずつ追記する。
- 不要ファイル・試作の残骸を残さない。

## Review Focus

1. 絵文字・URL・英数字・改行・空白が混じる入力 — 変換後もそれらが1文字も変わらず、順番も保たれる（Task 1 の「表層形の連結＝入力」テスト、Task 4 の混在テスト）。
2. 片仮名語（「コーヒー」「ケーキ」）— 変えず、未確認の下線も引かない（Task 4）。
3. 空文字・空白だけの入力 — 例外を出さず、出力は入力どおり、文字数0（Task 2・Task 4）。
4. 小書きオプション OFF — 「買った」は「買った」のまま、「言わない」は「言はない」（Task 4）。
5. 280を超える長文 — 変換は続き、文字数表示が警告色になる（Task 2 の count テスト、Task 5 の画面確認）。

---

## フェーズ2: 変換エンジン（ブランチ `phase2-engine`）

### Task 1: 土台と解析器アダプタ

**Files:**
- Create: `package.json`, `vite.config.js`, `src/analyzer.js`, `tests/helpers/analyzer-node.js`, `tests/analyzer.test.js`

**Interfaces:**
- Produces:
  - `createAnalyzer(moduleOrPath: string|URL|BufferSource): Promise<{ tokenize(text: string): Token[] }>`（`src/analyzer.js`）
  - `Token = { surface, pos, pos1, pos2, cType, cForm, base, reading }`（すべて string。未知の値は `''`。`reading` はカタカナ）
  - `getNodeAnalyzer(): Promise<Analyzer>`（`tests/helpers/analyzer-node.js`、wasm を `node_modules/lindera-wasm-web-ipadic/lindera_wasm_bg.wasm` から読む。1回だけ初期化してキャッシュ）
- Scripts: `npm test` = `node --test tests/`、`npm run dev` / `npm run build` = vite。

- [ ] **Step 1:** `package.json`（`"type": "module"`, private, license MIT, devDeps vite, deps lindera-wasm-web-ipadic@2.0.0）と `vite.config.js`（`base: '/kyukana-converter/'`）を作り `npm install`。
- [ ] **Step 2: 失敗するテストを書く** `tests/analyzer.test.js`
  - `surfaces concatenate to input`: 入力 `'今日は 雨🙂\nhttps://x.com/a ok。'` の `tokens.map(t=>t.surface).join('') === 入力`
  - `normalizes swapped conjugation fields`: `'言う'` の1トークンが `cType === '五段・ワ行促音便'` かつ `cForm === '基本形'`、`base === '言う'`、`reading === 'イウ'`
  - `unknown tokens have empty strings`: `'🙂'` のトークンの `pos1, cType, cForm, base, reading` が `''` か文字列（undefined でない）
- [ ] **Step 3:** `npm test` で失敗を確認。
- [ ] **Step 4: 実装** `createAnalyzer`: `await init({ module_or_path })`、`TokenizerBuilder` で `setDictionary('embedded://ipadic')`, `setMode('normal')`, `setKeepWhitespace(true)`。lindera の出力は活用型と活用形が入れ替わるので、`/段|型|特殊・|^不変化/` に合う方を `cType` にする。`byteStart/byteEnd`（UTF-8）から入力の隙間を検出し、抜けた部分は `pos: ''` のトークンとして補い、連結が入力と一致することを保証する。
- [ ] **Step 5:** `npm test` が通ることを確認。
- [ ] **Step 6:** コミット `feat: 解析器アダプタとプロジェクトの土台`

### Task 2: かな操作と文字数

**Files:**
- Create: `src/engine/kana.js`, `src/engine/count.js`, `tests/kana.test.js`, `tests/count.test.js`

**Interfaces:**
- Produces（`src/engine/kana.js`）:
  - `toHiragana(s: string): string`（カタカナ→ひらがな。他はそのまま）
  - `isHiraganaOnly(s)`, `isKatakanaOnly(s)`, `hasKanji(s): boolean`（`ー` はかなに含める）
  - `trailingKana(s: string): string`（末尾に続くひらがな部分）
  - `oToA(ch: string): string`（お→は※ワ行用は呼び出し側で、こ→か, ご→が, そ→さ, ぞ→ざ, と→た, ど→だ, の→な, ほ→は, ぼ→ば, ぽ→ぱ, も→ま, よ→や, ろ→ら, を→わ。対象外はそのまま）
  - `smallToLarge(s: string): string`（ぁぃぅぇぉっゃゅょゎ と ァィゥェォッャュョヮ を大書きに）
  - `hasAmbiguousKana(s: string): boolean`（ひらがなにして い・う・え・お・わ・じ・ず のどれかを含む）
- Produces（`src/engine/count.js`）: `countX(text: string): number`, `X_LIMIT = 280`

- [ ] **Step 1: 失敗するテスト**
  - kana: `toHiragana('カンガエ') === 'かんがえ'`; `smallToLarge('買った、きゃっ、ヴァ') === '買つた、きやつ、ヴア'`; `oToA('こ') === 'か'`, `oToA('ろ') === 'ら'`; `trailingKana('考え') === 'え'`, `trailingKana('終わっ') === 'わっ'`; `hasAmbiguousKana('あめ') === false`, `hasAmbiguousKana('いえ') === true`; `isKatakanaOnly('コーヒー') === true`。
  - count: `countX('') === 0`; `countX('abc') === 3`; `countX('あいう') === 6`; `countX('🙂') === 2`; `countX('👨‍👩‍👧') === 2`; `countX('見て https://example.com/very/long/path') === 4 + 1 + 23`; `countX('あ'.repeat(141)) === 282`（> X_LIMIT）。
- [ ] **Step 2:** 失敗を確認。
- [ ] **Step 3: 実装** `countX`: URL（`/https?:\/\/\S+/g`）を23として除去 → `Intl.Segmenter('ja',{granularity:'grapheme'})` で書記素に分け、`\p{Extended_Pictographic}` を含む書記素は2、それ以外は書記素内のコードポイントごとに範囲表で1か2。
- [ ] **Step 4:** 通ることを確認。
- [ ] **Step 5:** コミット `feat: かな操作とXの文字数`

### Task 3: 辞書データとテストケース（調査タスク）

**Files:**
- Create: `data/dict.json`, `tests/cases.json`
- Modify: `docs/sources.md`（使った出典の追記のみ）, `docs/decisions.md`（判断の追記のみ）

**Interfaces:**
- Produces `data/dict.json`（形式は設計書「2層: 辞書」）:
  - `entries[]`: `{ modern: string(ひらがな), historical: string(ひらがな), kanji?: string, pos: 'noun'|'verb'|'adjective'|'adverb'|'interjection'|'particle'|'auxiliary'|'other', scan?: boolean, src: string[] }`
  - 動詞・形容詞は `modern`/`historical` を基本形で持つ（例 `かんがえる`→`かんがへる`、`kanji: '考える'`）。
  - `scan: true` は「ひらがなの並びの中で最長一致で拾ってよい名詞・副詞など、3文字以上」。
- Produces `tests/cases.json`: `[{ "input": string, "expected": string, "options"?: { "smallToLarge": boolean }, "source": string }]`（50件以上）

- [ ] **Step 1:** 付表（`docs/sources.md` の URL）の例語のうち、ひらがなで書かれうる語・送り仮名に差が出る語を拾う。各語の歴史的仮名を Wiktionary 英語版の `hhira=` で確かめる（`https://en.wiktionary.org/w/index.php?title=<語>&action=raw`、User-Agent は汎用名）。両方で一致した語、または付表に仮名で書かれている語（例: さうして・かうして・どうして・もう）だけを入れる。
- [ ] **Step 2:** ツイートでよく使う語（あいさつ、こう・そう・ああ・どう、いう・おもう・いる・おる、かんがえる・おしえる・こたえる・かえる・まちがえる・つかう 系、ずつ・くらい、ちょうど・ほんとう・きょう・ゆうがた・ちょうちょう・おおきい・とおい・おおい・ずっと・いちど 等）を Wiktionary で確かめて追加する。確かめられなかった語は入れず、その語の一覧を `docs/decisions.md` に1行で残す。目標 150語以上。
- [ ] **Step 3:** 必須の10件（設計書／依頼文のもの、`source: "spec"`）と、付表の例文・確認済み辞書語を使った文を合わせて `tests/cases.json` を50件以上作る。小書きOFFの例を3件以上、片仮名・絵文字・URLを含む例を3件以上、未変更の例（どう・もう・見よう 等）を含める。期待値は出典に基づく綴りだけで作る。
- [ ] **Step 4:** JSON として読めることを `node -e "JSON.parse(require('fs').readFileSync('data/dict.json'))"` 等で確認し、件数を報告。
- [ ] **Step 5:** コミット `data: 出典付きの辞書とテストケース`

### Task 4: 変換エンジン（規則層・辞書層・統合）

**Files:**
- Create: `src/engine/dict.js`, `src/engine/rules.js`, `src/engine/convert.js`, `tests/convert.test.js`, `tests/cases.test.js`, `scripts/cases-report.js`

**Interfaces:**
- Consumes: Task 1 `Token`/`getNodeAnalyzer`, Task 2 の kana 関数, Task 3 の JSON 形式。
- Produces:
  - `createDict(json): { bySurface(kana): Entry|null, byLemma(base: string): Entry|null, scanAt(text: string, i: number): Entry|null }`（`byLemma` は `kanji` と `modern` の両方で引ける。`scanAt` は `scan:true` の語の最長一致）
  - `createConverter({ analyzer, dict }): { convert(text: string, opts?: { smallToLarge?: boolean }): { output: string, segments: { text: string, status: 'kept'|'converted'|'unverified' }[] } }`
  - `segments` の `text` の連結は `output` と一致し、同じ status の隣り合う部分はまとめる。
  - `scripts/cases-report.js`: 全ケースを実行し `cases: <合格>/<全体> passed` と不合格の一覧を出力（終了コードは常に0）。`npm run cases` で実行。

- [ ] **Step 1: 失敗するテスト** `tests/convert.test.js`（小書きON）
  - 必須10件（依頼文の表）をそれぞれ `convert(input).output === expected`。
  - ワ行五段: `言わない→言はない`, `言います→言ひます`, `言う→言ふ`, `言えば→言へば`; 意志: `書こう→書かう`, `言おう→言はう`; 助動詞: `ましょう→ませう`（`行きましょう→行きませう`）, `だろう→だらう`（`雨だろう→雨だらう`）; 形容詞: `よかろう→よからう`; 一段は変えない: `考えよう→考へよう`（考へ は辞書）, `見よう→見よう`, `しよう→しよう`。
  - 助詞: `花を見る→花を見る`、`西へ進む→西へ進む`。
  - 小書きOFF: `convert('買った',{smallToLarge:false}).output === '買った'`、`convert('言わない',{smallToLarge:false}).output === '言はない'`。
  - 混在: `'今日は🙂 https://x.com/a コーヒー'` の出力が `'今日は🙂 https://x.com/a コーヒー'`、`コーヒー` を含む segment の status が `'kept'`。
  - 空: `convert('').output === ''`、`convert('  \n').output === '  \n'`。
  - 未確認: 辞書にない ひらがな語（例 `'ほげおう'` のように い/う/え/お を含む語）を含む入力で、その部分が `unverified` で原文のまま。
  - segments 連結: 任意の入力で `segments.map(s=>s.text).join('') === output`。
- [ ] **Step 2:** `tests/cases.test.js`: 必須10件が cases.json に入っていて合格することを確認するテスト（全件の合格率は report で出す）。失敗を確認。
- [ ] **Step 3: 実装** 設計書「変換エンジン」の0層〜2層と「未確認の判定」の順で実装。トークンごとに `{ text, status }` を作り、最後に小書き→大書きを status を保ったまま各 segment に当てる。辞書と規則の両方が当たる場合は辞書の結果を先に作り、その上でワ行語尾の規則を当てる。
- [ ] **Step 4:** `npm test` 全部通過を確認。`npm run cases` の数字を記録。
- [ ] **Step 5:** 不合格のケースがあれば、superpowers:systematic-debugging を使って原因を調べてから直す。原因が「出典の範囲外で直せない」ものは期待値を変えず不合格のまま残し、理由を `docs/decisions.md` に書く。
- [ ] **Step 6:** コミット `feat: 3層の変換エンジン`

### フェーズ2末: superpowers:requesting-code-review でブランチ全体をレビュー → 指摘を直す → main へ統合。

---

## フェーズ3: 画面（ブランチ `phase3-ui`）

### Task 5: スマホ画面（frontend-design を使う）

**Files:**
- Create: `index.html`, `src/main.js`, `src/style.css`, `public/favicon.svg`
- Test: Playwright によるスクリーンショット（390×844）。保存先は作業用フォルダ（リポジトリに入れない）。

**Interfaces:**
- Consumes: `createAnalyzer`（wasm URL は `import wasmUrl from 'lindera-wasm-web-ipadic/lindera_wasm_bg.wasm?url'`）、`createDict`, `createConverter`, `countX`, `X_LIMIT`、`data/dict.json`（import）。

- [ ] **Step 1:** frontend-design スキルで見た目の方向を決め、`docs/decisions.md` に1行で記録。
- [ ] **Step 2:** 画面を実装。要素と id: 入力 `#input`（textarea）、結果 `#output`（segments を span、`unverified` は `class="unverified"`＋`title="未確認"`、点線の下線）、文字数 `#count`（`n / 280`、超過で `.over`）、`#copy`、`#post`（`<a target="_blank" rel="noopener">`、href を変換のたびに更新）、`#small-to-large`（checkbox、初期 checked、localStorage `kyukana:smallToLarge`）、読み込み表示 `#status`、凡例。入力は100msまとめて変換。
- [ ] **Step 3:** `npm run build && npx vite preview` で起動し、Playwright で 390×844 を開いて: 例文入力 → 結果が期待どおり、コピー後にクリップボードの中身が結果と一致（権限付与して確認）、`#post` の href が `https://x.com/intent/tweet?text=` で始まり結果をエンコードした文字列を含む、280超で `.over`、オプションOFFで小書きが戻る。スクリーンショットを撮って目で確認。
- [ ] **Step 4:** コミット `feat: スマホ用の画面`

### フェーズ3末: requesting-code-review → 指摘対応 → main へ統合。

---

## フェーズ4〜6

### Task 6: 公開と README

**Files:** Create `.github/workflows/pages.yml`, `README.md`, `LICENSE`（MIT、data/dict.json は CC BY-SA 4.0 と明記）

- [ ] **Step 1:** Actions: push(main) で `npm ci && npm test && npm run build`、`actions/upload-pages-artifact` → `actions/deploy-pages`。
- [ ] **Step 2:** README: 使い方、未確認の意味、辞書への語の追加方法（`data/dict.json` の項目形式・`src` 必須・確認手順・`npm test` と `npm run cases`）、ライセンス。
- [ ] **Step 3:** `gh repo create kyukana-converter --public --source . --push`、Pages を Actions で有効化、デプロイ完了を確認。
- [ ] **Step 4:** 公開URLを Playwright 390×844 で開き、Task 5 Step 3 と同じ操作を確認してスクリーンショット。

### Task 7: PWA（余裕があれば）

**Files:** Create `public/manifest.webmanifest`, `public/sw.js`, `public/icon-192.png`, `public/icon-512.png`; Modify `index.html`, `src/main.js`

- [ ] **Step 1:** manifest（name 旧かな変換、start_url/scope `/kyukana-converter/`、display standalone）、Service Worker は同一オリジンの GET を cache-first でキャッシュ（ビルド後のファイル一覧をインストール時に取得）。
- [ ] **Step 2:** Playwright でオンライン読み込み後に `context.setOffline(true)` → 再読み込みして変換が動くことを確認。
- [ ] **Step 3:** コミット・公開。

### 最終: verification-before-completion（テスト・画面確認の実行結果を根拠に報告）、finishing-a-development-branch、リポジトリ全ファイルの要否点検。
