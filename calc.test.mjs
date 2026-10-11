// Runs the very file the two pages load, docs/calc.js, against known cases.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PAGES, readPage, stamped } from './stamp.mjs';

const src = readFileSync(new URL('./docs/calc.js', import.meta.url), 'utf8');
const { calc, check, DISHES, LEVELS, QUOTE_DISHES, shownSize, bitesPerUnit, byFives } =
  new Function(src + '; return { calc, check, DISHES, LEVELS, QUOTE_DISHES, shownSize, bitesPerUnit, byFives };')();

const counts = (a) => Object.fromEntries(calc(a).rows.map((r) => [r.key, r.n]));
const base = { guests: 50, kids: 0, time: 'evening', level: 'meal', salmon: false };

// 50 guests, evening, a filling meal: a typical real order (6 hot, 5 salads,
// 4 bread trays) plus the one extra hot dish and one extra tray.
assert.deepEqual(counts(base), { hot: 7, salad: 5, bread: 6, breads: 1, quiche: 3, cold: 4 });

// Guests come in fives, always up: 36 to 39 guests get the food of 40, and 41 gets the
// food of 45. What depends on who is really coming does not round: 37 adults are not
// yet the 40 that bring breads with dips.
const food = (a) => { const { breads, ...rest } = counts(a); return rest; };
for (const guests of [36, 37, 38, 39]) assert.deepEqual(food({ ...base, guests }), food({ ...base, guests: 40 }), `${guests} guests`);
assert.deepEqual(food({ ...base, guests: 41 }), food({ ...base, guests: 45 }));
assert.equal(counts({ ...base, guests: 37 }).breads, undefined);
assert.equal(byFives(40), 40);
assert.equal(byFives(1), 5);

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

// Salmon: one fish per 20 adults, at least one. A kid counts as half an adult for the
// fish. A fish takes the place of sandwich trays only (about two thirds of a tray
// each); the hot dishes, salads and the rest of the list stay exactly as they were.
assert.deepEqual(counts({ ...base, salmon: true }), { hot: 7, salad: 5, bread: 4, breads: 1, quiche: 3, cold: 4, fish: 3 });
for (const k of ['hot', 'salad', 'quiche', 'cold']) assert.equal(counts({ ...base, guests: 100, salmon: true })[k], counts({ ...base, guests: 100 })[k], k);
assert.ok(counts({ ...base, guests: 100, salmon: true }).bread < counts({ ...base, guests: 100 }).bread);
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
  { hot: 14, salad: 7, bread: 6, quiche: 5, cold: 6, pizza: 5, fish: 3 });

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
const SIZE = { ...Object.fromEntries(Object.entries(DISHES).map(([k, d]) => [k, d.size])), breads: 0 };
const bites = (a) => calc(a).rows.reduce((sum, r) => sum + r.n * SIZE[r.key], 0);
for (const level of Object.keys(LEVELS)) {
  for (let guests = 1; guests <= 300; guests++) {
    for (const time of ['morning', 'noon', 'evening']) {
      const need = byFives(guests) * LEVELS[level].bites;
      for (const kids of [0, 1, Math.floor(guests / 2)]) {
        for (const salmon of [false, true]) {
          const a = { guests, kids: Math.min(kids, guests), time, level, salmon };
          assert.ok(bites(a) >= need, `too little food: ${JSON.stringify(a)} gives ${bites(a)}, needs ${need}`);
          if (time === 'morning') assert.ok(bites(a) <= bites({ ...a, time: 'evening' }), `morning bigger than evening: ${JSON.stringify(a)}`);
        }
      }
      if (guests >= 30) {
        const plain = { guests, kids: 0, time, level, salmon: false };
        assert.ok(bites(plain) <= byFives(guests) * LEVELS[level].top, `too much food: ${JSON.stringify(plain)} gives ${bites(plain)}`);
      }
    }
  }
}

// ---- The quote check ----
const event = (guests, level, extra = {}) => ({ guests, kids: 0, time: 'evening', level, ...extra });

// The two worked examples in the guide come out the way the guide says.
// 20 guests, light, offered 3 pastas, 3 salads and 3 sandwich trays: too much.
assert.equal(check(event(20, 'light'), { hot: 3, salad: 3, bread: 3 }).verdict, 'over');
// 40 guests, a filling meal, offered 4 pastas, 4 salads, 3 quiches and 6 trays: not enough.
const thin = check(event(40, 'meal'), { hot: 4, salad: 4, quiche: 3, bread: 6 });
assert.equal(thin.verdict, 'short');
// It would feed 37; she is told about 35, and about 5 left without. Guests come in fives.
assert.equal(thin.covers, 35);
assert.equal(thin.lacking, 5);
assert.deepEqual(thin.missing, { dishes: [{ key: 'cold', n: 1 }], more: 0 });

// An empty-handed quote is short, covers nobody, and is told what a table needs.
const nothing = check(event(50, 'meal'), {});
assert.equal(nothing.verdict, 'short');
assert.equal(nothing.covers, 0);
assert.ok(nothing.missing.dishes.length >= 3);

