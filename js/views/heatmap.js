// GitHub-style contribution grid. levelFn(dayKey) -> 0..4
import { today, addDays, parseDay, esc, weekdayNames } from '../util.js';
import { settings } from '../db.js';

export function heatmap(levelFn, { weeks = 20, legend = null, title = d => d, color = '', cls = '' } = {}) {
  const t = today();
  const ws = settings().weekStart;
  const dow = (parseDay(t).getDay() - ws + 7) % 7;
  const start = addDays(t, -(weeks - 1) * 7 - dow);
  const cols = [];
  const months = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const cells = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, w * 7 + i);
      if (i === 0) {
        const m = parseDay(d).getMonth();
        months.push(m !== lastMonth ? parseDay(d).toLocaleString(undefined, { month: 'short' }) : '');
        lastMonth = m;
      }
      if (d > t) { cells.push('<i class="hm-cell future"></i>'); continue; }
      const lv = levelFn(d);
      cells.push(`<i class="hm-cell lv-${lv} ${d === t ? 'today' : ''}" title="${esc(title(d))}"></i>`);
    }
    cols.push(`<div class="hm-col">${cells.join('')}</div>`);
  }
  const wd = weekdayNames(ws);
  return `<div class="heatmap ${cls}" style="${color ? `--hm:${color}` : ''}">
    <div class="hm-scroll"><div class="hm-inner">
      <div class="hm-months">${months.map(m => `<span>${m}</span>`).join('')}</div>
      <div class="hm-body"><div class="hm-days">${wd.map((n, i) => `<span>${i % 2 ? n : ''}</span>`).join('')}</div><div class="hm-grid">${cols.join('')}</div></div>
    </div></div>
    ${legend ? `<div class="hm-legend">${legend.map(([l, lv]) => `<span><i class="hm-cell lv-${lv}"></i>${esc(l)}</span>`).join('')}</div>` : ''}
  </div>`;
}
