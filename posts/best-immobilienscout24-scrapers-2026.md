---
title: The best ImmobilienScout24 scrapers in 2026 (compared by price, data and features)
tags: realestate, webscraping, germany, api
date: 2026-10-13
---

ImmobilienScout24 (ImmoScout24) is Germany's largest property portal, and it has no
public API for listings. If you want rental or sale listings in a spreadsheet for price
analysis, investment screening, relocation or a proptech product, a ready-made scraper on
Apify is the quickest route. I compared the five that are actively maintained.

**Disclosure:** I built one of them (tacps126). I've kept the comparison to facts you can
check on each Store page (pricing and features as listed on 2026-10-13), and I note where
others do things mine doesn't.

## The comparison

| Scraper | Price per 1,000 listings | Start fee per run | Countries | Notable extras |
|---|---|---|---|---|
| [memo23 — ImmoScout24 .de/.ch/.at + Price-Cut Archive](https://apify.com/memo23/immobilienscout24-scraper) | $1.75 | $0.005 | DE, CH, AT | Price-cut archive, phone numbers (extra fee), market analysis add-on |
| [azzouzana — ImmobilienScout24 Scraper](https://apify.com/azzouzana/immobilienscout-immoscout-scraper) | $1.00 | $0.006 | DE | Search-URL based |
| [clearpath — ImmoScout24 API Pro](https://apify.com/clearpath/immoscout24-api-pro) | $1.19 | $0.002 | DE | 50+ fields |
| [igolaizola — ImmobilienScout24 Scraper](https://apify.com/igolaizola/immobilienscout24-scraper) | $1.00 (+$1 for details) | $0.01 | DE | Optional detail pages |
| [tacps126 — ImmobilienScout24 Scraper](https://apify.com/tacps126/immobilienscout24-scraper) | $1.00 | ~$0.0001 | DE | Plain-word locations, price per m², coordinates, seller filter, only-new alerts |

Start fees matter if you run small scheduled jobs: an hourly alert costs 24 starts a day.

## How to choose

- **You need Switzerland or Austria, price history or phone numbers:** memo23 is the most complete and the most used (about 190 users a month, 5★).
- **You want the lowest cost for frequent, small monitoring runs:** pick one with no real start fee, so a daily "only new listings in Berlin" run costs cents.
- **You want full exposé details** (description text, full equipment list): igolaizola and memo23 offer detail fetching.
- **You start from a city name rather than a URL:** tacps126 lets you type `Berlin` or `München Schwabing` and set price/area/rooms filters, or paste search URLs.

## What a listing looks like (tacps126)

```json
{
  "title": "Wohnen mit Herz – wie geschaffen für zwei",
  "offerType": "rent",
  "price": { "amount": 594.78, "currency": "EUR", "period": "month" },
  "totalRent": 800.94,
  "livingArea": 51.72,
  "rooms": 2,
  "pricePerSqm": 11.5,
  "address": { "postcode": "12619", "city": "Berlin", "district": "Kaulsdorf (Hellersdorf)" },
  "latitude": 52.52485,
  "longitude": 13.58695,
  "energyClass": "B",
  "features": ["balcony", "cellar", "lift"],
  "url": "https://www.immobilienscout24.de/expose/168986388"
}
```

In my test runs it returned 1,112 listings (Hamburg houses for sale and Berlin rentals, 50
result pages) in 21 seconds.

## Calling it from code

```python
import os, requests

rows = requests.post(
    "https://api.apify.com/v2/acts/tacps126~immobilienscout24-scraper/run-sync-get-dataset-items",
    headers={"Authorization": f"Bearer {os.environ['APIFY_TOKEN']}"},
    json={"locations": ["Berlin"], "offerType": "rent", "maxPrice": 1500, "minRooms": 2, "sort": "newest", "maxItems": 200},
    timeout=300,
).json()
avg = sum(r["pricePerSqm"] for r in rows if r.get("pricePerSqm")) / max(1, sum(1 for r in rows if r.get("pricePerSqm")))
print(f"{len(rows)} listings, average cold rent {avg:.2f} €/m²")
```

## Legal note

All of these collect publicly listed ads. Listings can include contact names, so handle
them under GDPR (purpose limitation, no unsolicited marketing to private landlords).