// Far more than the event needs reads as too much, with at least one dish to spare.
const lots = check(event(50, 'meal'), { hot: 14, salad: 10, bread: 12, quiche: 6, cold: 8 });
assert.equal(lots.verdict, 'over');
assert.ok(lots.spare >= 1);

// A fish in the quote is compared with a list that has fish in it, not held against her.
assert.ok(check(event(50, 'meal'), { hot: 7, salad: 5, bread: 4, quiche: 3, cold: 4, fish: 3 }).advised.fish >= 1);
assert.equal(check(event(50, 'meal'), { hot: 7, salad: 5, bread: 6, quiche: 3, cold: 4 }).advised.fish, undefined);

// Caterers do not all serve alike, so she can state her own caterer's sizes. A salad
// that feeds 12 makes the same quote cover more guests, one that feeds 8 covers fewer
// and the list asks for more salads. Left alone, a size is worth what it always was.
const offered = { hot: 8, salad: 8, bread: 8, quiche: 4, cold: 4 };
assert.equal(check(event(100, 'meal'), offered).covers, 70);
assert.equal(check(event(100, 'meal'), offered, { salad: 12 }).covers, 75);
assert.equal(check(event(100, 'meal'), offered, { salad: 8 }).covers, 65);
assert.equal(check(event(100, 'meal'), offered, { salad: 8 }).lacking, 35);
assert.ok(check(event(100, 'meal'), offered, { salad: 8 }).advised.salad > check(event(100, 'meal'), offered).advised.salad);
assert.deepEqual(check(event(100, 'meal'), offered, {}), check(event(100, 'meal'), offered));
// A quote one guest short of a 40-guest event is still told 35, never 40.
assert.equal(check(event(40, 'meal'), { hot: 4, salad: 4, bread: 6, quiche: 3 }, { salad: 12 }).covers, 35);
for (const key of QUOTE_DISHES) assert.equal(bitesPerUnit(key, shownSize(key)), DISHES[key].size, key);
// A pizza tray is shown as 24 pieces and counted as 20; a tray of 12 is worth half that.
assert.equal(shownSize('pizza'), 24);
assert.equal(bitesPerUnit('pizza', 12), 10);

// The two tools must agree. Whatever the calculator recommends for an event, the check
// calls enough: never short, never too much. And when a quote is short, the dishes named
// as missing really close the gap, without asking for more of a dish than was advised.
const sizeOf = (counts) => QUOTE_DISHES.reduce((sum, k) => sum + (counts[k] || 0) * DISHES[k].size, 0);
for (const level of Object.keys(LEVELS)) {
  for (let guests = 1; guests <= 300; guests++) {
    for (const time of ['morning', 'evening']) {
      for (const kids of [0, 1, Math.floor(guests / 2)]) {
        for (const salmon of [false, true]) {
          const a = { guests, kids: Math.min(kids, guests), time, level };
          const advised = Object.fromEntries(calc({ ...a, salmon }).rows.filter((r) => DISHES[r.key]).map((r) => [r.key, r.n]));
          assert.equal(check(a, advised).verdict, 'enough', `the tools disagree on ${JSON.stringify({ ...a, salmon })}`);
          // The same holds at any caterer's sizes: the list it recommends is itself enough.
          for (const scale of [0.6, 0.8, 1.3, 1.7]) {
            const sizes = Object.fromEntries(QUOTE_DISHES.map((k) => [k, Math.max(1, Math.round(DISHES[k].size * scale))]));
            const there = check(a, { fish: salmon ? 1 : 0 }, sizes).advised;
            assert.equal(check(a, there, sizes).verdict, 'enough', `the tools disagree at sizes x${scale} on ${JSON.stringify({ ...a, salmon })}`);
          }

          const half = Object.fromEntries(Object.entries(advised).map(([k, n]) => [k, Math.floor(n / 2)]));
          const r = check(a, half);
          if (r.verdict !== 'short') continue;
          const gap = byFives(guests) * LEVELS[level].bites - sizeOf(half);
          const named = Object.fromEntries(r.missing.dishes.map((d) => [d.key, d.n]));
          assert.ok(sizeOf(named) + r.missing.more * 11.5 >= gap, `missing dishes leave a gap: ${JSON.stringify(a)}`);
          for (const d of r.missing.dishes) assert.ok(d.n <= (r.advised[d.key] || 0) - (half[d.key] || 0), `asks for too much ${d.key}: ${JSON.stringify(a)}`);
          assert.ok(r.covers < guests && r.covers % 5 === 0, `covers ${r.covers} of ${guests}`);
          assert.ok(r.lacking >= 5 && r.lacking % 5 === 0, `lacking ${r.lacking} of ${guests}`);
        }
      }
    }
  }
}

// Each page asks for the shared files by the stamp of what they hold right now.
for (const page of PAGES) assert.equal(readPage(page), stamped(readPage(page)), `${page} has a stale stamp: run node stamp.mjs`);

console.log('calc: all cases pass');
for (const g of [20, 40, 50, 60, 80, 100, 150]) console.log(g, JSON.stringify(counts({ ...base, guests: g })));
for (const g of [20, 30, 50, 80, 100]) console.log('light', g, JSON.stringify(counts({ ...base, guests: g, level: 'light' })));
