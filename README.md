# task

Web tool that calculates the Nord Pool Day-Ahead electricity price (EUR/MWh) where the aggregated
supply and demand curves cross, for every trading period (hour) in an uploaded CSV.

## Input

A CSV with the same structure as `AggregatedOrder_2023-01-01_PriceCurves_BALTIC.csv` (the file from the task):

```
DeliveryDateCET,Area,SupplyDemand,HourIndex_1_25,StartTimeUTC,SeqNr,Qty_MWH,PriceAmount_EUR
```

`SupplyDemand` is `S` or `D`. Files with several dates or areas are split into separate periods.
`;` or tab delimiters (with decimal commas) also work.

## Method

For each period, curve points are joined in `SeqNr` order with straight lines, the same way Nord Pool
draws its curves. Excess supply `S(p) − D(p)` only grows as price rises, so the clearing price is where
it crosses zero: exactly on a curve step, or interpolated between two neighbouring price points. If
demand still exceeds supply at the maximum price, the maximum price is reported (and the minimum price
in the opposite case). The logic is in [`js/clearing.js`](js/clearing.js).

## Output

After a file is uploaded: a table and charts in the browser (another file can be uploaded at any time), plus a downloadable CSV with
`DeliveryDateCET, Area, HourIndex_1_25, StartTimeUTC, PeriodCET, ClearingPrice_EUR_MWh, ClearedVolume_MWh, Note`.

## Hosting

This is a static site with no build step and no dependencies. Cloudflare Pages settings:

- Framework preset: None
- Build command: *(empty)*
- Build output directory: `/`

To run it locally, serve the folder with any static server (ES modules don't load from `file://`), for example:

```
npx serve .
```
