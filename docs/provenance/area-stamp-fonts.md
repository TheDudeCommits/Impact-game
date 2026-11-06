# Area stamp lettering: fonts

The area stamp's kanji and English (src/render/area/glyphs.json) are outlines baked from two fonts under the SIL
Open Font License 1.1. Only the outlines of the characters the seals use are shipped; the font files themselves are not
bundled.

| Face | Used for | Source | SHA-256 | Licence |
| --- | --- | --- | --- | --- |
| Yuji Boku (Regular), © 2021 The Yuji Project Authors | Japanese: emblems, the rings' names | https://github.com/google/fonts/tree/main/ofl/yujiboku | 94fda16384f3bdac24376a000c57e99abfa314961bd89ef27badfb7410322003 | [OFL 1.1](fonts/OFL-YujiBoku.txt) |
| Barlow Condensed (Black), © 2017 The Barlow Project Authors | English: the rings' names | https://github.com/google/fonts/tree/main/ofl/barlowcondensed | e74b750df582c608f35db467b711b2b60d2217618e85e60b72b42dfd00446cab | [OFL 1.1](fonts/OFL-BarlowCondensed.txt) |

The drawn emblems (src/render/area/symbols.ts) are the game's own geometry, drawn in code.
