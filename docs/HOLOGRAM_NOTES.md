# Holographic Idea map

The default map uses a pinned, locally served MIT Three.js 0.186.1 renderer and OrbitControls. No installation, runtime CDN, paid service, media download or library-data migration is needed. Vendored modules total about 2.1 MB before local HTTP compression; see public/vendor/three/README.md, LICENSE and SHA256SUMS.txt.

- Drag the scene to rotate; scroll over it to zoom.
- Click a project sphere or its colored legend entry to fly closer. Show all projects returns to the overview.
- Hover a sphere/node for a glass label. Project labels show the project name/count; video labels use the saved title/summary as plain text.
- Click a video to open the existing full result. Keyboard users can use Open or connect a video by title.
- Connect ideas supports clicking nodes or dragging between videos. Combine these still previews exactly the selected saved summaries/recommendations, requires cost confirmation and preserves NOT VERIFIED. No research-provider/server processing behavior was changed.
- Simple 2D view uses the existing SVG map with matching holographic colors. The preference lasts only for this page visit; it does not write settings/data.

Rendering uses shared low-detail sphere geometry, instanced video spheres, shader-point glow, one-pass transparent lines/trails, no shadow maps or bloom passes, pixel ratio capped at 1, and a 30 fps frame limit. Drawing pauses when the document/map is hidden or offscreen. A sustained sample below 22 fps first reduces resolution/trail detail; if still slow, it switches automatically to 2D with a plain explanation. WebGL/context failures also fall back. Existing tabs/menu/cards remain available.

## Actual verification and limitation

All 179 offline tests passed (docs/HOLOGRAM_TEST_OUTPUT.txt), including deterministic 200-node layout, unique colors, connection deduplication, hidden/warm-up/slow sample behavior and local asset/security-policy checks. Runtime checks confirmed saved-result navigation, animation paused when leaving the map, two selected videos producing a cost preview, and Cancel without a paid call. Generated browser labels use canvas text/textContent, never source HTML.

In this session's embedded browser at a representative 1366×768 laptop viewport, the synthetic 200-node scene measured 1 fps, with about 5.37 ms average time spent in the JavaScript draw call before the final small-node glow reduction. The real library's embedded-browser samples ranged from 1 to 11 fps and triggered fallback. **30+ fps has not been verified.** These measurements do not establish the performance of the owner's normal desktop browser or isolate browser scheduling versus graphics hardware. The fallback worked; do not present the stress test as a smooth 30 fps demo.

For a repeatable isolated test, run `node scripts/hologram-benchmark.mjs`, then open http://127.0.0.1:5202/. It serves synthetic graphics only and never opens the database or calls DeepSeek. Its optional recorder writes a canvas-only synthetic preview under .research-data; recording mode retains the scene rather than switching views, so the output illustrates graphics, not achieved frame-rate performance. Stop the temporary test with Ctrl+C. The test was stopped after this task.

The delivered recording is 8.36 seconds, a synthetic 200-node graphics/camera-focus preview, encoded locally using existing FFmpeg. The screenshot shows the real saved-library map. Neither artifact is a model-generated image or a simulated performance claim. Browser viewport override was restored. Saved SQLite tables were compared to the pre-change backup and were identical.
