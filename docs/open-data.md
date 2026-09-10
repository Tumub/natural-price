# Open data

The crowd baseline is published so that anyone, including the people who
mistrust this project, can check it and build on it.

## What is published

`GET /export/YYYY-MM-DD` on the crowd API, one JSON document per UTC day.
Each row is one product, currency, destination country and hour:

| Field | Meaning |
|---|---|
| `productKey`, `keyType` | GTIN, SKU, MPN or canonical URL, as read from the page |
| `host` | the shop's hostname |
| `currency`, `country` | as shown on the page |
| `bucket` | UTC hour |
| `n` | observations |
| `installs` | distinct installs that hour |
| `min`, `max`, `median` | prices |

No row is published with fewer than one observation, and no field in the
export identifies a person, an install, or a page path. The SQL that
produces the rows is [crowd-aggregation.sql](crowd-aggregation.sql).

## Licence

Creative Commons Attribution 4.0 (CC BY 4.0). Attribute "Natural Price
contributors" with a link to the repository.

## Schedule

The maintainer publishes the previous seven days as files under a
`data/` release on GitHub every Monday, once the crowd API is deployed.
Until then, anyone running their own crowd API has the same endpoint.

## Known limits

- A median of five is a small median. Treat `installs` as the confidence.
- Prices are what the page's structured data said, tax treatment included
  as the page presents it. Two shops can differ in that.
- The dataset says what people were shown. It does not say why.
