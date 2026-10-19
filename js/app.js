import { computePrices } from './clearing.js';

const $ = id => document.getElementById(id);
const SVG = 'http://www.w3.org/2000/svg';
const fmt = (v, d = 2) => v == null ? '–' : v.toLocaleString('lt-LT', { minimumFractionDigits: d, maximumFractionDigits: d });
const cetTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false });

let state = { periods: [], selected: 0, fileName: '' };

// ---------- input ----------
const drop = $('drop');
$('pick').onclick = () => $('file').click();
$('file').onchange = e => {
  if (e.target.files[0]) readFile(e.target.files[0]);
  e.target.value = ''; // so the same file can be picked again
};
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', e => {
  e.preventDefault();
  drop.classList.remove('over');
  if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
});
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') $('file').click(); });

function readFile(file) {
  const reader = new FileReader();
  reader.onload = () => run(reader.result, file.name);
  reader.onerror = () => showError('Nepavyko perskaityti dokumento.');
  reader.readAsText(file);
}

function showError(msg) {
  $('error').textContent = msg;
  $('error').hidden = !msg;
}

function run(text, fileName) {
  try {
    const { periods, skipped } = computePrices(text);
    showError(skipped ? `Praleista eilučių be tinkamo kiekio ar kainos: ${skipped}.` : '');
    state = { periods, selected: 0, fileName };
    render();
  } catch (err) {
    $('results').hidden = true;
    showError(`${fileName}: ${err.message}`);
  }
}

// ---------- rendering ----------
function periodLabel(p) {
  const start = new Date(p.startUtc);
  if (isNaN(start)) return `${String(p.hour - 1).padStart(2, '0')}:00–${String(p.hour).padStart(2, '0')}:00`;
  return `${cetTime.format(start)}–${cetTime.format(new Date(start.getTime() + 3600e3))}`;
}

const periodTitle = p => `${p.date} ${p.area} · ${p.hour} valanda (${periodLabel(p)} CET) · ${fmt(p.price)} EUR/MWh`;

function render() {
  const { periods, fileName } = state;
  $('results').hidden = false;
  $('file-name').textContent = fileName;

  const priced = periods.map((p, i) => ({ p, i })).filter(x => x.p.price != null);
  const avg = priced.reduce((a, x) => a + x.p.price, 0) / priced.length;
  const vol = periods.reduce((a, p) => a + (p.volume ?? 0), 0);
  // Period with the lowest/highest price (the first one if several hours tie).
  const extreme = better => priced.reduce((best, x) => better(x.p.price, best.p.price) ? x : best);
  const min = extreme((a, b) => a < b), max = extreme((a, b) => a > b);
  const ties = v => priced.filter(x => x.p.price === v).length - 1;
  const when = x => `${x.p.date} ${periodLabel(x.p)} CET${ties(x.p.price) ? ` (+${ties(x.p.price)} val.)` : ''}`;
  $('stats').innerHTML = [
    ['Prekybos laikotarpių', periods.length, 0],
    ['Vidutinė kaina', avg, 2, 'EUR/MWh'],
    ['Mažiausia kaina', min.p.price, 2, 'EUR/MWh', min],
    ['Didžiausia kaina', max.p.price, 2, 'EUR/MWh', max],
    ['Bendras kiekis', vol, 0, 'MWh'],
  ].map(([label, v, d, unit, at]) => `<div class="stat${at ? ' link-stat" data-i="' + at.i + '" title="Rodyti šios valandos kreives' : ''}">
      <div class="label">${label}${unit ? `, ${unit}` : ''}</div>
      <div class="value">${fmt(v, d)}</div>
      ${at ? `<div class="when">${when(at)}</div>` : ''}
    </div>`).join('');
  $('stats').onclick = e => {
    const tile = e.target.closest('.link-stat');
    if (tile) select(+tile.dataset.i);
  };

  $('period').innerHTML = periods.map((p, i) => `<option value="${i}">${periodTitle(p)}</option>`).join('');
  $('period').onchange = e => select(+e.target.value);

  const multi = new Set(periods.map(p => p.date + p.area)).size > 1;
  $('rows').innerHTML = periods.map((p, i) => `
    <tr data-i="${i}">
      <td>${p.date}</td><td>${p.area}</td><td>${p.hour}</td><td>${periodLabel(p)}</td>
      <td class="num"><strong>${fmt(p.price)}</strong>${p.note ? `<span class="note" title="${p.note}">*</span>` : ''}</td>
      <td class="num">${fmt(p.volume, 1)}</td>
    </tr>`).join('');
  $('rows').onclick = e => {
    const tr = e.target.closest('tr');
    if (tr) select(+tr.dataset.i);
  };

  drawProfile(multi);
  select(state.selected);
}

