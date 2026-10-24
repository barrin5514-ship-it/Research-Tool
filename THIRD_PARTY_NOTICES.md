# Third-party notices

The HTML extraction patterns and metadata organization in `src/importer.mjs` are
adapted from the `clean`, `extract_posts_from_raw`, `extract_collections` and
shortcode-extraction concepts in **Instagram Saved Library** by Shubham Thakur.
The adaptation adds strict URL validation, input limits, structured JSON imports,
canonical deduplication and explicit handling of missing collection membership.
No upstream installation scripts or server code are executed by this importer.

- Repository: https://github.com/sthakur369/instagram-saved-library-app
- Reviewed source: https://github.com/sthakur369/instagram-saved-library-app/blob/main/app.py
- License source: https://github.com/sthakur369/instagram-saved-library-app/blob/main/LICENSE
- Source reviewed: October 23, 2026. The `main` revision was viewed remotely; an
  exact commit identifier was not available and is not asserted here.

## MIT License — Instagram Saved Library

Copyright (c) 2026 Shubham Thakur

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

## whisper.cpp local runtime

Approved project-local installation: ggml-org/whisper.cpp v1.8.3 (MIT), https://github.com/ggml-org/whisper.cpp/tree/v1.8.3 . Full upstream license is preserved at .research-data/tools/whisper/LICENSE alongside installation provenance. Model: ggerganov/whisper.cpp ggml-tiny.en.bin; model sources and SHA-256 are recorded in INSTALL.json. Binaries and model are ignored local runtime assets, not bundled into source control.
