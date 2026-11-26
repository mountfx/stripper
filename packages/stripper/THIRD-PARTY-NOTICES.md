# Third-party notices

This package's own code is MIT-licensed (`LICENSE`). The npm artifact
additionally incorporates third-party material as described below; the
original licenses apply in addition to this package's license.

## Bundled code (dist/)

### culori

The npm artifact bundles [culori](https://github.com/Evercoder/culori)
(color parsing and color-space conversion), pinned at the certified version
4.0.2, used under the MIT license:

```
MIT License

Copyright (c) 2018 Dan Burzo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Data and algorithm provenance

- **Tailwind CSS v4 palette** (`src/families.ts`): the family hex values are
  extracted from the Tailwind CSS v4 default color palette
  ([tailwindcss](https://github.com/tailwindlabs/tailwindcss), MIT © Tailwind
  Labs, Inc.). Color values are used as reference data, not redistributed code.
- **APCA** (`src/apca.ts`): an independent implementation of the published
  APCA-W3 0.0.98G-4g formula. The algorithm is © Andrew Somers / Myndex
  Research. The canonical `apca-w3` package (W3/AGPL-licensed) is **not**
  distributed with this package; it is used only as a dev-time test oracle
  (`devDependencies`), never shipped in any artifact.
