-- Natural Price crowd aggregation. This exact statement runs in
-- packages/crowd-api/src/store.ts. Published so anyone can check what the
-- crowd baseline is: per product, currency, destination country and UTC
-- hour, the number of observations, the number of distinct installs that
-- hour (install hashes are salted per day and cannot be joined across
-- days), the minimum, the maximum and the median price.
--
-- :bucket is either an hour ('2026-11-03T14') or a day ('2026-11-03').
-- Rows are matched by prefix, so a day bucket covers all its hours.
WITH ranked AS (
  SELECT product_key, key_type, currency, country, price, install_hash,
         ROW_NUMBER() OVER (PARTITION BY product_key, currency, country ORDER BY price) AS rn,
         COUNT(*)     OVER (PARTITION BY product_key, currency, country)                AS n
  FROM observations
  WHERE hour LIKE :bucket || '%'
    AND product_key = :product_key AND currency = :currency AND country = :country
)
SELECT product_key, key_type, currency, country,
       n,
       COUNT(DISTINCT install_hash) AS installs,
       MIN(price) AS min,
       MAX(price) AS max,
       AVG(CASE WHEN rn IN ((n + 1) / 2, (n + 2) / 2) THEN price END) AS median
FROM ranked
GROUP BY product_key, currency, country;
