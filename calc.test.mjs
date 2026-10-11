// Runs the calculator's own logic, lifted straight out of index.html, against known cases.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./docs/index.html', import.meta.url), 'utf8');
const src = html.split('/*calc:start*/')[1].split('/*calc:end*/')[0];
const { calc, DISHES, LEVELS, PIZZA_SIZE, FISH_SIZE } =
  new Function(src + '; return { calc, DISHES, LEVELS, PIZZA_SIZE, FISH_SIZE };')();

const counts = (a) => Object.fromEntries(calc(a).rows.map((r) => [r.key, r.n]));
const base = { guests: 50, kids: 0, time: 'evening', level: 'meal', salmon: false };

// 50 guests, evening, a filling meal: a typical real order (6 hot, 5 salads,
// 4 bread trays) plus the one extra hot dish and one extra tray.
assert.deepEqual(counts(base), { hot: 7, salad: 5, bread: 6, breads: 1, quiche: 3, cold: 4 });

// The extra hot dish and tray are added once to the whole order, not per 10 guests.
assert.equal(counts({ ...base, guests: 100 }).hot, 14);
assert.equal(counts({ ...base, guests: 100 }).bread, 10);

// A lighter spread asks for less, a lavish one for more.
// A light spread has no hot dishes at all. Their share goes to pastries, and only the
// sandwich tray gets the extra one.
const light = counts({ ...base, level: 'light' });
assert.deepEqual(light, { salad: 3, bread: 4, pastry: 2, breads: 1, quiche: 2, cold: 2 });
assert.equal(light.hot, undefined);
for (const time of ['morning', 'noon', 'evening']) assert.equal(counts({ ...base, level: 'light', time }).hot, undefined, time);
assert.equal(counts(base).pastry, undefined);

// Breads with dips: exactly one, at any kind of hosting, once there are 40 adults.
// Kids do not count toward the 40, and it never changes the rest of the list.
assert.equal(counts({ ...base, guests: 40 }).breads, 1);
assert.equal(counts({ ...base, guests: 200 }).breads, 1);
assert.equal(counts({ ...base, guests: 39 }).breads, undefined);
assert.equal(counts({ ...base, guests: 50, kids: 11 }).breads, undefined);
assert.equal(counts({ ...base, guests: 50, kids: 10 }).breads, 1);
assert.equal(counts({ ...base, guests: 39 }).hot, 6);
assert.equal(counts({ ...base, guests: 40 }).hot, 6);
assert.deepEqual(counts({ ...base, level: 'lavish' }), { hot: 10, salad: 7, bread: 8, breads: 1, quiche: 4, cold: 6 });


// Kids: one pizza tray per 20 guests, at least one. A tray counts as 20 bites and
// takes the place of part of the other food, but never of the hot dishes: the kids
// eat those too.
assert.equal(counts({ ...base, kids: 1 }).pizza, 3);
assert.equal(counts({ ...base, guests: 10, kids: 2 }).pizza, 1);
assert.deepEqual(counts({ ...base, kids: 15 }), { hot: 7, salad: 3, bread: 4, quiche: 2, cold: 3, pizza: 3 });
assert.equal(counts({ ...base, kids: 15 }).hot, counts(base).hot);
assert.equal(counts(base).pizza, undefined);

// Salmon: one fish per 20 adults, at least one, instead of part of the other food.
// A kid counts as half an adult for the fish, and the hot dishes are never cut for it.
assert.equal(counts({ ...base, salmon: true }).fish, 3);
assert.equal(counts({ ...base, guests: 10, salmon: true }).fish, 1);
assert.equal(counts({ ...base, salmon: true }).hot, counts(base).hot);
assert.equal(counts({ ...base, guests: 100, kids: 63, salmon: true }).fish, 3);
assert.equal(counts({ ...base, guests: 100, salmon: true }).fish, 5);
assert.equal(counts({ ...base, guests: 30, kids: 30, salmon: true }).fish, 1);
assert.equal(counts(base).fish, undefined);

// The event that exposed it: 100 guests, 63 of them kids, a filling meal with salmon.
// The fish used to follow all 100 guests (5) while the hot dishes shrank to 9.
// The caterer's own answer for this event is 3 fish.
assert.deepEqual(counts({ guests: 100, kids: 63, time: 'noon', level: 'meal', salmon: true }),
  { hot: 14, salad: 6, bread: 7, quiche: 4, cold: 5, pizza: 5, fish: 3 });

// The taboon note appears only when kids are more than a third of the guests.
assert.equal(calc({ ...base, guests: 60, kids: 20 }).taboon, false);
assert.equal(calc({ ...base, guests: 60, kids: 21 }).taboon, true);

// The quote offer appears only from 40 guests up.
assert.equal(calc({ ...base, guests: 39 }).offer, false);
assert.equal(calc({ ...base, guests: 40 }).offer, true);

// The three fixed categories never drop out, even for a tiny event.
const tiny = counts({ ...base, guests: 1 });
assert.ok(tiny.hot >= 1 && tiny.salad >= 1 && tiny.bread >= 1);

// The promise of the guide, checked over every event size: the list never holds
// fewer bites than the bottom of the guide's range, whatever the answers are, at any
// time of day. It may only go over. (Breads with dips are extra and are not counted.)
// A morning list is never bigger than the evening one. Without kids or salmon, an
// event of 30 or more also stays under the top of the guide's range.
const SIZE = { ...Object.fromEntries(Object.entries(DISHES).map(([k, d]) => [k, d.size])), pizza: PIZZA_SIZE, fish: FISH_SIZE, breads: 0 };
const bites = (a) => calc(a).rows.reduce((sum, r) => sum + r.n * SIZE[r.key], 0);
const TOP = { light: 4, meal: 6, lavish: 9 };
for (const level of Object.keys(LEVELS)) {
  for (let guests = 1; guests <= 300; guests++) {
    for (const time of ['morning', 'noon', 'evening']) {
      const need = guests * LEVELS[level].bites;
      for (const kids of [0, 1, Math.floor(guests / 2)]) {
        for (const salmon of [false, true]) {
          const a = { guests, kids: Math.min(kids, guests), time, level, salmon };
          assert.ok(bites(a) >= need, `too little food: ${JSON.stringify(a)} gives ${bites(a)}, needs ${need}`);
          if (time === 'morning') assert.ok(bites(a) <= bites({ ...a, time: 'evening' }), `morning bigger than evening: ${JSON.stringify(a)}`);
        }
      }
      if (guests >= 30) {
        const plain = { guests, kids: 0, time, level, salmon: false };
        assert.ok(bites(plain) <= guests * TOP[level], `too much food: ${JSON.stringify(plain)} gives ${bites(plain)}`);
      }
    }
  }
}

console.log('calc: all cases pass');
for (const g of [20, 40, 50, 60, 80, 100, 150]) console.log(g, JSON.stringify(counts({ ...base, guests: g })));
for (const g of [20, 30, 50, 80, 100]) console.log('light', g, JSON.stringify(counts({ ...base, guests: g, level: 'light' })));
