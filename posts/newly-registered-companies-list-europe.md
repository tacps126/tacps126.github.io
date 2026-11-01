---
title: A daily list of newly registered companies in France, Norway, Finland and Estonia, from the official registers
tags: sales, leadgeneration, b2b, automation
date: 2026-11-02
---

A company that registered this week needs an accountant, a bank account, insurance, payroll, a website, a
phone plan and a point-of-sale system, and it has not chosen any of them yet. If you sell any of those, new
registrations are the warmest list you can get. Lead vendors resell them weeks later. The registers publish
them every day.

This guide gets you the companies registered since yesterday, straight from the official registers, in about
three seconds.

## Where the data comes from

- **France:** BODACC, the official bulletin of company announcements
- **Norway:** the Brønnøysund Register Centre
- **Finland:** the PRH / YTJ business information system
- **Estonia:** the e-Business Register
- **United States:** the open business registers of New York, Colorado, Connecticut and Oregon

Insolvencies and other events are in the same feed for credit and collections teams.

## What you get

| Field | Example |
|-------|---------|
| Name, register id, country | KL-Steel Oy, 3612917-2, FI |
| Legal form | Limited company |
| Registered on | 2026-11-01 |
| Address, city | Hämeenlinna |
| Website | when the register has it |
| Industry code and activity | where published |
| Officers | directors and board members, when you turn them on and the register publishes them |
| Link | the company's page in the register |

## Step 1: open the tool

Go to [Company Registry](https://apify.com/tacps126/company-registry) and click **Try for free**. No Apify
account? [Create one free](https://console.apify.com/sign-up); no card needed. The free plan returns up to
100 companies per run.

## Step 2: choose countries and filters

The prefilled input returns 40 companies registered this week across four countries. To focus, switch to JSON:

```json
{
  "mode": "new",
  "countries": ["FI", "NO"],
  "registeredWithinDays": 2,
  "keywords": ["software", "consulting"]
}
```

Filter by industry codes or locations the same way.

## Step 3: run and export

Click **Start** and export to Excel, CSV or Google Sheets.

## Get it every morning

Add `"onlyNew": true, "monitorName": "new-companies"` and schedule the run daily: each run returns only
companies the earlier runs did not deliver. A ready [n8n workflow](https://github.com/tacps126/apify-data-recipes/tree/main/integrations)
appends them to a Google Sheet every morning.

## Price

$2.50 per 1,000 companies. A daily feed for one country is a few cents a week.

Sole traders appear in some registers under a person's name. Follow your local rules on direct marketing
before you contact them.
