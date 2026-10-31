# Claim checking — Agent Reach vs. a plain search API (Step 1 research)

Written 2026-10-31. Comparison only. Nothing was installed, no keys were made, no paid calls.
Building waits for the owner's OK.

## The question

Research results are currently marked NOT VERIFIED and the Check claims button is disabled on
purpose. Enabling it needs an outside evidence source: something that can find public pages
that support or contradict a claim, then fetch them. Two candidates were reviewed.

## Option A — Agent Reach

An open-source command-line tool that gives an agent access to sites it otherwise cannot read.

| | Detail |
|---|---|
| What it installs | Python 3.10+ and its own toolchain, via `uv`, into `~/.agent-reach/` — plus a background browser |
| Logins / cookies | Copies an already-signed-in site's login out of the owner's Chrome profile the first time that site is used (never reads passwords); opens a login window when needed |
| License | MIT |
| Cost | Free for the tool itself. Speech-to-text channels need a Groq or OpenAI key |
| What it adds | Login-walled social sites (X, Reddit, LinkedIn, Xiaohongshu), video subtitles, Chinese platforms, plus a basic web search/read fallback |
| Risks | Reuses the owner's real sessions; automation can breach platform terms and get accounts restricted; single-maintainer project that can break when sites change; runs Python and a browser on this machine; adds a large dependency surface to a small Node app |

Its own README recommends using a secondary account and describes the channels as able to
"break at any time."

## Option B — a plain web search API (recommended: Brave Search API)

A normal HTTPS API that returns search results and page text. No browser, no cookies.

| | Detail |
|---|---|
| What it installs | Nothing. One HTTP call from the existing Node server |
| Logins / cookies | None. Only an API key in the ignored `.env` |
| License | Commercial terms of service; the API key identifies the account |
| Cost | $5.00 per 1,000 requests ($0.005 each); $5 in free credits every month (about 1,000 free searches); prepaid, no subscription |
| Also available | LLM Context endpoint returns page passages ready to send to a model; Serper is a cheaper alternative at $1 per 1,000 if price is the deciding factor |
| Risks | Results are public-web only — no login-walled sites; rate limits; the answers are only as good as the pages found; token cost of sending evidence to DeepSeek is separate and must be shown first |

## Side-by-side

| | Agent Reach | Brave search API |
|---|---|---|
| Install footprint | Python + uv + browser + per-site tools | None |
| Owner's accounts touched | Yes — copies site logins | No |
| License/cost | MIT, free (some channels need a key) | Commercial, $5 / 1,000 |
| Reach | Login-walled social platforms and video | Public web pages |
| Fit for claim checking | Poor: claims are usually verified against public sources, and the cookie copying conflicts with this project's rule never to use or copy browser profiles | Good: server-side, key-only, auditable cost per check |
| Failure mode | Breaks when platforms change; account risk | Rate limits or a weak result set |

## Recommendation

Use a plain search API — Brave Search API first, Serper as the cheaper fallback. It matches how
this app already works (Node server, key in `.env`, no browser profiles), keeps the owner's
personal accounts out of the path, and has a clear per-search price. Agent Reach is the better
tool for a human driving an AI assistant through their own logged-in accounts; it is the wrong
shape for a server that must stay read-only about the owner's identity.

## Cost per claim check (would be shown before running)

- 1–2 searches per claim: about $0.005–$0.01 at Brave.
- Page fetching: free, using the app's existing restricted fetcher.
- DeepSeek reading the evidence: existing per-token cost, previewed as it is today.

## What "OK" would authorize

One new evidence module, a search key in `.env`, a cost preview, and tests with stand-in
responses. Live searches would need separate approval because they spend credits.
