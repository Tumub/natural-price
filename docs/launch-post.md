# Launch post

Draft. Fill every bracket with a number from `docs/beta/weekly-summary-*`
and `GET /stats` before publishing. If a bracket cannot be filled, cut the
sentence.

---

**Natural Price: an open-source extension that shows you the price a stranger gets**

Surveillance pricing, also called personalised pricing, is legal in the EU
as long as the shop tells you it happened. Almost none of them do. For the last [N] weeks, [N] people ran a
small extension I built that reads the price on a product page, has a
server load the same page in a fresh anonymous session, and shows both.

What we found on [three] sites, [N] checks:

- Clean sessions were shown the same price [N]% of the time.
- [N] checks found a difference. The median difference was [N]%, the
  largest [N]% on [site].
- [Site] blocked [N]% of clean fetches. When that happens the extension
  falls back to what other users saw the same hour.

It sends nothing that identifies you. The schema of what leaves your
browser is a file in the repository and the server rejects anything else.
The crowd data is published as an open dataset under CC BY 4.0.

Install: [Chrome Web Store link] · [Firefox link] · [GitHub]

If you run a shop and think a number above is wrong, the fixture and the
test that produced it are in the repository. Open an issue.

What it is not: it does not make you anonymous, and it does not say
"discrimination". It says what was observed, with a confidence level.
Adding a site takes one file, one saved page and one test.

---

Post to: the beta testers first, then Show HN, then the privacy and
consumer communities that hosted the beta call, then journalists who cover
pricing, with the dataset link.
