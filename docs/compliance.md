# Compliance notes

**Not legal advice.** Written by the maintainers to record what was
considered and what is still open. A lawyer should read it before the
hosted service is promoted publicly.

## Why the default matters

The extension compares prices on the user's own device and sends nothing.
Processing carried out by a person on their own device for their own
purposes is not processing by us at all, and the purely personal activity
exemption (GDPR Article 2(2)(c)) covers the user's side. That removes most
of the regulation from most of the product. Everything below is about the
optional hosted servers.

## What applies to the hosted servers

| Rule | Position |
|---|---|
| GDPR Article 6 | Consent. Off by default, switched on in the options, withdrawable by switching back. Consent is specific: the options page names the companies the server may be contacted about. |
| GDPR Articles 13 and 14 | The notice is [PRIVACY.md](../PRIVACY.md). **Open: the controller's name, address and contact must be filled in.** |
| GDPR Article 5(1)(c), data minimisation | The schema is closed (`additionalProperties: false`) and the server rejects any field not in it. Tested. |
| GDPR Article 5(1)(e), storage limitation | Rate-limit counters expire in 24 hours; crowd rows are deleted after 90 days by a job that runs every six hours. |
| GDPR Article 25, by design and by default | The privacy-preserving setting is the default and the recommended one. |
| GDPR Article 11 | The daily salt makes crowd rows unlinkable across days and unattributable to a person. Stated in the notice, including what it costs the user in rights. |
| GDPR Article 28 | The hosting provider is a processor. **Open: sign the provider's data processing agreement.** |
| GDPR Article 30 | **Open: keep a short record of processing activities.** The regular nature of the processing means the small-organisation exemption should not be relied on. |
| GDPR Article 32 | TLS everywhere; secrets in environment variables; rate limits per identifier and per address; no personal data in application logs. **Open: the reverse proxy's own access log records client addresses. Either switch it off or state it in the notice and set a short retention.** |
| GDPR Article 44 and following | Servers in the EU. Operator in Switzerland, which has an adequacy decision. No other transfer. |
| ePrivacy Article 5(3) | The only thing stored on the device is a random identifier and the user's settings, both strictly necessary for a service the user asked for. No consent banner needed; nothing is read from the device for any other purpose. |
| Swiss FADP | Applies in parallel. The notice is written to satisfy both. |
| Chrome Web Store and AMO policies | Single purpose stated; permissions justified; a privacy policy URL is required and must be a working link before submission. The all-websites permission will attract review; the answer is that the reader runs locally and the default sends nothing. |

## Not data protection, but real

- **Terms of service.** In the server settings, our server loads a page it
  was not invited to load, which several shops forbid. In the default
  setting the fetch is made by the user's own browser, which is a person
  visiting a page. That is a further reason the device-first design is the
  right one, and a reason to keep the server list short.
- **Database rights.** The EU sui generis database right can cover a
  substantial extraction from a shop's catalogue. We publish per-product
  hourly aggregates contributed by users, not a catalogue, and never bulk
  crawl. Keep it that way.
- **Consumer law.** Directive (EU) 2019/2161 requires a trader to tell a
  consumer when a price was personalised by automated decision-making. The
  extension is a measurement tool for consumers, not a trader obligation.
  Nothing in the interface should be phrased as an accusation; the badge
  reports what was observed and carries a confidence level.
- **Accuracy.** Saying a shop personalises prices when it was A/B testing
  would be a false statement about a business. The comparison rules require
  the same currency, destination, product and a fifteen-minute window, and
  the wording never says "discrimination".

## Open items, in order

1. Fill in the controller's name, address and contact in PRIVACY.md.
2. Decide the reverse proxy access log: off, or disclosed with a short
   retention.
3. Sign the hosting provider's data processing agreement.
4. Write the one-page record of processing activities.
5. Have a lawyer read this file and PRIVACY.md before public promotion.
