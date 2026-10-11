// The event questions shared by the calculator and the quote check: reading the
// answers, and marking what is still missing.
var Quiz = (function () {
  function $(id) { return document.getElementById(id); }

  function picked(form, name) {
    var c = form.querySelector('input[name="' + name + '"]:checked');
    return c ? c.value : null;
  }

  // A whole number typed into a field, or null when it is anything else.
  function whole(text) {
    text = text.trim();
    return /^\d+$/.test(text) ? parseInt(text, 10) : null;
  }

  // Returns { answers } when the event questions are filled in correctly, otherwise
  // { errors } keyed by the question that needs attention. A blank kids field means none.
  function readEvent(form) {
    var errors = {};
    var guests = whole($('guests').value);
    if (guests === null || guests < 1) errors.guests = 'כמה אורחים יהיו באירוע?';
    else if (guests > 2000) errors.guests = 'אפשר לחשב אירועים של עד 2,000 אורחים';

    var kids = $('kids').value.trim() === '' ? 0 : whole($('kids').value);
    if (kids === null) errors.kids = 'כמה ילדים? אם אין, אפשר להשאיר ריק';
    else if (guests !== null && kids > guests) errors.kids = 'מספר הילדים לא יכול להיות גדול ממספר האורחים';

    var time = picked(form, 'time'), level = picked(form, 'level');
    if (!time) errors.time = 'בחרי בוקר, צהריים או ערב';
    if (!level) errors.level = 'בחרי איזה אירוח מתאים לך';

    for (var key in errors) return { errors: errors };
    return { answers: { guests: guests, kids: kids, time: time, level: level } };
  }

  // Marks each question that still needs an answer, so it is plain what is missing.
  function showErrors(fields, errors) {
    fields.forEach(function (f) {
      var line = $(f + '-err');
      line.textContent = errors[f] ? '* ' + errors[f] : '';
      line.closest('.q').classList.toggle('missing', Boolean(errors[f]));
    });
  }

  function clearError(field) {
    var line = $(field + '-err');
    if (!line) return;
    line.textContent = '';
    line.closest('.q').classList.remove('missing');
  }

  // Brings the first question that needs attention into view.
  function goToFirst(fields, errors) {
    var first = fields.filter(function (f) { return errors[f]; })[0];
    var target = $(first) || $('q-' + first);
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (target.tagName === 'INPUT') target.focus({ preventScroll: true });
  }

  function el(tag, text, cls) {
    var n = document.createElement(tag);
    if (text != null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  }

  // The event in words, for the line under a result.
  function describe(a) {
    return {
      who: a.guests + ' אורחים' + (a.kids > 0 ? ', מתוכם ' + a.kids + ' ילדים' : ''),
      when: 'ב' + TIMES[a.time],
      level: LEVELS[a.level].name
    };
  }

  return { $: $, picked: picked, whole: whole, readEvent: readEvent, showErrors: showErrors,
    clearError: clearError, goToFirst: goToFirst, el: el, describe: describe };
})();
