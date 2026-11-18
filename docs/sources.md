# 出典

## 規則と辞書の根拠

### fuhyo — 文化庁「現代仮名遣い」（昭和61年内閣告示第1号、平成22年一部改正）付表
- 付表 凡例: https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/gendaikana/huhyo_hanrei.html
- 対照表（イ〜ワ）: https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/gendaikana/huhyo_i.html
- 対照表（ユー〜ロー）: https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/gendaikana/huhyo_yu.html
- 対照表（キュー〜リュー）: https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/gendaikana/huhyo_kyu.html
- 対照表（キョー〜リョー）: https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/gendaikana/huhyo_kyo.html
- 閲覧日: 2026-11-18

この付表から使う規則の根拠（付表に挙がっている例）:

| 規則 | 付表の例 |
|---|---|
| ワ行五段動詞の語尾をハ行に | 買ふ・吸ふ・争ふ（ウ→ふ）、救へ（エ→へ）、思はず（ワ→は）、思ひ出（イ→ひ）、言ふ |
| 五段動詞の意志形 オ段→ア段＋う | 買はう・舞はう、咲かう、急がう、話さう、勝たう、死なう、遊ばう・飛ばう、休まう、祈らう |
| 形容詞のウ音便 | 赤う、長う、浅う、痛う、甘う、早う、暗う、弱う、よろしう、怖うございます、危なうございます |
| 「ませう」 | 見ませう |
| 一段の意志「よう」は変えない | 見よう |
| 助詞「は」「へ」「を」 | 我は海の子・又は、西へ進む、花を見る |
| 「さう」「かう」 | さうして、かうして |
| 変わらない例 | どうして、もう一つ、ようございます |

### wikt — Wiktionary（英語版）の日本語項目の歴史的仮名（`hhira=`）
- https://en.wiktionary.org/ （各語の項目URLは data/dict.json の各項目には持たせず、見出し語で引ける）
- ライセンス: CC BY-SA 4.0 / GFDL
- 閲覧日: 2026-11-18

### 助動詞「でせう」「だらう」「ようだ→やうだ」「さうだ」
- fuhyo の「見ませう」（せう）、「様子」（やう）、「さうして」（さう）、「祈らう」（らう）に同じ仮名の対応がある。
- 個別の語形は wikt（でしょう→でせう、だろう→だらう、ようだ→やうだ、そうだ→さうだ）で確認する。確認結果は data/dict.json の `src` に記録する。

## 文字数の数え方
- twitter-text config v3: https://raw.githubusercontent.com/twitter/twitter-text/master/config/v3.json （閲覧日 2026-11-18）

## X 投稿インテント
- X Developer Platform「Web Intent」: https://docs.x.com/x-for-websites/post-button/guides/web-intent （閲覧日 2026-11-18）

## 追記（辞書・テストの作成、2026-11-18）

### wikt の使い方
- 取得: `https://en.wiktionary.org/w/index.php?title=<見出し語>&action=raw`（汎用の User-Agent、見出し語だけを送る、毎秒2件以内）。
- 読む欄: `{{ja-noun|…|hhira=…}}`・`{{ja-pos|…|hhira=…}}` の `hhira=`、動詞 `{{ja-verb|…|hist=…}}` の `hist=`。送り仮名の区切りの `.` は除いた。熟字訳など漢字見出しが `{{ja-see|…}}` だけの項は、指された仮名の項目を引き、その項の該当する語義（`ja-kanjitab` の `alt=` 等）の値だけを採った。
- 項目ごとの出典URLは辞書の各項目に持たせない。見出し語（`kanji`、なければ `modern`）で `https://en.wiktionary.org/wiki/<見出し語>` を引くと確認できる。
- `ja-verb` の `type=1` を godan、`type=2` を ichidan とした（居る＝いる は type=2、おる は type=1 で確認）。
- 「ありがとうございます」は項目が「ありがたう ございます」と分かち書きで、「おはようございます」の項目が ございます を変えない形で載っているため、続けて「ありがたうございます」とした。

### fuhyo の使い方
- 付表の例語のうち、同じ漢字語で、変わる部分が付表の行と一致するものにだけ `src` に `fuhyo` を付けた（付表の各行の「現代仮名」「歴史的仮名」と例語を、辞書の `historical` が含むか機械で突き合わせた。不一致は競争の1件で、辞書から外した）。
- 付表が仮名で書いている語（どうして・もう一つ・さうして・かうして・ようございます・ふくろふ・かげろふ）は付表だけを根拠にした語がある（`src` を参照）。
