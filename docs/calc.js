// The food arithmetic behind both pages: the calculator (what to order) and the
// quote check (is what I was offered enough). No page code in here, so it can be tested.

// How many "bites" one guest eats, per kind of hosting. The guide gives a range for
// each: `bites` is the bottom of it, which the calculator multiplies by, and `top` is
// the top of it.
var LEVELS = {
  light:  { name: 'כיבוד קל',      bites: 3, top: 4 },
  meal:   { name: 'ארוחה משביעה', bites: 5, top: 6 },
  lavish: { name: 'שולחן שופע',    bites: 7, top: 9 }
};
var TIMES = { morning: 'בוקר', noon: 'צהריים', evening: 'ערב' };
// Morning events eat a little less.
var MORNING_FACTOR = 0.95;
// Every kind of dish, how many bites one unit of it holds, and how to say "one of it"
// and "several of it". `ask` is the sentence around the number when someone states
// the size her own caterer gives. A pizza tray holds about 24 pieces (`pieces`); it is
// counted as 20 so the rest of a list is not cut too far.
var DISHES = {
  hot:    { size: 10, name: 'מנות חמות',                    cap: 'כל מנה מתאימה לכ-10 אורחים',     one: 'מנה חמה אחת',    many: 'מנות חמות',    ask: ['כל מנה מתאימה ל-', 'אורחים'] },
  salad:  { size: 10, name: 'סלטים',                        cap: 'כל סלט מתאים לכ-10 אורחים',      one: 'סלט אחד',        many: 'סלטים',        ask: ['כל סלט מתאים ל-', 'אורחים'] },
  bread:  { size: 14, name: 'כריכים / קרואסונים / טורטיות', cap: 'מגשים של 12-16 יחידות',          one: 'מגש כריכים אחד', many: 'מגשי כריכים',  ask: ['בכל מגש', 'יחידות'] },
  pastry: { size: 24, name: 'מאפים / בורקסים / פינגר פוד',  cap: 'מגשים של כ-24 יחידות',           one: 'מגש מאפים אחד',  many: 'מגשי מאפים',   ask: ['בכל מגש', 'יחידות'] },
  quiche: { size: 8,  name: 'קישים / פשטידות / קציצות',     cap: 'כל מנה מתאימה ל-8-10 אורחים',    one: 'קיש אחד',        many: 'קישים',        ask: ['כל מנה מתאימה ל-', 'אורחים'] },
  cold:   { size: 12, name: 'מנות קרות',                    cap: 'למשל פלטת גבינות, דגים נאים או אנטיפסטי. כל אחת מתאימה ל-12-15 אורחים', one: 'מנה קרה אחת', many: 'מנות קרות', ask: ['כל מנה מתאימה ל-', 'אורחים'] },
  pizza:  { size: 20, pieces: 24, name: 'פיצות / פוקאצ\'ות', cap: 'מגשים של כ-24 חתיכות',          one: 'מגש פיצות אחד',  many: 'מגשי פיצות',   ask: ['בכל מגש', 'חתיכות'] },
  fish:   { size: 15, name: 'דג סלמון',                     cap: 'כל דג מתאים ל-15-20 אורחים',     one: 'דג אחד',         many: 'דגים',         ask: ['כל דג מתאים ל-', 'אורחים'] }
};
// How the food is shared out. `extra` is added once to the whole order, not per guest.
// `keep` marks a dish that fish and pizzas never cut into. `swap` marks the dish a
// fish takes the place of: in real orders a fish on the table means fewer sandwich trays,
// while the hot dishes and salads stay as they were.
// A light spread has no hot dishes at all: their share goes to food you pick up by hand.
var MIXES = {
  full: [
    { key: 'hot',    share: 0.25, extra: 1, min: 1, keep: true },
    { key: 'salad',  share: 0.20, extra: 0, min: 1 },
    { key: 'bread',  share: 0.26, extra: 1, min: 1, swap: true },
    { key: 'quiche', share: 0.10, extra: 0, min: 0 },
    { key: 'cold',   share: 0.19, extra: 0, min: 0 }
  ],
  light: [
    { key: 'salad',  share: 0.18, extra: 0, min: 1 },
    { key: 'bread',  share: 0.28, extra: 1, min: 1, swap: true },
    { key: 'pastry', share: 0.30, extra: 0, min: 1 },
    { key: 'quiche', share: 0.10, extra: 0, min: 0 },
    { key: 'cold',   share: 0.14, extra: 0, min: 0 }
  ]
};
// One serving of breads with dips joins the table once there are this many adults.
var ADULTS_FOR_BREADS = 40;
var BREADS = { name: 'לחמים ומטבלים', cap: 'מגוון לחמים עם מטבלים לשולחן' };
var ADULTS_PER_FISH = 20;
// For the fish, a kid counts as half an adult.
var KID_SHARE_OF_FISH = 0.5;
// How much of the sandwich trays one fish takes the place of. In real orders a fish
// comes with about two thirds of a tray fewer, not a whole tray.
var FISH_REPLACES = 10;
var GUESTS_PER_PIZZA_TRAY = 20;
var TABOON_KIDS_SHARE = 1 / 3;
var OFFER_MIN_GUESTS = 40;

