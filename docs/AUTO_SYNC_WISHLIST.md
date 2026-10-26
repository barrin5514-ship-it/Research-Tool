# Auto-sync saved posts and Wishlist

Both schedules run inside Research Agent while its server is running; they do not wake a sleeping laptop. Missed checks run when due after reopening, without replaying a backlog.

## Saved posts

Off by default. The owner chooses once or twice daily and saves the setting in My library. The existing Research Agent Instagram profile must already be signed in and its window closed. The scanner shares the capture lock and only that project-local profile. It follows the signed-in Saved / All posts links, reads at most 30 unique individual post URLs in visible grid order, pauses 4.5 seconds between modest scrolls, and stops at the first library match. New posts are pending and unassigned; saved-collection memberships still come from imports. No download, transcription, AI call or social interaction is initiated.

Login, CAPTCHA, security/rate-limit signals, an unrecognized page or any scanner failure turn sync off. Resolve access manually in the Research Agent sign-in browser; the tool never solves checks or copies credentials. Status and each check are stored in the private database. Instagram can change its layout; synthetic adapter tests do not establish live compatibility.

## Wishlist

Posts belonging to `shit I want to buy` appear in Wishlist. Future normal DeepSeek analyses request product name, brand, model and mentioned price as exact source quotes. Unsupported fields stay empty; unidentified names display `Product not identified`. Existing posts are not automatically re-analyzed.

Tracking starts only after the owner pastes and confirms a direct public HTTPS product link. Target amount is optional; its three-letter currency must match the observed price for highlighting. No conversion, price prediction, checkout or purchase occurs. One daily check reads robots.txt and then a bounded HTML page, using a declared ResearchAgentWishlist user agent. Only one explicit, unambiguous JSON-LD Offer price (or product-price metadata) is accepted. Multiple variant prices, missing data, script-only prices and currency ambiguity are not guessed. Lowest/current/history refer to the confirmed URL; changing URL keeps old history privately but starts the displayed history for that new URL. History shows the newest 90 readings; all saved observations remain in SQLite.

Robots refusal, CAPTCHA, HTTP 401/403/429 disables checking that confirmed link. Reconfirming the same blocked URL does not retry it. No redirects are followed. Public IPv4 DNS is validated and pinned per request; local, reserved and credential-bearing links are refused. Requests time out at 15 seconds and pages are capped at 1 MB. No cookies or browser login are sent to stores.

Price checks use no paid API: estimated daily API cost is **$0.00**, excluding ordinary internet/electricity. Normal user-requested video analysis still uses the existing paid research pipeline. DeepSeek's official Search & Fetch guide, checked October 26, 2026, lists Fetch at $0.75 / 1,000 successful requests, with billing starting November 1, 2026; this implementation does not call it: https://api-docs.deepseek.com/guides/search/.

## Verification

`docs/SYNC_WISHLIST_TEST_OUTPUT.txt` contains the complete offline suite output. Tests use in-memory databases, fake Instagram DOM snapshots and stand-in store pages. Live Instagram scanning and real store prices remain unverified until the owner enables sync / confirms store links. No paid calls, video processing or live auto-sync were performed during implementation.
