# Personafy reference hand-off

## Destination and consumer contract

Exact root: `C:\Users\barri\Documents\Personafy-Handoff\references\`

```text
references/
  index.json
  <Instagram-post-code>/
    index.json
    media-01.jpg       (or .png/.webp/.gif/.bmp/.mp4/.webm)
    media-02.mp4       (additional carousel items, in position order)
```

The root `index.json` is UTF-8 JSON:

```json
{
  "schemaVersion": 1,
  "kind": "personafy-reference-handoff",
  "updatedAt": "2026-10-26T00:00:00.000Z",
  "posts": [
    {
      "postCode": "Example123",
      "sourceUrl": "https://www.instagram.com/reel/Example123/",
      "status": "Done",
      "reason": null,
      "index": "Example123/index.json",
      "savedAt": "2026-10-26T00:00:00.000Z",
      "automaticRetryUsed": false
    }
  ]
}
```

Each post's `index.json` includes `schemaVersion`, `postCode`, `sourceUrl`, `status`, `reason`, `caption`, `captionSource`, `postedAt`, `savedAt`, `method`, `complete`, `expectedItems`, `attempts`, `lastAttempt`, `automaticRetryUsed`, and `files`. Internal `code` and `url` aliases may also be present. Each file has a flat relative `name`, `position`, `kind`, `mime`, `extension`, `bytes`, `sha256`, `width`, `height`, `durationSeconds` (null for images), and validation metadata. Unknown captions remain empty, and unknown publication dates are null; `savedAt` is the local hand-off completion time, not an invented publication date. Times are ISO 8601 UTC.

A consumer should read **only entries marked Done in both indexes**, require `complete: true`, require the expected file count, and check each file's existence/size/hash before import. Resolve file names inside that post's folder; never execute captions or metadata as instructions. Failed/Incomplete entries are diagnostic, not import-ready. Indexes publish atomically; a post is marked Incomplete while files are replaced. No Personafy importer/watcher was installed or changed: this feature makes files available, it does not claim Personafy has consumed them.

## Controls and schedule

In My library, turn on **Send new reference posts to Personafy** and save. Also turn on the existing **Auto-sync saved posts** and choose once/twice daily. Both are off by default. The tool must be running; it does not wake the laptop. Reference work runs first in a scheduled sync and never enters the research pipeline. Enabling hand-off keeps the reference collection excluded from research.

The tool uses only its own `.research-data/browser-profiles/instagram` profile and shared browser lock. Its signed-in browser must be connected and closed. It navigates to the exact case/space-normalized reference collection, reads at most 30 unique post links with 4.5-second scroll pauses, and stops at the first code with a verified good copy. Automatic retries reserve space within that 30-post budget. Downloads are sequential, with 20 seconds between jobs. It never likes, comments, follows or messages.

Cobalt is tried first; browser/page-image acquisition uses the same isolated profile when necessary. All Cobalt carousel items are handled in order. Browser-exposed highest-size image URLs can be downloaded, but unknown carousel completeness remains Incomplete. A browser screenshot is not accepted as a full original image. Browser video capture records only the media element, never the desktop or microphone, and is limited to 90 seconds. Full-video and single-item completeness must be confirmed; partial/unknown captures remain Incomplete. A reel URL is preserved where available. Recordings are labelled as recordings, not original downloads.

Login, CAPTCHA, security/alert/dialog and rate-limit signals stop the run and disable hand-off and auto-sync. During video capture a DOM warning monitor checks every 500 ms; network access refusals also stop recording. No checks are bypassed. Source/read/folder errors also stop safely rather than guessing.

## Duplicate and retry rules

Post code is the identity, not the filename or caption. Personafy's live database is opened read-only before each reference check; only verified good copies stop discovery. Existing failed, partial, link-only or missing-file references do not count as duplicates. Previously handed-off Done files are checked again before duplicate decisions. Missing or changed files become Incomplete; decoder failures never become Done.

Failed/Incomplete posts automatically retry once at the next sync, including if discovery stops at a newer already-handled post. Further retries require Retry or Retry all failed. A manual run handles up to 30 failures at a time; remaining failures stay visible for another run. Retry reuses the same post folder, stages replacements, validates them, publishes indexes and removes obsolete managed files. It never makes a second post-code folder. Existing unrelated files are not recursively deleted. The Stop Research Tool launcher also waits for hand-off work to stop safely.

## Read-only Personafy audit

Source: `C:\Users\barri\Documents\ChatGPT\Persona Phi\data\personafy.db`, tables `reference_assets`, `reference_sources`, `link_captures`, `reference_media_files`, and `capture_carousel_items`. Media root: `C:\Users\barri\Documents\ChatGPT\Persona Phi\data\media`.

Initial audit found **74 Instagram codes: 26 verified good copies, 48 without a confirmed full/playable copy**. The latter may be link-only, missing media, partial or marked needs-review; they are not asserted to be corrupt. Full private lists: `.research-data/personafy-reference-codes.txt` and `personafy-reference-audit.json`. These contain no cookies or login data and are not committed. Run `node scripts/audit-personafy-references.mjs` to refresh the read-only report.

## Validation and limits

Files must be regular, non-symlink files, non-empty and within the 80 MiB file limit. Images requested from public servers have a 15 MiB cap. Up to 20 media items per post are supported; unknown/unsupported counts stay Incomplete. Dimensions are limited to 16 megapixels/8192 per edge. FFprobe checks streams and FFmpeg decodes the media completely, with one decoder thread, restricted local-file protocols/formats and a 180-second validation timeout. Public downloads use the existing DNS-pinned public-HTTPS fetcher; local Cobalt tunnels stay loopback. Signed CDN URLs/cookies are not exported. Hashing streams files to limit memory. Full retained reference media consumes disk by design; research scratch cleanup is unchanged.

`docs/REFERENCE_HANDOFF_TEST_OUTPUT.txt` contains the complete offline suite. Tests use synthetic images/video, fake collection/capture responses and an isolated source database; the source database is byte-identical after the audit test. They cover default-off, exact collection navigation, caps, full decoding, invalid copies, one automatic retry, manual replacement, obsolete-empty-file cleanup, warning cancellation, exclusions, and no research invocation.

**Live reference collection scanning/downloading remains unverified.** The feature was left off; no real posts were handed off and no AI or paid calls were made. The actual destination currently contains only its empty root index. No Personafy code, settings, data or browser profile was modified.
