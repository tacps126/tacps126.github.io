---
title: Foreclosure and court auctions in Germany, Spain, Italy and India in one spreadsheet, ranked
tags: realestate, investing, auctions, automation
date: 2026-11-02
---

Court and bank auctions are where property sells below market, and they are hard to follow. Germany
publishes its court foreclosures (Zwangsversteigerungen) per state, Spain runs its public auctions on the
BOE portal, Italy lists court sales on the national sales portal, and Indian banks auction repossessed
homes and vehicles on their own e-auction portal. Four countries, four languages, four layouts, and no
way to compare one lot with the next.

This guide gets you every lot in one table, scored against similar lots nearby and against your budget,
in about 20 seconds.

## What you get

One row per lot, in the same format for every country:

| Field | Example |
|-------|---------|
| Score and verdict | 100, "1st of 9 in land, IT. 15% below the typical price per m² of 5 similar lots; vacant." |
| Price, valuation, currency | 12,000 EUR, official valuation where published |
| Debts that stay with the property, total cost | Spanish lots often carry them; total cost adds them |
| Area, price per m² | 788 m², 15.23 EUR per m² |
| Possession | vacant, occupied, or the bank holds physical possession |
| Auction date, days left, deposit | when bidding closes and what you put down |
| Seller, case number, documents, photos | court or bank, valuation report, notice |

## How the score works

Each lot is compared with its peers: flats with flats in the same town, Tata trucks with Tata trucks. When a
town has too few lots, the region or country is used, and the row says which group and how many lots were in
it. Lots are never compared across countries or currencies.

The score weighs price per m², discount to valuation, how far the reserve has been cut after failed
sales, possession, clear title, how much paperwork is published and time to the auction. Then it adds how well
the lot fits you: budget, distance from your place, area and dates. Lots that look far too cheap get a
warning to check the stated area, because a very low price per m² is more often a plot size or a share of a
property than a bargain.

## Step 1: open the tool

Go to [Auctions Radar](https://apify.com/tacps126/auctions-radar) and click **Try for free**. No Apify
account? [Create one free](https://console.apify.com/sign-up); no card needed. The free plan returns up to
50 lots per run.

## Step 2: say what you want

The prefilled input reads all four countries. To narrow it, switch to JSON and paste, for example, homes
within 25 km of Milan under 250,000 EUR:

```json
{
  "countries": ["IT"],
  "assetTypes": ["apartment", "house"],
  "location": "Milano",
  "radiusKm": 25,
  "budgetMax": 250000,
  "profile": "bargainHunter"
}
```

Other ideas:

- German foreclosures in Bavaria in the next 60 days: `"countries": ["DE"], "regions": ["Bayern"], "auctionWithinDays": 60`
- Vacant Spanish property with no debts to inherit: `"countries": ["ES"], "vacantOnly": true, "profile": "lowRisk"`
- Indian bank auctions in Kerala from 20 to 80 lakh: `"countries": ["IN"], "regions": ["Kerala"], "budgetMin": 2000000, "budgetMax": 8000000, "budgetCurrency": "INR"`

## Step 3: run and export

Click **Start**. Lots come back best score first. Export to Excel, CSV or Google Sheets from the
**Export** button.

## Get new lots and price cuts every week

Add `"monitorName": "my-watch", "changesOnly": true` and schedule the run weekly. Each run then returns only
new lots and lots whose price, date or status changed, with the price history. Send them to email, Slack or a
Google Sheet; there is a ready [n8n workflow](https://github.com/tacps126/apify-data-recipes/tree/main/integrations)
for the sheet.

## Price

$15 per 1,000 lots until 1 December 2026, then $5 per 1,000 lots. A typical weekly watch for one city costs
a few cents.

Always read the official notice and documents before you bid: the tool reads public listings and does not
bid or register for you.
