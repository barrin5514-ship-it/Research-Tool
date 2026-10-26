# Three.js browser assets

Version: 0.186.1 (MIT), downloaded from the official npm package:
https://registry.npmjs.org/three/-/three-0.186.1.tgz

Only build/three.module.js, build/three.core.js, examples/jsm/controls/OrbitControls.js and LICENSE are included. The OrbitControls import was changed from the bare `three` specifier to local `./three.module.js`; no other vendor code was changed. No npm lifecycle scripts were run. Assets are served from the local Research Agent only; no runtime CDN, analytics or paid service is used. The renderer uses WebGL2 and falls back to the existing SVG map when graphics are unavailable/slow.

The upstream MIT license is in LICENSE. Hashes of the distributed local files are recorded in SHA256SUMS.txt.