function select(i) {
  state.selected = i;
  document.querySelectorAll('#rows tr').forEach(tr => tr.classList.toggle('sel', +tr.dataset.i === i));
  document.querySelectorAll('#profile .bar').forEach(b => b.classList.toggle('sel', +b.dataset.i === i));
  const p = state.periods[i];
  $('period').value = String(i);
  drawCurves(p);
}
$('zoom').onchange = () => drawCurves(state.periods[state.selected]);
window.addEventListener('resize', () => { if (state.periods.length) { drawProfile(); drawCurves(state.periods[state.selected]); } });

$('download').onclick = () => {
  const head = 'DeliveryDateCET,Area,HourIndex_1_25,StartTimeUTC,PeriodCET,ClearingPrice_EUR_MWh,ClearedVolume_MWh,Note';
  const lines = state.periods.map(p => [p.date, p.area, p.hour, p.startUtc, periodLabel(p),
    p.price?.toFixed(2) ?? '', p.volume?.toFixed(3) ?? '', p.note ? `"${p.note}"` : ''].join(','));
  const blob = new Blob([[head, ...lines].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = state.fileName.replace(/\.csv$/i, '') + '_kainos.csv';
  a.click();
  URL.revokeObjectURL(a.href);
};

// ---------- charts (plain SVG) ----------
function el(name, attrs = {}, parent) {
  const n = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

function niceTicks(min, max, count = 5) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0);
  const ticks = [];
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) ticks.push(+t.toFixed(10));
  return ticks;
}

