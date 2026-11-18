# 旧かな変換

いまの仮名遣いで書いた文を、歴史的仮名遣い（旧かな）に直すWebアプリです。ブラウザだけで動きます。

公開URL: （公開後に記入）

## 使い方

1. 入力欄に、いまの仮名遣いで文を書きます。
2. 下の「変換結果」に旧かなが出ます。
3. 「コピー」で結果をコピーするか、「Xで投稿」で投稿画面を開きます（文字数はXの数え方で表示します）。

結果の字には2種類の印がつきます。

- 点（圏点）: 旧かなに直した字です。例: で**せ**う
- 点線の下線: 辞書で確かめられず、そのまま残した所です（未確認）。推測では直しません。

「小さい「っ」「ゃ」などを大きく書く」にチェックすると、旧かなの習慣に合わせて「買った→買つた」のように小書きを大書きにします。チェックを外すと小書きのままにします。この設定は端末に保存されます。

## プライバシー

入力した文は端末の外に送りません。形態素解析（lindera / IPADIC）も辞書も、すべてブラウザの中で動きます。

## 辞書に語を足す

辞書は `data/dict.json` の `entries` です。1語が1項目です。

```json
{"modern":"かんがえる","historical":"かんがへる","kanji":"考える","pos":"verb","type":"ichidan","src":["fuhyo","wikt"]}
```

- `modern`: いまの仮名遣い（ひらがな）。
- `historical`: 歴史的仮名遣い。
- `kanji`: 漢字表記（任意）。
- `pos`: 品詞（noun・verb・adjective・adverb・interjection など、既存の項目に合わせる）。
- `type`: 動詞のときだけ。`ichidan`（一段）か `godan`（五段）。
- `scan`: `true` にすると、解析器が語を分け間違えても文字列だけで拾います。ひらがなで書かれやすく、別の語の一部に紛れにくい3文字以上の名詞・副詞・挨拶に限ります（理由は `docs/decisions.md`）。
- `src`: 出典。**必須**で、実際に確かめた出典だけを書きます。`data/dict.json` 先頭の `sources` にあるキー（`fuhyo`＝文化庁「現代仮名遣い」付表、`wikt`＝Wiktionary英語版）から選びます。

確かめ方:

- Wiktionary英語版（https://en.wiktionary.org/）で見出し語を開き、日本語の項の `hhira=` または `hist=` に歴史的仮名遣いがあるか見ます。
- 文化庁の付表（https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/gendaikana/huhyo_hanrei.html）の対照表にあるか見ます。
- 確かめられない語は足しません（足さなければ、画面では未確認として残ります）。

足したら、`tests/cases.json` に入力と期待値の例を1件足し、次を実行します。

```
npm test
npm run cases
```

## 開発

```
npm install
npm run dev      # 開発サーバー
npm test         # テスト
npm run cases    # 例文の結果一覧
npm run build    # 公開用のビルド（dist/）
```

`main` に push すると、GitHub Actions がテストとビルドを行い、GitHub Pages に公開します。

## 既知の制限

解析器の分け方や、辞書にない語の扱いによる制限は `docs/decisions.md` にまとめています。出典は `docs/sources.md` です。

## ライセンス

- コード: MIT（`LICENSE`）。
- `data/dict.json`: CC BY-SA 4.0。Wiktionary（CC BY-SA 4.0 / GFDL）で確かめた事実を含むためです。
- lindera（`lindera-wasm-web-ipadic`）: MIT。パッケージ内の `LICENSE` は MIT のみです。解析に使う IPADIC 辞書のライセンスは、このパッケージに別ファイルとして同梱されていません。IPADIC は独自のライセンスで配布されているため、再配布する場合は上流の表示を確認してください。
