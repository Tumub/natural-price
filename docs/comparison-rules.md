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
| high | Crowd baseline agrees (phase 4) |

When two clean fetches disagree by more than 0.5 percent, the comparison
stays at low confidence and says the site may be A/B testing or pricing by
location. That is not a personalisation finding.

**Never claimed:** discrimination, intent, or the reason for a difference.
The badge says what was observed.