// Builds a list that spreads `total` bites over the dishes. `need` is the least the
// guests must get, the bottom of the guide's range: a list may go over it, never under.
function build(a, total, need) {
  var light = a.level === 'light';
  var adults = a.guests - a.kids;
  // Fish is mostly for the adults. Pizzas are for the kids, counted by the size of the event.
  var fish = a.salmon ? Math.max(1, Math.round((adults + a.kids * KID_SHARE_OF_FISH) / ADULTS_PER_FISH)) : 0;
  var pizza = a.kids > 0 ? Math.max(1, Math.round(a.guests / GUESTS_PER_PIZZA_TRAY)) : 0;
  var breads = adults >= ADULTS_FOR_BREADS ? 1 : 0;
  // Pizzas take the place of part of the other food, but never of the hot dishes:
  // those are what the kids eat too. A fish takes the place of sandwich trays.
  // Breads with dips come on top of everything.
  var mix = MIXES[light ? 'light' : 'full'];
  var kept = mix.reduce(function (sum, c) { return sum + (c.keep ? c.share : 0); }, 0);
  var pizzaBites = pizza * DISHES.pizza.size;
  var open = Math.max(0, total * (1 - kept) - pizzaBites) / (1 - kept);
  var have = pizzaBites + fish * DISHES.fish.size;
  var rows = mix.map(function (c) {
    var d = DISHES[c.key];
    var budget = (c.keep ? total : open) * c.share;
    if (c.swap) budget = Math.max(0, budget - fish * FISH_REPLACES);
    var ideal = budget / d.size;
    var n = Math.max(c.min, Math.round(ideal));
    have += (n + c.extra) * d.size;
    return { key: c.key, name: d.name, cap: d.cap, n: n + c.extra, size: d.size, short: ideal - n };
  });
  // Whole trays round unevenly and can leave the list under what the guests need.
  // Top it up with whichever dish was rounded down the most: better too much than too little.
  while (have < need) {
    var r = rows.reduce(function (a, b) { return b.short > a.short ? b : a; });
    r.n += 1;
    r.short -= 1;
    have += r.size;
  }
  rows = rows.map(function (r) { return { key: r.key, name: r.name, cap: r.cap, n: r.n }; });
  if (breads > 0) rows.splice(3, 0, { key: 'breads', name: BREADS.name, cap: BREADS.cap, n: breads });
  if (pizza > 0) rows.push({ key: 'pizza', name: DISHES.pizza.name, cap: DISHES.pizza.cap + ', בשביל הילדים', n: pizza });
  if (fish > 0) rows.push({ key: 'fish', name: DISHES.fish.name, cap: DISHES.fish.cap, n: fish });
  return { rows: rows.filter(function (r) { return r.n > 0; }), bites: have };
}

