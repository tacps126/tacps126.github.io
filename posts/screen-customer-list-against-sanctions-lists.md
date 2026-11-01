---
title: How to screen a customer or supplier list against OFAC, UN, EU and UK sanctions lists (cheaply)
tags: compliance, kyc, sanctions, fintech
date: 2026-11-02
---

If you onboard customers, pay suppliers abroad or ship goods across borders, you are expected to check names
against the sanctions lists. Commercial screening suites start at hundreds of dollars a month. For a small
team with a few hundred or a few thousand names, that is a lot to pay for a lookup.

This guide screens a whole list against seven official lists in one run, for $3 per 1,000 names, with a
verdict per name you can hand to whoever signs off.

## Which lists

Read fresh from each publisher on every run:

- US OFAC Specially Designated Nationals (SDN) list and the consolidated non-SDN list
- UN Security Council consolidated list
- EU consolidated financial sanctions list
- UK sanctions list
- Canada's consolidated autonomous sanctions list
- Switzerland's SECO list

About 46,000 entries in all.

## What you get

One row per name you screened:

| Field | Example |
|-------|---------|
| Verdict | `match`, `possible-match` or `no-match` |
| Top score | 100 |
| Best matches | the listed name or alias that matched, which list, the sanctions programme |
| Details | countries, birth dates, passport or registration numbers where the list gives them |
| Checks | `birthYear: consistent`, `country: different` when you supply them |
| Link | the entry on the publisher's site |

## Matching that copes with real names

Names arrive in every spelling. `Владимир Путин`, `PUTIN, Vladimir` and `V. Putin` are found as the same
person; `Mohammed` and `Muhammad` match; company forms such as `Ltd`, `LLC` or `GmbH` are ignored; and common
words like *Trading* or *Bank* count for less, so `Bank` alone does not match every listed bank. Give a date of
birth or a country and a different one lowers the score and is flagged, so you review fewer false alarms.

## Step 1: open the tool

Go to [Sanctions Screener](https://apify.com/tacps126/sanctions-screener) and click **Try for free**. No
Apify account? [Create one free](https://console.apify.com/sign-up); no card needed. The free plan screens up
to 100 names per run.

## Step 2: paste your names

One per line in **Names**, or switch to JSON and send your own references:

```json
{
  "names": ["Rosneft", "Acme Trading LLC"],
  "subjects": [
    { "name": "Jane Example", "id": "customer-17", "dateOfBirth": "1980", "country": "GB" }
  ],
  "minScore": 85
}
```

## Step 3: run and export

Click **Start**. Each run loads all seven lists fresh, which takes about a minute, then screens your names in
seconds; one run can screen thousands. Export the verdicts to Excel, CSV or Google Sheets.

## Keep it current

- **Rescreen weekly.** Schedule the same input; there is a ready [n8n workflow](https://github.com/tacps126/apify-data-recipes/tree/main/integrations)
  that writes each week's verdicts to a Google Sheet.
- **Follow the lists themselves.** Mode `changes` reports new designations and removals since the last run.
- **Screen during onboarding.** Standby mode keeps the lists in memory and answers each check in milliseconds.

A screening result is a lead for your compliance review, not a legal determination. Check every match against
the publisher's entry before you act on it.
