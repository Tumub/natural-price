# Comparison rules

Implemented in `packages/fetch-service/src/compare.ts`. Change both together.

Two observations are **comparable** only if all of these hold:

1. **Same currency.** No conversion, ever.
2. **Same destination country** when both pages show one. If either side
   does not show it, assume the same and say so in the reasons.
3. **Same product.** Same product key when both keys are of the same type;
   otherwise the same canonical URL.
4. **Within 15 minutes** of each other, and the user's observation is not
   older than 15 minutes when the check runs. Dynamic pricing moves for
   everyone over time; a wide window would report that as personalisation.
5. **Same tax treatment.** Both prices come from the same page template, so
   this is assumed rather than checked. Stated in the reasons.

**Difference** is `(yours - clean) / clean`. Under 0.5 percent in either
direction is reported as `same`.

**Confidence**

| Level | Condition |
|---|---|
| low | One clean fetch |
| medium | Two clean fetches from different exit locations that agree within 0.5 percent |
| high | A clean fetch and the crowd median agree within 0.5 percent |

When two clean fetches disagree by more than 0.5 percent, the comparison
stays at low confidence and says the site may be A/B testing or pricing by
location. That is not a personalisation finding.

## Where the clean session comes from

A clean fetch can come from the server (exit named after its country) or
from a **private tab on the user's own device** (exit `private-tab`), sent
along with the observation. The two are treated alike by the rules above.
The server sees location and device effects too; the private tab uses the
user's own address, so shops do not block it, but it cannot see location or
device effects. When both are present and agree, confidence is medium. The
server fetch is the reference when both exist; the private tab is the
reference when the user chose private-tab-only mode or the server was
blocked.

## The crowd

The crowd baseline is the median price other installs reported for the
same product key, currency and destination country. It is used only when
**at least five other installs** reported it, this hour first, today
otherwise. The install asking is never counted as its own crowd.

- Clean fetch usable and crowd agrees with it: confidence **high**.
- Clean fetch usable and crowd disagrees: confidence unchanged, and the
  reasons say the site may price by session or time.
- Clean fetch blocked or unreadable and crowd available: the comparison is
  made against the crowd median at **medium** confidence, with `basis:
  "crowd"`. This is the path that survives when a site blocks every clean
  session.

**Never claimed:** discrimination, intent, or the reason for a difference.
The badge says what was observed.
