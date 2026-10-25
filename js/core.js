/**
 * @file Pure, DOM-free business logic for the Event Planner.
 * Works in browsers (window.PlannerCore) and Node (module.exports) so it can be unit tested.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PlannerCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Percentage split per event type: [Venue & Food, Decor, Logistics, Contingency]. Each sums to 100. */
  const SPLITS = Object.freeze({
    wedding: [50, 20, 18, 12],
    birthday: [45, 25, 18, 12],
    community: [40, 20, 28, 12]
  });
  const MAX_BUDGET = 1e10;
  const MAX_TEXT = 80;

  /**
   * Strip markup and risky characters, collapse whitespace and cap the length.
   * @param {unknown} input
   * @param {number} [max]
   * @returns {string}
   */
  function sanitizeText(input, max = MAX_TEXT) {
    return String(input == null ? '' : input)
      .replace(/<[^>]*>/g, '')
      .replace(/[<>"'`&\\]/g, '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  }

  /**
   * Format a number as Indian-rupee text.
   * @param {number} n
   * @returns {string}
   */
  function formatINR(n) {
    const v = Number.isFinite(n) ? n : 0;
    return (v < 0 ? '-' : '') + '\u20B9' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(v));
  }

  /**
   * Validate a raw budget string.
   * @param {unknown} raw
   * @returns {{ok: boolean, value?: number, error?: string}}
   */
  function validateBudget(raw) {
    const text = String(raw == null ? '' : raw).trim();
    if (text === '') return { ok: false, error: 'Please enter a total budget.' };
    const value = Number(text);
    if (!Number.isFinite(value)) return { ok: false, error: 'Budget must be a valid number.' };
    if (value <= 0) return { ok: false, error: 'Budget must be greater than zero.' };
    if (value > MAX_BUDGET) return { ok: false, error: 'Budget is too large. Enter a smaller amount.' };
    return { ok: true, value: Math.round(value) };
  }

  /**
   * Validate a single allocation amount.
   * @param {unknown} raw
   * @returns {{ok: boolean, value?: number, error?: string}}
   */
  function validateAmount(raw) {
    const text = String(raw == null ? '' : raw).trim();
    const value = Number(text);
    if (text === '' || !Number.isFinite(value) || value < 0) {
      return { ok: false, error: 'Each allocation must be a number of zero or more.' };
    }
    return { ok: true, value: Math.round(value) };
  }

  /**
   * Suggest an allocation whose parts always add up exactly to the total.
   * @param {number} total
   * @param {string} type
   * @returns {number[]}
   */
  function suggestAllocation(total, type) {
    const split = SPLITS[type];
    if (!split) throw new RangeError('Unknown event type: ' + type);
    const amounts = split.map(p => Math.round((total * p) / 100));
    amounts[amounts.length - 1] += total - amounts.reduce((a, b) => a + b, 0);
    return amounts;
  }

  /**
   * Summarise allocations against the total budget.
   * @param {number} total
   * @param {number[]} amounts
   * @returns {{allocated: number, remaining: number, percents: number[], over: boolean}}
   */
  function summarize(total, amounts) {
    const allocated = amounts.reduce((a, b) => a + b, 0);
    return {
      allocated,
      remaining: total - allocated,
      percents: amounts.map(a => (total > 0 ? (a / total) * 100 : 0)),
      over: allocated > total
    };
  }

  /**
   * Completion statistics for a checklist.
   * @param {{d: boolean}[]} items
   * @returns {{done: number, total: number, percent: number}}
   */
  function progress(items) {
    const total = items.length;
    const done = items.filter(i => i.d).length;
    return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  /**
   * Validate and sanitise a new checklist entry.
   * @param {unknown} raw
   * @param {{t: string}[]} existing
   * @returns {{ok: boolean, value?: string, error?: string}}
   */
  function validateTask(raw, existing) {
    const value = sanitizeText(raw);
    if (!value) return { ok: false, error: 'Please enter some text. Markup and special characters are removed.' };
    if (value.length < 3) return { ok: false, error: 'Please enter at least 3 characters.' };
    if (existing.some(i => i.t.toLowerCase() === value.toLowerCase())) return { ok: false, error: 'That item already exists.' };
    return { ok: true, value };
  }

  const TYPES = Object.freeze({
    wedding: { noun: 'Wedding', acts: ['Handwritten vow booth', 'Live music for the first dance', 'Family story wall'], flow: 'ceremony space, cocktail lounge, dining hall, dance floor' },
    birthday: { noun: 'Birthday', acts: ['Memory lane photo corner', 'Signature cake moment', 'Group game round'], flow: 'welcome table, activity zone, dining area, cake stage' },
    community: { noun: 'Community Event', acts: ['Volunteer showcase stage', 'Local food and craft stalls', 'Open quiz hour'], flow: 'registration desk, stage, stall lane, rest and seating area' }
  });
  const VIBES = Object.freeze({
    elegant: { name: 'Golden Hour Elegance', look: 'ivory, gold and deep green with candlelight', decor: ['Floral centrepieces in brass vases', 'Warm string lights', 'Linen table runners'], tip: 'Use one statement entrance instead of many small accents.' },
    rustic: { name: 'Countryside Charm', look: 'earthy tones, wood and wildflowers', decor: ['Hay bale and bench seating', 'Mason jar lanterns', 'Chalkboard menus'], tip: 'Source wildflowers and wood from local growers.' },
    modern: { name: 'Neon Minimal', look: 'clean white, black and one bold accent colour', decor: ['LED backdrop with name display', 'Geometric balloon arch', 'QR code photo-sharing wall'], tip: 'Rent lighting rather than buying it.' },
    lowwaste: { name: 'Zero-Waste Celebration', look: 'natural fibres, potted plants and reusable props', decor: ['Potted plants as take-home favours', 'Cloth napkins and steel plates', 'Digital invitations'], tip: 'Add a compost and recycling station with a volunteer guide.' }
  });

  /**
   * Generate tailored concept cards for an event type and vibe.
   * @param {string} type
   * @param {string} vibe
   * @returns {{heading: string, text?: string, list?: string[]}[]}
   */
  function generateIdeas(type, vibe) {
    const t = TYPES[type];
    const v = VIBES[vibe];
    if (!t || !v) throw new RangeError('Unknown event type or vibe.');
    return [
      { heading: 'Concept: ' + v.name + ' ' + t.noun, text: 'Palette and mood: ' + v.look + '.' },
      { heading: 'Recommended activities', list: t.acts.slice() },
      { heading: 'Decor ideas', text: v.tip, list: v.decor.slice() },
      { heading: 'Layout theme', text: 'Flow the space as: ' + t.flow + '.' }
    ];
  }

  return { SPLITS, sanitizeText, formatINR, validateBudget, validateAmount, suggestAllocation, summarize, progress, validateTask, generateIdeas };
});
