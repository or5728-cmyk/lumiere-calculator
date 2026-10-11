// Runs the calculator's own logic, lifted straight out of index.html, against known cases.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./docs/index.html', import.meta.url), 'utf8');
const src = html.split('/*calc:start*/')[1].split('/*calc:end*/')[0];
const calc = new Function(src + '; return calc;')();

const counts = (a) => Object.fromEntries(calc(a).rows.map((r) => [r.key, r.n]));
const base = { guests: 50, kids: 0, time: 'evening', level: 'meal', salmon: false };

// 50 guests, evening, a filling meal: a typical real order (6 hot, 5 salads,
// 4 bread trays) plus the one extra hot dish and one extra tray.
assert.deepEqual(counts(base), { hot: 7, salad: 5, bread: 6, quiche: 3, cold: 4 });

// The extra hot dish and tray are added once to the whole order, not per 10 guests.
assert.equal(counts({ ...base, guests: 100 }).hot, 14);
assert.equal(counts({ ...base, guests: 100 }).bread, 10);

// A lighter spread asks for less, a lavish one for more.
assert.deepEqual(counts({ ...base, level: 'light' }), { hot: 5, salad: 3, bread: 4, quiche: 2, cold: 2 });
assert.deepEqual(counts({ ...base, level: 'lavish' }), { hot: 10, salad: 7, bread: 8, quiche: 4, cold: 6 });

// Morning never asks for more than evening.
const morning = counts({ ...base, time: 'morning' });
for (const k of Object.keys(morning)) assert.ok(morning[k] <= counts(base)[k], k);

// Kids: one pizza tray per 20 guests, at least one, and nothing else changes.
assert.equal(counts({ ...base, kids: 1 }).pizza, 3);
assert.equal(counts({ ...base, guests: 10, kids: 2 }).pizza, 1);
assert.equal(counts({ ...base, kids: 10 }).hot, counts(base).hot);
assert.equal(counts(base).pizza, undefined);

// Salmon: one fish per 20 guests, at least one, instead of part of the other food.
assert.equal(counts({ ...base, salmon: true }).fish, 3);
assert.equal(counts({ ...base, guests: 10, salmon: true }).fish, 1);
assert.ok(counts({ ...base, salmon: true }).hot <= counts(base).hot);
assert.equal(counts(base).fish, undefined);

// The taboon note appears only when kids are more than a third of the guests.
assert.equal(calc({ ...base, guests: 60, kids: 20 }).taboon, false);
assert.equal(calc({ ...base, guests: 60, kids: 21 }).taboon, true);

// The quote offer appears only from 40 guests up.
assert.equal(calc({ ...base, guests: 39 }).offer, false);
assert.equal(calc({ ...base, guests: 40 }).offer, true);

// The three fixed categories never drop out, even for a tiny event.
const tiny = counts({ ...base, guests: 1, level: 'light' });
assert.ok(tiny.hot >= 1 && tiny.salad >= 1 && tiny.bread >= 1);

console.log('calc: all cases pass');
for (const g of [20, 40, 50, 60, 80, 100, 150]) console.log(g, JSON.stringify(counts({ ...base, guests: g })));
