# Import correction verification

The previous run selected the older September unpacked export. This run reads the two saved JSON entries directly in memory from Downloads/instagram-bolo_the_grappler-2026-10-24-w3uEBGv5.zip. No raw export was copied into the project.

Owner confirmed these expected counts: Tech 153, Pennywise 12, Personafy 7, reference 762. Earlier larger numbers included non-post links. The parser reads all nested dict lists and imports only explicit Instagram /p/ and /reel/ URL fields, not caption, profile or external links. Collection names ignore case and extra spaces. Only Pennywise, Personafy and Tech collection labels influence provider context by default; other collections are organizational data.

This export contains 18 collections and 1,002 unique collection posts. saved_posts.json contains 1,121 unique posts. Combined: 1,129 unique posts.

| Collection | Unique posts in current export |
|---|---:|
| reference | 762 |
| Tech | 153 |
| bjj | 10 |
| counters and combos | 24 |
| shit I want to buy | 4 |
| Pennywise | 12 |
| certifications | 5 |
| jobs | 2 |
| sweeps | 4 |
| food | 5 |
| Personafy | 7 |
| project ideas | 1 |
| housing | 1 |
| workouts | 1 |
| profile reference | 4 |
| clothes | 1 |
| Stay hard to kill | 7 |
| Building a monster | 1 |

Earlier history is preserved: the cumulative library has 1,187 entries, so its collection counters can exceed the current-export counts above (reference 820, Tech 154 including the earlier synthetic example). No historical records were removed.

Final re-import added 0 duplicate records. Source hash unchanged; previous results/statuses/attempts unchanged; all new posts pending with zero attempts; processing queue paused; no new paid calls.

71 automated tests passed. Tests include nested labeled dict records, alias normalization, repeated groups, empty collections, caption/profile/external URL exclusion, and unrelated collection-label filtering. The 18-collection/1,306-URL stress test uses generated synthetic data, not the real export.
