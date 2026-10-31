# Wishlist "find the item" — Step 1 research (no build yet)

Written 2026-10-31. This document only compares options. Nothing was built, no keys were
created, and no paid calls were made. Building waits for the owner's OK.

## The question

Today the Wishlist only checks a store link the owner has already confirmed. "Find the item"
would let the owner type a description ("black 10x20 canopy tent with side walls") and get
back the stores that sell it. That needs a shopping search service.

## Recommendation: Serper.dev, Shopping endpoint

It is the cheapest option that returns real product listings across many stores.

| | Detail |
|---|---|
| Cost | $1.00 per 1,000 searches ($0.001 each) in the $50 / 50,000-credit pack |
| Bulk prices | $375 / 500k ($0.75 per 1k), $1,250 / 2.5M ($0.50 per 1k), $3,750 / 12.5M ($0.30 per 1k) |
| Free start | 2,500 free queries, no credit card required |
| Key needed | Yes — one API key, sent in an `X-API-KEY` header |
| Credit expiry | 6 months from purchase |
| Results per search | 10 product listings per credit (11–100 listings costs 2 credits) |
| What you get | Product title, price, store name, product link, thumbnail — from stores that list in Google Shopping |

At a realistic wishlist pace (say 100 searches a month) the free 2,500 queries last about two
years, and paid searches would cost about $0.10 a month.

## Stores it cannot check

- **Amazon.** Amazon products are not reliably in Google Shopping, Amazon blocks scrapers,
  and its own Product Advertising API requires an approved Amazon Associates account plus
  qualifying sales under Amazon's operating agreement. It is not a sign-up-and-go price API.
- **Membership-only prices.** Costco, Sam's Club and similar show member prices only after login.
- **Stores that do not feed Google Shopping.** Small independent shops, Facebook Marketplace,
  Craigslist and similar are usually invisible.
- **Sites that block bots.** If the store refuses automated requests, the result will be missing.
  The existing Wishlist reader already respects robots rules and blocks, and that stays true.

## Alternatives checked

| Option | Cost | Key | Limits |
|---|---|---|---|
| Serper Shopping | $1 / 1,000 | Yes, free tier | Recommendations above |
| SerpApi Google Shopping | $25 / 1,000 (Starter), $75 / 5,000 (Developer) | Yes, 250 free/month | Pricier, but includes a U.S. legal shield and ZeroTrace option |
| SearchAPI.io | Not confirmed here | Yes | Has dedicated Amazon, Walmart, Best Buy and eBay endpoints; pricing page was not readable during this review |
| eBay Browse API | Free (limits apply) | Yes | eBay listings only |
| Best Buy API | Free | Yes | Best Buy only |
| Amazon Product Advertising API | Free | Associates approval | Amazon only, and only after qualifying sales |
| Google Custom Search JSON API | $5 / 1,000 | Yes | Closed to new customers; existing users lose it January 1, 2027 — not viable |

## How it would fit the existing Wishlist (for the later build)

1. Owner types a description; server calls the shopping search once and shows candidate
   stores with prices.
2. Owner picks a store and confirms its link, exactly as today.
3. The existing page reader (robots-respecting, JSON-LD only) re-reads that page and records
   the real price, so a stale or wrong search price is never saved.
4. The search key lives in the ignored `.env` file; the dashboard shows the cost of a search
   before it runs.

## What "OK" would authorize

One new module, one endpoint, an `.env` key, and tests with stand-in responses. Live searches
against the real service would need a separate approval because they spend credits.
