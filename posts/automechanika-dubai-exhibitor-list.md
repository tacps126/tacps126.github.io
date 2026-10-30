---
title: How to get the Automechanika Dubai 2026 exhibitor list with emails (in 2 minutes)
tags: sales, leadgeneration, tradeshows, automation
date: 2026-10-28
---

Automechanika Dubai runs **10–12 November 2026** at Expo City Dubai. More than 800 companies
exhibit: parts makers, distributors, workshop-equipment brands, tyre and lubricant traders from
the UAE, India, China, Turkey, Germany and beyond.

If you sell to the automotive aftermarket, that exhibitor list is the best lead list of the
year. The show's website lets you browse it one company at a time. This guide gets you the
whole list as a spreadsheet, with emails, phones, websites and booths, in about two minutes.

## What you get

One row per exhibitor:

| Field | Example |
|-------|---------|
| Company | (exhibitor's legal name) |
| Booth | S / 04742 |
| Email | sales@… |
| Phone | +971 … |
| Website | https://… |
| City, country | Sharjah, United Arab Emirates |
| Description, product categories | … |

In our run, **790 of 804 exhibitors came with an email address**.

## Step 1: open the tool

Go to [Trade Show Exhibitor List Scraper](https://apify.com/tacps126/exhibition-scraper) and
click **Try for free**. If you don't have an Apify account, [create one free](https://console.apify.com/sign-up);
no card needed. The free plan returns up to 200 exhibitors per show, enough to check the data.

## Step 2: pick the show

In **Exhibitions**, choose *Automechanika Dubai*. Or switch to JSON and paste:

```json
{
  "exhibitionList": ["automechanika-dubai"],
  "maxResults": 1000,
  "includeDetails": true
}
```

Leave **Include contact details** on: that's what adds email, phone and address.

## Step 3: run and download

Press **Start**. When it finishes, open **Output → Export** and pick CSV or Excel. The *Contacts*
view gives you a flat table ready for your CRM.

Cost on a paid plan: about $2 per 1,000 exhibitors, so the whole show costs less than a coffee.

## Step 4: narrow it down

A few filters that work well in a spreadsheet:

- **Country = India** (or your market): 23 Indian exhibitors this year, a short list to call first.
- **Country = United Arab Emirates**: about 120 local traders and distributors, the buyers most
  exhibitors want to meet.
- **Description contains** `brake`, `filter`, `battery`, `lubricant`: your product category only.

## Step 5: book meetings before the show

The list is worth most **before** the doors open. Email the companies you want to meet with their
booth number in the first line ("I'll be at Automechanika, could I stop by S / 04742 on the 11th?").
Short, specific, booth in the subject: reply rates are far higher than cold email without a reason.

## Keep it fresh

Exhibitor lists keep growing until the show opens. Turn on **Only new exhibitors** and schedule the
tool daily (Apify → *Schedules*): each run returns only companies added since the last one.

## Send it to your tools automatically

- **Google Sheets:** the tool's *Integrations* tab, or our ready n8n workflow (show → Google Sheet).
- **Clay:** *Import from Apify → Actor run*, then enrich each exhibitor with your usual providers.
- **Make / Zapier:** the Apify app → *Run an Actor* `tacps126/exhibition-scraper` → *Get dataset items*.

Setup steps for all four: [integrations guide](https://github.com/tacps126/apify-data-recipes/tree/main/integrations).

## Other shows

The same tool covers 90+ trade shows (MEDICA, Automechanika Frankfurt, Riyadh and Shanghai, SEMA Show,
World Health Expo, Intersec Saudi Arabia…) and **any show by link**: paste the
exhibitor-list URL into **Start URLs**.

---

*Found it useful? A short review on the [tool's page](https://apify.com/tacps126/exhibition-scraper)
helps others find it.*