// What to order for an event.
function calc(a) {
  var need = a.guests * LEVELS[a.level].bites;
  var list = build(a, need, need);
  // A morning event eats a little less, so try a slightly smaller spread and keep it
  // only when it really comes out smaller. It still never goes under `need`.
  if (a.time === 'morning') {
    var smaller = build(a, need * MORNING_FACTOR, need);
    if (smaller.bites < list.bites) list = smaller;
  }
  return {
    rows: list.rows,
    taboon: a.kids > a.guests * TABOON_KIDS_SHARE,
    offer: a.guests >= OFFER_MIN_GUESTS
  };
}

// The dishes a quote is asked about, in the order they are asked.
var QUOTE_DISHES = ['hot', 'salad', 'bread', 'pastry', 'quiche', 'cold', 'pizza', 'fish'];
// Across real orders one dish or tray holds about this many bites, whatever it is.
var AVERAGE_DISH = 11.5;

// The number shown for a dish's size before anyone changes it, and what a number she
// typed there is worth in bites.
function shownSize(key) { return DISHES[key].pieces || DISHES[key].size; }
function bitesPerUnit(key, typed) { return typed * DISHES[key].size / shownSize(key); }

// Checks a quote someone already received against what the same event needs.
// `quote` maps a dish to how many of it the quote holds. `sizes` may give, for any
// dish, how many bites one unit of it holds at her caterer; otherwise the usual size
// is taken. Everything it returns is counted in her caterer's units. The verdict is
// 'short' (with how many guests the quote does cover and what would close the gap),
// 'enough', or 'over' (with about how many dishes could go).
function check(a, quote, sizes) {
  var level = LEVELS[a.level];
  var sizeOf = function (key) { return (sizes && sizes[key]) || DISHES[key].size; };
  var bitesOf = function (counts) {
    return QUOTE_DISHES.reduce(function (sum, key) { return sum + (counts[key] || 0) * sizeOf(key); }, 0);
  };
  var have = bitesOf(quote);
  var need = a.guests * level.bites;
  // What the calculator would order, restated in her caterer's units and never rounded down.
  var advised = {};
  calc({ guests: a.guests, kids: a.kids, time: a.time, level: a.level, salmon: (quote.fish || 0) > 0 })
    .rows.forEach(function (r) {
      if (DISHES[r.key]) advised[r.key] = Math.ceil(r.n * DISHES[r.key].size / sizeOf(r.key));
    });
  // The recommended list must never read as too much, so "plenty" is at least that.
  var plenty = Math.max(a.guests * level.top, bitesOf(advised));
  if (have < need) {
    return { verdict: 'short', covers: Math.floor(have / level.bites), missing: missingDishes(advised, quote, need - have, sizeOf), advised: advised };
  }
  if (have > plenty) {
    return { verdict: 'over', spare: Math.max(1, Math.round((have - plenty) / AVERAGE_DISH)), advised: advised };
  }
  return { verdict: 'enough', advised: advised };
}

// Which dishes would close a gap of `gap` bites: the ones the quote is furthest behind
// on first, and no more of each than it takes. `more` is what is still open after that,
// in dishes of no particular kind.
function missingDishes(advised, quote, gap, sizeOf) {
  var behind = QUOTE_DISHES.map(function (key) {
    return { key: key, n: (advised[key] || 0) - (quote[key] || 0) };
  }).filter(function (d) { return d.n > 0; }).sort(function (x, y) {
    return y.n * sizeOf(y.key) - x.n * sizeOf(x.key);
  });
  var dishes = [];
  behind.forEach(function (d) {
    if (gap <= 0) return;
    var size = sizeOf(d.key);
    var n = Math.min(d.n, Math.ceil(gap / size));
    dishes.push({ key: d.key, n: n });
    gap -= n * size;
  });
  return { dishes: dishes, more: gap > 0 ? Math.ceil(gap / AVERAGE_DISH) : 0 };
}
