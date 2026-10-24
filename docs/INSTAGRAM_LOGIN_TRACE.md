# Read-only Instagram login trace — October 24, 2026

No Personafy/Cobalt code, configuration, database or profile was modified. No cookie values were read, copied or displayed. No browser profile was launched, no login check was triggered, and no paid call occurred. Only source code/configuration names, file existence, non-secret connection metadata booleans and capture-method/status fields were inspected. Research Agent documentation and prompt log are the only writes.

## What actually uses the login

Personafy's `scripts/dev-server.ts` constructs InstagramBrowserSession with profileRoot beside its database, under `data/browser-profiles`. The Instagram-specific browser profile exists at `C:/Users/barri/Documents/ChatGPT/Persona Phi/data/browser-profiles/instagram`. Its non-secret connection metadata exists; it does not currently mark the connection expired or report repeated login walls. This is not a live session validity check. Cookie storage files themselves were not read.

`src/media/instagram-session.ts` manages a dedicated browser profile. The owner signs in manually; the browser stores the session in that profile. Its acquire method enforces expiry checks, pauses, profile exclusivity and daily limits. Its own explicit verification method can launch a browser and update metadata, so it was deliberately NOT invoked during this read-only task.

`src/application/link-capture-service.ts` trySources first tries Cobalt, then optional yt-dlp, then browser capture. recordPage first tries an unsigned browser. When that encounters a sign-in wall, it obtains a lease on the matching platform profile and repeats capture using that browser/profile. saveRecording records this method as browser_recording_signed_in.

`src/media/browser-capture.ts` plays the visible video element, uses captureStream/MediaRecorder, and returns recorded bytes and audio. FFmpeg finalizes the recording. This is browser playback recording, not necessarily the original platform video file. Partial recordings and screenshots are recorded separately; DRM/non-recordable media and unresolved access walls are refused.

## Evidence from actual saved items

Opened `data/personafy.db` with SQLite readOnly=true and selected only method/state/count, plus method/state/quality/audio-presence for the owner-supplied post. No account IDs, cookie data, login tokens, or unrelated source URLs were selected.

- 20 saved Instagram items have method browser_recording_signed_in.
- 29 saved Instagram items have method cobalt; these are items, not necessarily all videos.
- Other saved outcomes include unsigned browser recordings, partial recordings, screenshots, page image files and a preview.
- No link_captures record matched De2y_j8AHd1. Therefore no specific successful Personafy method for that post was established.

This confirms that both Cobalt and signed-in browser capture have worked historically. It does not mean a prior success in Personafy used Cobalt, or that every Instagram post works now.

## Cobalt cookies

Installed Cobalt supports COOKIE_PATH: api/src/core/env.js maps it into cookiePath, and api/src/core/api.js initializes the cookie manager only if configured. The manager supports Instagram cookie entries.

In the inspected api/.env, COOKIE_PATH is not configured and no other cookie-named setting exists. The usual api/cookies.json file is absent. The inspection process has no inherited COOKIE_PATH. The existing running process's private environment was not extracted, so this is a configuration/file-presence finding rather than an exhaustive assertion about all possible external runtime overrides.

No Cobalt cookie file was available to assess for expiry, and none was read. Personafy's browser-profile login is separate from Cobalt. Browser connection metadata does not mark expiry, but live Instagram session validity remains unverified.

The optional yt-dlp adapter explicitly uses --ignore-config and does not receive cookies/browser profiles. PERSONAFY_YTDLP_PATH is not configured in the inspected .env.local. Its existence as source code does not establish that it is active in a different process environment.

## Implication for Research Agent

Matching Cobalt request options cannot transfer Personafy's browser login. Research Agent currently has Cobalt retrieval, not Personafy's signed-in browser recording fallback.

A safe future integration would reuse the capture design with a separate Research Agent browser profile. The owner would sign in manually once, then the browser would manage its own session in place. The fallback should retain one-at-a-time processing, rate/daily limits, refusal of access challenges/DRM, temporary-only recordings, complete/partial provenance and cleanup. Do not point a second app at Personafy's profile: browser launches can write profile state and concurrent use can conflict. Do not export cookies into Cobalt or Research Agent.

A simpler alternative is read-only ingestion of a video already saved by Personafy: process a temporary copy in Research Agent, retaining the original provenance, and leave Personafy's existing file untouched. That import path would need to be implemented/verified; no such implementation or media operation was performed in this read-only task.

Source references: Personafy src/media/instagram-session.ts, src/application/link-capture-service.ts (trySources, recordPage, recordOnce, saveRecording), src/media/browser-capture.ts, src/media/ytdlp.ts, scripts/dev-server.ts; Cobalt api/src/core/env.js and api/src/processing/cookie/manager.js.
