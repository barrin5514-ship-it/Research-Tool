# Cobalt comparison and retest — October 24, 2026

Personafy source was inspected read-only at `C:/Users/barri/Documents/ChatGPT/Persona Phi/src/media/cobalt.ts`, `public-fetch.ts`, `scripts/dev-server.ts`, and the capture-service call sites. No Personafy or Cobalt files were changed.

| Detail | Personafy | Previous Research Agent | Updated Research Agent |
|---|---|---|---|
| API endpoint | Configured loopback origin via PERSONAFY_COBALT_URL; established stack default http://127.0.0.1:9100/ | Same loopback origin, fixed default | Same |
| Method/headers | POST; Accept application/json, Content-Type application/json | Same | Same |
| API key/auth | No Authorization/API-key header in adapter | None | None |
| Cookies | No cookies or sign-in forwarded | None | None |
| downloadMode | auto (video with audio) | auto | auto |
| videoQuality | 1080 default | 480 | 1080 |
| filenameStyle | basic | Omitted | basic |
| alwaysProxy | false | true | false |
| API timeout | 90 seconds | 20 seconds | 90 seconds |
| Media timeout | 120 seconds | 60 seconds | 120 seconds |
| Media Accept | */* | Unspecified | */* |
| Cobalt JSON errors | Reads error body even on non-2xx; special rate-limit handling | Threw generic HTTP error first | Reads bounded error JSON; retains 429 handling |
| tunnel result | Downloads local media | Local tunnel only | Same |
| redirect result | Downloads public HTTPS media with DNS/private-address/redirect/byte guards | Rejected | Reuses Personafy's public-fetch.ts through a read-only module import |
| picker/carousels | Supports all items or first item | Skips | Still skips: one-video pilot boundary |
| Source URL | Receives source/resolved link from capture workflow | Strict individual Instagram HTTPS validation, strips tracking/query | Unchanged; same exact source URL used in live comparison |

Request body now matches Personafy's defaults exactly: url, downloadMode auto, videoQuality1080, filenameStyle basic, alwaysProxy false. No secret was required or copied. Personafy's environment file did not define PERSONAFY_COBALT_URL during inspection; its stack launcher can inject the loopback configuration. No runtime endpoint from a different Personafy process was assumed.

The public downloader reference is code, not a credential location: `C:/Users/barri/Documents/ChatGPT/Persona Phi/src/media/public-fetch.ts`. It uses HTTPS, connection-time public DNS checks, rechecks redirects, size limits and no auth/cookies. It does not start Personafy or open its database. This introduces an explicit dependency on that existing read-only source path. The adapter retains Research Agent's overall attempt deadline, byte/duration/pixel limits, file ownership and cleanup protections. It does not duplicate Personafy's browser, yt-dlp or other capture fallbacks.

## Live outcome

Source: https://www.instagram.com/p/De2y_j8AHd1/

Updated Research Agent: `error.api.fetch.fail`, stored as COBALT_REJECTED. No video retrieved, no transcript/OCR generated, no DeepSeek call, zero tokens and USD0 spent. Scratch directory confirmed empty.

Independent control: imported and invoked Personafy's actual createCobaltRetriever, with its publicFetch dependency, against the same post and http://127.0.0.1:9100/. It also failed: reason nothing, message Cobalt could not retrieve this post (error.api.fetch.fail).

Therefore the request differences are corrected, but they did not resolve retrieval of this post. This control cannot establish how a previous successful Personafy download occurred: it may have used another source, time, instance, or a fallback. No such cause is asserted without evidence. No cookies were requested and no protection bypass was attempted.

## Verification

55 automated tests pass (0 failed/skipped), including updated request-body parity, guarded public redirect path, non-2xx Cobalt JSON handling, and cleanup. Complete Windows output: docs/cobalt-parity-windows-tests.txt. Live control is scripts/cobalt-personafy-control.mjs; guarded reauthorized pipeline test is scripts/instagram-personafy-parity-once.mjs. The previous paid-call authorization was not reused: this retest had its own durable guard and the owner's current one-call/USD0.01 authorization. Paid calls remained zero.