function frame(container, m) {
  container.innerHTML = '';
  const W = container.clientWidth, H = container.clientHeight;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}` }, container);
  return { svg, W, H, iw: W - m.l - m.r, ih: H - m.t - m.b };
}

function drawProfile() {
  const c = $('profile');
  const m = { l: 48, r: 8, t: 10, b: 28 };
  const { svg, iw, ih } = frame(c, m);
  const ps = state.periods;
  const vals = ps.map(p => p.price ?? 0);
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals) || 1;
  const ticks = niceTicks(lo, hi, 4);
  const y0 = Math.min(lo, ticks[0]), y1 = Math.max(hi, ticks.at(-1));
  const y = v => m.t + ih - (v - y0) / (y1 - y0) * ih;
  const bw = iw / ps.length;

  for (const t of ticks) {
    el('line', { class: 'gridline', x1: m.l, x2: m.l + iw, y1: y(t), y2: y(t) }, svg);
    el('text', { x: m.l - 6, y: y(t) + 4, 'text-anchor': 'end' }, svg).textContent = fmt(t, t % 1 ? 1 : 0);
  }
  ps.forEach((p, i) => {
    const v = p.price ?? 0;
    const r = el('rect', {
      class: 'bar', 'data-i': i,
      x: m.l + i * bw + bw * .12, width: Math.max(1, bw * .76),
      y: Math.min(y(v), y(0)), height: Math.max(1, Math.abs(y(v) - y(0))),
    }, svg);
    el('title', {}, r).textContent = `${p.date}, ${p.hour} valanda (${periodLabel(p)}): ${fmt(p.price)} EUR/MWh`;
    r.onclick = () => select(i);
    const every = Math.ceil(ps.length / Math.max(1, Math.floor(iw / 28)));
    if (i % every === 0) el('text', { x: m.l + i * bw + bw / 2, y: m.t + ih + 18, 'text-anchor': 'middle' }, svg).textContent = p.hour;
  });
  el('line', { class: 'axis', x1: m.l, x2: m.l + iw, y1: y(0), y2: y(0) }, svg);
  document.querySelectorAll('#profile .bar').forEach(b => b.classList.toggle('sel', +b.dataset.i === state.selected));
}

function drawCurves(p) {
  const c = $('curves');
  const m = { l: 56, r: 12, t: 12, b: 36 };
  const { svg, iw, ih } = frame(c, m);
  const pts = [...p.supply, ...p.demand];

  let x0 = Math.min(...pts.map(r => r.qty)), x1 = Math.max(...pts.map(r => r.qty));
  let y0 = Math.min(...pts.map(r => r.price)), y1 = Math.max(...pts.map(r => r.price));
  if ($('zoom').checked && p.price != null) {
    const dx = Math.max((x1 - x0) * .15, 50);
    x0 = Math.max(x0, p.volume - dx); x1 = Math.min(x1, p.volume + dx);
    const dy = Math.max(Math.abs(p.price) * 1.5, 40);
    y0 = Math.max(y0, p.price - dy); y1 = Math.min(y1, p.price + dy);
  }
  const xt = niceTicks(x0, x1, 6), yt = niceTicks(y0, y1, 6);
  const x = v => m.l + (v - x0) / (x1 - x0 || 1) * iw;
  const y = v => m.t + ih - (v - y0) / (y1 - y0 || 1) * ih;

  for (const t of yt) {
    el('line', { class: 'gridline', x1: m.l, x2: m.l + iw, y1: y(t), y2: y(t) }, svg);
    el('text', { x: m.l - 6, y: y(t) + 4, 'text-anchor': 'end' }, svg).textContent = fmt(t, t % 1 ? 1 : 0);
  }
  for (const t of xt) {
    el('line', { class: 'gridline', y1: m.t, y2: m.t + ih, x1: x(t), x2: x(t) }, svg);
    el('text', { x: x(t), y: m.t + ih + 16, 'text-anchor': 'middle' }, svg).textContent = fmt(t, 0);
  }
  el('text', { x: m.l + iw / 2, y: m.t + ih + 32, 'text-anchor': 'middle' }, svg).textContent = 'MWh';
  el('text', { x: 12, y: m.t + ih / 2, 'text-anchor': 'middle', transform: `rotate(-90 12 ${m.t + ih / 2})` }, svg).textContent = 'EUR/MWh';

  const clipId = 'clip-curves';
  el('rect', { x: m.l, y: m.t, width: iw, height: ih }, el('clipPath', { id: clipId }, el('defs', {}, svg)));
  const g = el('g', { 'clip-path': `url(#${clipId})` }, svg);
  const path = rows => rows.map((r, i) => `${i ? 'L' : 'M'}${x(r.qty).toFixed(1)},${y(r.price).toFixed(1)}`).join('');
  el('path', { class: 'supply', d: path(p.supply) }, g);
  el('path', { class: 'demand', d: path(p.demand) }, g);

  if (p.price != null) {
    el('line', { class: 'pline', x1: m.l, x2: m.l + iw, y1: y(p.price), y2: y(p.price) }, g);
    el('circle', { class: 'pdot', cx: x(p.volume), cy: y(p.price), r: 5 }, g);
    const right = x(p.volume) > m.l + iw * .5;
    el('text', {
      class: 'plabel', x: x(p.volume) + (right ? -10 : 10), y: y(p.price) - 10,
      'text-anchor': right ? 'end' : 'start',
    }, svg).textContent = `${fmt(p.price)} EUR/MWh · ${fmt(p.volume, 1)} MWh`;
  }
}
