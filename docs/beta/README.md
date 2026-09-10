# Private beta

Phase 3 of [PLAN.md](../PLAN.md). Fifty testers, November 2026, three
launch sites. Everything a tester or the maintainer needs is in this
folder.

| File | For |
|---|---|
| [pitch.md](pitch.md) | Recruiting: the paragraph, the channels, the Show HN draft |
| [install.md](install.md) | Testers: install the unpacked extension in five minutes |
| [feedback.md](feedback.md) | Testers: what to tell us, and how, without giving us personal data |
| [weekly-summary-template.md](weekly-summary-template.md) | Maintainer: the Friday note that keeps testers engaged |

## What the beta measures

All of it comes from `GET /stats` on the fetch service and from feedback
issues. Nothing is measured per person.

| Question | Source | Target |
|---|---|---|
| How often is the clean fetch blocked, per site | `/stats` fetch statuses | success over 70 percent |
| How often is a difference found, per site | `/stats` verdicts | reported, no target |
| Do people act on it | feedback form question 4 | reported, no target |
| Are testers still using it | weekly active testers from feedback and `/stats` check counts | 30 of 50 |
| Did anything leak | payload schema enforced at the service; review against PRIVACY.md at the end | zero findings |

## Exit

Thirty weekly active testers, fetch success over 70 percent on the three
sites, zero open privacy findings. Then phase 4.
