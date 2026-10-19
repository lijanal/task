// Market clearing price from aggregated supply/demand curves (Nord Pool Day-Ahead style).
// Curves are piecewise linear between consecutive points (SeqNr order).

const REQUIRED = ['DeliveryDateCET', 'Area', 'SupplyDemand', 'HourIndex_1_25', 'StartTimeUTC', 'SeqNr', 'Qty_MWH', 'PriceAmount_EUR'];

export function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) throw new Error('Dokumentas tuščias arba jame yra tik antraštės eilutė.');

  const delim = [',', ';', '\t'].reduce((best, d) =>
    lines[0].split(d).length > lines[0].split(best).length ? d : best, ',');
  const header = lines[0].split(delim).map(h => h.trim().replace(/^"|"$/g, ''));
  const missing = REQUIRED.filter(c => !header.includes(c));
  if (missing.length) throw new Error(`Trūksta stulpelių: ${missing.join(', ')}`);
  const idx = Object.fromEntries(REQUIRED.map(c => [c, header.indexOf(c)]));

  // With ';' or tab delimiters, a decimal comma is allowed.
  const num = s => {
    s = (s ?? '').trim().replace(/^"|"$/g, '');
    if (s === '') return NaN;
    return Number(delim === ',' ? s : s.replace(',', '.'));
  };

  const rows = [];
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].split(delim);
    const row = {
      date: f[idx.DeliveryDateCET]?.trim(),
      area: f[idx.Area]?.trim(),
      side: f[idx.SupplyDemand]?.trim().toUpperCase(),
      hour: parseInt(f[idx.HourIndex_1_25], 10),
      startUtc: f[idx.StartTimeUTC]?.trim(),
      seq: num(f[idx.SeqNr]),
      qty: num(f[idx.Qty_MWH]),
      price: num(f[idx.PriceAmount_EUR]),
    };
    if ((row.side !== 'S' && row.side !== 'D') || !Number.isFinite(row.qty) || !Number.isFinite(row.price) || !Number.isFinite(row.hour)) {
      skipped++;
      continue;
    }
    rows.push(row);
  }
  if (!rows.length) throw new Error('Nerasta tinkamų kreivių taškų.');
  return { rows, skipped };
}

export function groupPeriods(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = `${r.date}|${r.area}|${r.hour}`;
    let p = map.get(key);
    if (!p) map.set(key, p = { date: r.date, area: r.area, hour: r.hour, startUtc: r.startUtc, supply: [], demand: [] });
    (r.side === 'S' ? p.supply : p.demand).push(r);
  }
  for (const p of map.values()) {
    p.supply.sort((a, b) => a.seq - b.seq);
    p.demand.sort((a, b) => a.seq - b.seq);
  }
  return [...map.values()].sort((a, b) =>
    a.date.localeCompare(b.date) || a.area.localeCompare(b.area) || a.hour - b.hour);
}

// Range of quantities [lo, hi] a curve takes at price p. A horizontal step (several
// quantities at one price) gives a range; outside the curve, the end point is used.
function qtyAt(points, p) {
  let lo = Infinity, hi = -Infinity;
  const add = q => { if (q < lo) lo = q; if (q > hi) hi = q; };
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    if (a.price === p) add(a.qty);
    const b = points[i + 1];
    if (!b) continue;
    const pmin = Math.min(a.price, b.price), pmax = Math.max(a.price, b.price);
    if (p > pmin && p < pmax) add(a.qty + (b.qty - a.qty) * (p - a.price) / (b.price - a.price));
  }
  if (lo === Infinity) {
    // p is outside the curve's price range: use the nearest end point.
    const byPrice = [...points].sort((x, y) => x.price - y.price);
    const end = p < byPrice[0].price ? byPrice[0] : byPrice[byPrice.length - 1];
    lo = hi = end.qty;
  }
  return [lo, hi];
}

// Excess supply S(p) - D(p) goes up as price goes up. Returns the price where it crosses 0.
export function clearPeriod(period) {
  const { supply, demand } = period;
  if (!supply.length || !demand.length) return { ...period, price: null, volume: null, note: 'Trūksta pasiūlos arba paklausos kreivės' };

  const prices = [...new Set([...supply, ...demand].map(r => r.price))].sort((a, b) => a - b);
  const excess = p => {
    const [sLo, sHi] = qtyAt(supply, p);
    const [dLo, dHi] = qtyAt(demand, p);
    return { lo: sLo - dHi, hi: sHi - dLo };
  };

  let prev = null;
  for (const p of prices) {
    const e = excess(p);
    if (e.hi >= 0) {
      if (e.lo <= 0 || prev === null) {
        // Crosses exactly at this price (on a step), or supply already exceeds demand at the lowest price.
        return finish(period, p, prev === null && e.lo > 0 ? 'Pasiūla viršija paklausą net esant mažiausiai kainai' : '');
      }
      // Both curves are linear between prev.p and p: interpolate the zero crossing.
      const price = prev.p + (0 - prev.e.hi) * (p - prev.p) / (e.lo - prev.e.hi);
      return finish(period, price, '');
    }
    prev = { p, e };
  }
  return finish(period, prices[prices.length - 1], 'Paklausa viršija pasiūlą net esant didžiausiai kainai');
}

function finish(period, price, note) {
  const [sLo, sHi] = qtyAt(period.supply, price);
  const [dLo, dHi] = qtyAt(period.demand, price);
  // Cleared volume: the quantity where the two ranges overlap.
  const volume = Math.max(sLo, dLo) <= Math.min(sHi, dHi) ? Math.min(sHi, dHi) : (sLo + sHi + dLo + dHi) / 4;
  return { ...period, price, volume, note };
}

export function computePrices(text) {
  const { rows, skipped } = parseCsv(text);
  const periods = groupPeriods(rows).map(clearPeriod);
  return { periods, skipped, rowCount: rows.length };
}
