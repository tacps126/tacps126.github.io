---
title: Find companies hiring for the roles you sell to — every week, automatically
tags: sales, automation, api, webscraping
date: 2026-10-02
---

Job postings are one of the most honest buying signals in B2B. A company that just
opened four data-engineering roles is about to spend on data tooling; one hiring its
first RevOps lead will soon shop for a CRM stack. The postings are public. The hard part
is checking hundreds of career pages every week.

This tutorial sets up a weekly list of **target accounts that are hiring for the roles
you care about**, one row per company, with what changed since last week.

## What you get

One record per company with a signal, for example:

```json
{
  "company": "Stripe",
  "board": "greenhouse",
  "matchingRoles": 10,
  "newMatchingRoles": 10,
  "newestRolePostedAt": "2026-09-28T15:58:13+00:00",
  "functions": { "data": 7, "engineering": 3 },
  "matchedKeywords": { "data": 7, "machine learning": 3 },
  "roles": [
    { "title": "Data Scientist", "location": "Seattle, WA", "postedAtIso": "2026-09-22T00:23:42+00:00", "isNew": true, "url": "https://stripe.com/jobs/search?gh_jid=8222149" }
  ]
}
```

Companies without a matching role are skipped, and you aren't charged for them.

## Step 1 — list your accounts

Paste career-page URLs. Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Recruitee,
Personio and Teamtailor pages are detected automatically:

```
https://boards.greenhouse.io/stripe
https://jobs.lever.co/spotify
https://jobs.ashbyhq.com/ramp
```

No account list yet? Use **searches** instead (e.g. `data engineer` in `Germany`) to
discover companies hiring for a role.

## Step 2 — describe the roles that signal intent

`roleKeywords` matches job titles: `data`, `analytics`, `machine learning`. Narrow it
further with seniority, job function, work mode, locations, or "posted within N days".
`minMatchingRoles: 3` keeps only companies hiring for several of those roles at once,
which is a much stronger signal.

## Step 3 — run it

Open [Hiring Signals on Apify](https://apify.com/tacps126/hiring-signals), paste the
input, and click **Start**. Or call it from code:

```python
import os, requests

run = requests.post(
    "https://api.apify.com/v2/acts/tacps126~hiring-signals/run-sync-get-dataset-items",
    headers={"Authorization": f"Bearer {os.environ['APIFY_TOKEN']}"},
    json={
        "companies": ["https://boards.greenhouse.io/stripe", "https://jobs.lever.co/spotify"],
        "roleKeywords": ["data", "analytics", "machine learning"],
        "postedWithinDays": 30,
    },
    timeout=300,
)
for c in run.json():
    print(c["company"], c["matchingRoles"], "matching roles,", c["newMatchingRoles"], "new")
```

## Step 4 — make it weekly

1. Save the input as a **task**, then add a **schedule** (e.g. Mondays 08:00).
2. Turn on **Only new or changed**. Each run then returns only companies whose matching
   roles changed since the last run, so the weekly list stays short.
3. Add an **integration**: Slack, email, Google Sheets, HubSpot via Zapier/Make, or a
   webhook to your CRM.

## Step 5 — add contacts (optional)

Chain the [Website Contact Details](https://apify.com/tacps126/contact-details) Actor
after it to collect emails and social links from each company's website. Use that data
within GDPR / CAN-SPAM rules.

## Cost

About **1 cent per company with a signal**. Companies with nothing matching are free.
A 300-account list where 40 accounts are hiring costs about $0.40 a run.

---

Questions or a board that isn't supported yet? Open an issue on the
[Actor's Issues tab](https://apify.com/tacps126/hiring-signals/issues). Requests decide
what gets built next.
