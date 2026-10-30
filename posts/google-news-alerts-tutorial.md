---
title: Google News alerts with real article URLs — to Slack or Google Sheets
tags: news, automation, api, python
date: 2026-10-02
---

Google Alerts emails are hard to automate, and the Google News RSS feed gives you
`news.google.com/rss/articles/…` redirect links instead of the publisher's URL. This
tutorial builds a **news monitor** that:

- searches Google News for any keywords, sites, language and country
- returns the **publisher's real article URL**, publisher, date and related coverage
- returns only articles you haven't seen yet, on a schedule
- delivers them to Slack, email or a spreadsheet

## One article looks like this

```json
{
  "title": "Trump AI deal rebrands 'artificial intelligence' as 'superintelligence'",
  "url": "https://www.theguardian.com/us-news/2026/sep/29/trump-ai-deal-tech-ceos-superintelligence",
  "publisher": "theguardian.com",
  "publishedAt": "2026-09-30T17:37:00+00:00",
  "query": "artificial intelligence",
  "language": "en",
  "country": "US",
  "urlResolved": true
}
```

## Step 1 — choose what to watch

In [Google News Scraper](https://apify.com/tacps126/google-news):

- **Search queries** take Google News operators: `"exact phrase"`, `-exclude`, `OR`,
  `intitle:word`. Example: `"Acme Corp" -stock`.
- **Topics**: Top stories, Business, Technology, Science…
- **Only from these sites** / **Never from these sites**: e.g. `reuters.com`, `bbc.co.uk`.
- **Published within**: past hour, 24 h, week…
- **Language / Country**: `de` + `DE`, `hi` + `IN`, `ja` + `JP`, and so on.

## Step 2 — try it from code

```python
import os, requests

articles = requests.post(
    "https://api.apify.com/v2/acts/tacps126~google-news/run-sync-get-dataset-items",
    headers={"Authorization": f"Bearer {os.environ['APIFY_TOKEN']}"},
    json={"queries": ['"generative AI" -stock'], "timeframe": "1d", "maxItems": 50},
    timeout=300,
).json()

for a in articles:
    print(a["publishedAt"][:10], a["publisher"], "-", a["title"])
    print("   ", a["url"])
```

In my test runs, 100 articles come back in about 11 seconds, publisher URLs included.

## Step 3 — turn it into alerts

1. Save the input as a **task** and turn on **Only new articles**. Each run then returns
   only articles no earlier run delivered, and you pay only for those.
2. Add a **schedule**: hourly for breaking news, daily for a digest.
3. Add an **integration**: Slack (a message per run), Google Sheets (append rows), email,
   or a webhook into your own app or RAG index.

Running several monitors? Give each a different **Monitor name** so they keep separate
histories.

## Use cases

- PR and brand monitoring: your brand, executives, competitors.
- Investment research: tickers and company names, filtered to trusted publishers.
- AI and RAG pipelines: a fresh, deduplicated stream of article URLs to fetch and embed.
- Local news in any language, using the country and language editions.

## Cost

About **$2 per 1,000 articles**, and with "only new" you pay only for articles you
haven't already received.

---

Missing a filter? Open an issue on the
[Actor's Issues tab](https://apify.com/tacps126/google-news/issues).
