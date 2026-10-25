'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');

test('sanitizeText removes markup, quotes and control characters', () => {
  assert.equal(C.sanitizeText('<script>alert(1)</script>Book DJ'), 'alert(1)Book DJ');
  assert.equal(C.sanitizeText('  a   "b"  \n c '), 'a b c');
  assert.equal(C.sanitizeText(null), '');
  assert.equal(C.sanitizeText('x'.repeat(200)).length, 80);
});

test('sanitizeText neutralises event-handler payloads', () => {
  const out = C.sanitizeText('<img src=x onerror=alert(1)>');
  assert.ok(!out.includes('<') && !out.includes('>'));
});

test('validateBudget accepts valid input and rejects bad input', () => {
  assert.deepEqual(C.validateBudget('300000'), { ok: true, value: 300000 });
  assert.equal(C.validateBudget('').ok, false);
  assert.equal(C.validateBudget('-5').ok, false);
  assert.equal(C.validateBudget('0').ok, false);
  assert.equal(C.validateBudget('abc').ok, false);
  assert.equal(C.validateBudget('1e12').ok, false);
});

test('validateAmount rejects negatives and blanks', () => {
  assert.equal(C.validateAmount('0').ok, true);
  assert.equal(C.validateAmount('-1').ok, false);
  assert.equal(C.validateAmount('').ok, false);
});

test('every split totals 100 and allocations total the budget exactly', () => {
  for (const type of Object.keys(C.SPLITS)) {
    assert.equal(C.SPLITS[type].reduce((a, b) => a + b, 0), 100);
    for (const total of [1, 7, 999, 300000, 1234567]) {
      assert.equal(C.suggestAllocation(total, type).reduce((a, b) => a + b, 0), total);
    }
  }
});

test('suggestAllocation throws on unknown type', () => {
  assert.throws(() => C.suggestAllocation(100, 'nope'), RangeError);
});

test('summarize reports remaining and over-budget', () => {
  assert.deepEqual(C.summarize(100, [50, 30]), { allocated: 80, remaining: 20, percents: [50, 30], over: false });
  assert.equal(C.summarize(100, [90, 30]).over, true);
  assert.deepEqual(C.summarize(0, [1]).percents, [0]);
});

test('progress computes percentage', () => {
  assert.deepEqual(C.progress([]), { done: 0, total: 0, percent: 0 });
  assert.equal(C.progress([{ d: true }, { d: false }]).percent, 50);
});

test('validateTask enforces length, sanitising and uniqueness', () => {
  assert.equal(C.validateTask('', []).ok, false);
  assert.equal(C.validateTask('ab', []).ok, false);
  assert.equal(C.validateTask('<b></b>', []).ok, false);
  assert.equal(C.validateTask('Book DJ', [{ t: 'book dj' }]).ok, false);
  assert.deepEqual(C.validateTask('Book DJ', []), { ok: true, value: 'Book DJ' });
});

test('formatINR uses Indian grouping and handles negatives and NaN', () => {
  assert.equal(C.formatINR(300000), '\u20B93,00,000');
  assert.equal(C.formatINR(-1500), '-\u20B91,500');
  assert.equal(C.formatINR(NaN), '\u20B90');
});

test('generateIdeas returns four cards for every combination', () => {
  for (const t of ['wedding', 'birthday', 'community']) {
    for (const v of ['elegant', 'rustic', 'modern', 'lowwaste']) {
      assert.equal(C.generateIdeas(t, v).length, 4);
    }
  }
  assert.throws(() => C.generateIdeas('x', 'y'), RangeError);
});
