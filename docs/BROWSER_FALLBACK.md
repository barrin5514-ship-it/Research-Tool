# Research Agent browser fallback

Acquisition order: existing Cobalt → installed yt-dlp, if found → anonymous browser playback → owner-connected Instagram browser, only when the anonymous page asks for login.

No software is installed. Research Agent reads Personafy's existing `browser-capture.ts` and its helper modules as a code dependency; it never instantiates Personafy's login session or opens its profile. Moving that source installation would require updating this dependency. Edge or Chrome must already be installed. yt-dlp is optional, detected on PATH or through `RESEARCH_YTDLP_PATH`; its configuration and cookies are disabled.

The separate profile is `.research-data/browser-profiles/instagram` inside Research Agent, ignored by Git. Use **Open Research Agent Instagram sign-in**, sign in manually, close that browser, then select **I signed in and closed the browser**. Confirmation is an owner statement, not a cookie check. Expired sessions are detected by actual capture failure. Research Agent does not read or display cookie values. Protect this private directory like a signed-in browser.

The queue processes one video at a time, with a 20-second gap. The fallback has a process lock, a separate 20-second attempt gap and a 40-attempt daily ceiling. An open sign-in browser blocks processing of its profile. Security checks, DRM and access restrictions are not bypassed.

Playback capture is limited to 90 seconds. Partial recordings and images are rejected. Accepted media is limited to 80 MiB, six small frames and mono audio. The reused recorder can temporarily buffer up to its own 400 MB limit before Research Agent's 80 MiB acceptance check; this is not a hard 80 MiB RAM ceiling. One browser plus transcription can use appreciable RAM. Overall processing times out after six minutes. Existing bounded Whisper CPU settings remain unchanged.

Input recordings, playback cache, extracted audio/frames and the anonymous profile reside in the owned attempt directory and are removed in the processor's finally block. The signed-in profile remains so the owner need not sign in each time. A crash leaves a marked attempt that the existing dead-process startup reaper removes.

DeepSeek remains disabled for ordinary batches unless separately approved. The one-off retest script has its own durable one-use guard, at most one official API request and a conservative $0.01 preflight limit; it will not call without extracted transcript or OCR. Claims remain NOT VERIFIED. No target project or Cobalt files are changed.

Tests use stand-in browser recordings, simulated login walls and a fake paid API. See `browser-fallback-windows-tests.txt`; these tests do not prove live Instagram access. Live retest evidence is recorded separately in `INSTAGRAM_BROWSER_FALLBACK_TEST.json`.
