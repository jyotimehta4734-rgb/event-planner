/**
 * @file DOM controller. All business rules live in core.js (PlannerCore) and are unit tested.
 * Every dynamic string is written with textContent, so user input can never become markup.
 */
(function () {
  'use strict';
  const C = window.PlannerCore;
  const $ = id => document.getElementById(id);

  const CATS = [
    ['Venue & Food', 'Pick off-peak dates and fixed per-plate packages.'],
    ['Decor', 'Rent reusable decor and use seasonal flowers.'],
    ['Logistics', 'Bundle sound, lights and transport with one vendor.'],
    ['Contingency', 'Keep untouched until 48 hours after the event.']
  ];

  /* ---------- Shared UI helpers ---------- */

  /** Create an element using textContent only (XSS-safe). */
  function el(tag, text, attrs) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    Object.keys(attrs || {}).forEach(k => node.setAttribute(k, attrs[k]));
    return node;
  }
  /** Announce a message to screen readers via the live status region. */
  function say(msg) { $('status').textContent = msg; }
  /** Show an accessible validation error and announce it. */
  function showError(id, msg) { const n = $(id); n.textContent = msg; n.hidden = false; say('Error: ' + msg); }
  function clearError(id) { $(id).hidden = true; }
  /** Run a handler; surface any unexpected exception as an on-screen alert. */
  function safely(errId, fn) {
    try { fn(); } catch (e) { showError(errId, 'Something went wrong. Please check your input and try again.'); }
  }

  /* ---------- 1. Budget calculator ---------- */
  const budget = { total: 0, type: 'wedding', amounts: [0, 0, 0, 0] };

  function updateTotals() {
    const s = C.summarize(budget.total, budget.amounts);
    s.percents.forEach((p, i) => { $('p' + i).textContent = p.toFixed(1) + '%'; });
    $('fa').textContent = C.formatINR(s.allocated);
    $('fp').textContent = (budget.total ? (s.allocated / budget.total) * 100 : 0).toFixed(1) + '%';
    $('fn').textContent = s.remaining === 0 ? 'Fully allocated' : s.over ? C.formatINR(-s.remaining) + ' over budget' : C.formatINR(s.remaining) + ' unallocated';
    $('st').textContent = C.formatINR(budget.total);
    $('sa').textContent = C.formatINR(s.allocated);
    $('sr').textContent = C.formatINR(s.remaining);
    $('rp').classList.toggle('bad', s.over);
    return s;
  }

  function renderBudget() {
    const body = $('bb');
    body.textContent = '';
    CATS.forEach((cat, i) => {
      const tr = el('tr');
      const td = el('td');
      const input = el('input', null, { type: 'number', min: '0', step: '1', 'data-i': i, 'aria-label': cat[0] + ' amount in rupees' });
      input.value = budget.amounts[i];
      td.append(input);
      tr.append(el('th', cat[0], { scope: 'row' }), td, el('td', '', { id: 'p' + i }), el('td', cat[1]));
      body.append(tr);
    });
    $('bo').hidden = false;
    updateTotals();
  }

  $('bf').addEventListener('submit', e => {
    e.preventDefault();
    safely('be', () => {
      const r = C.validateBudget($('bn').value);
      if (!r.ok) return showError('be', r.error);
      clearError('be');
      budget.total = r.value;
      budget.type = $('bt').value;
      budget.amounts = C.suggestAllocation(r.value, budget.type);
      renderBudget();
      say('Budget calculated: ' + C.formatINR(budget.total) + ' split across four categories.');
    });
  });

  $('bb').addEventListener('input', e => {
    safely('be', () => {
      const i = Number(e.target.dataset.i);
      if (!(i >= 0)) return;
      const r = C.validateAmount(e.target.value);
      if (!r.ok) return showError('be', r.error);
      clearError('be');
      budget.amounts[i] = r.value;
      const s = updateTotals();
      say(s.over ? 'Warning: allocations exceed the budget by ' + C.formatINR(-s.remaining) + '.' : 'Allocation updated. ' + C.formatINR(s.remaining) + ' remaining.');
    });
  });

  $('br').addEventListener('click', () => {
    safely('be', () => {
      if (!budget.total) return showError('be', 'Calculate a budget first, then reset the split.');
      clearError('be');
      budget.amounts = C.suggestAllocation(budget.total, budget.type);
      renderBudget();
      say('Allocations reset to the suggested split.');
    });
  });

  /* ---------- 2 & 3. Checklists (timeline and vendors share one component) ---------- */

  /**
   * Mount an interactive, phase-grouped checklist.
   * @param {{phases: string[], items: {t: string, p: number, d: boolean}[], noun: string, errId: string,
   *          grid: HTMLElement, bar: HTMLElement, text: HTMLElement, form: HTMLElement,
   *          input: HTMLInputElement, select: HTMLSelectElement}} cfg
   */
  function mountChecklist(cfg) {
    const { phases, items, noun, errId, grid, bar, text, form, input, select } = cfg;
    phases.forEach((p, i) => select.append(el('option', p, { value: i })));

    function render() {
      grid.textContent = '';
      phases.forEach((phase, pi) => {
        const card = el('div', null, { class: 'card', role: 'group', 'aria-label': phase });
        const list = el('ul');
        card.append(el('h3', phase), list);
        items.forEach((it, idx) => {
          if (it.p !== pi) return;
          const li = el('li');
          const label = el('label');
          const cb = el('input', null, { type: 'checkbox', 'data-i': idx, 'aria-label': noun + ': ' + it.t });
          cb.checked = it.d;
          label.append(cb, el('span', it.t, it.d ? { class: 'done' } : {}));
          li.append(label, el('button', 'Remove', { type: 'button', class: 'g x', 'data-del': idx, 'aria-label': 'Remove ' + it.t }));
          list.append(li);
        });
        if (!list.children.length) list.append(el('li', 'No items yet.'));
        grid.append(card);
      });
      const p = C.progress(items);
      bar.firstElementChild.style.width = p.percent + '%';
      bar.setAttribute('aria-valuenow', p.percent);
      text.textContent = p.done + ' of ' + p.total + ' complete (' + p.percent + '%)';
    }

    grid.addEventListener('change', e => safely(errId, () => {
      const item = items[Number(e.target.dataset.i)];
      if (!item) return;
      item.d = e.target.checked;
      render();
      say(item.t + (item.d ? ' marked complete. ' : ' marked incomplete. ') + text.textContent);
    }));

    grid.addEventListener('click', e => safely(errId, () => {
      const btn = e.target.closest('[data-del]');
      if (!btn) return;
      const removed = items.splice(Number(btn.dataset.del), 1)[0];
      render();
      say('Removed ' + removed.t + '. ' + text.textContent);
    }));

    form.addEventListener('submit', e => {
      e.preventDefault();
      safely(errId, () => {
        const r = C.validateTask(input.value, items);
        if (!r.ok) return showError(errId, r.error);
        clearError(errId);
        const phase = Number(select.value);
        items.push({ t: r.value, p: phase, d: false });
        input.value = '';
        render();
        say('Added ' + r.value + ' to ' + phases[phase] + '.');
        input.focus();
      });
    });
    render();
  }

  const seed = (p, names) => names.map(t => ({ t, p, d: false }));

  mountChecklist({
    phases: ['3 Months Out', '1 Month Out', 'Day-Of'], noun: 'Milestone', errId: 'te',
    items: [].concat(
      seed(0, ['Set date and guest list', 'Approve final budget', 'Book venue']),
      seed(1, ['Menu tasting', 'Send invitations', 'Confirm decor order']),
      seed(2, ['Vendor setup and AV check', 'Staff briefing', 'Settle vendor balances'])),
    grid: $('tg'), bar: $('tb'), text: $('tx'), form: $('tf'), input: $('ti'), select: $('tp')
  });

  mountChecklist({
    phases: ['Vetting', 'Contracting', 'Final Payment'], noun: 'Vendor task', errId: 've',
    items: [].concat(
      seed(0, ['Check venue capacity and insurance', 'Verify caterer food licence', 'Review vendor references']),
      seed(1, ['Sign written contracts', 'Confirm delivery windows', 'Agree cancellation terms']),
      seed(2, ['Pay balance against invoice', 'Collect receipts', 'Return deposits and rentals'])),
    grid: $('vg'), bar: $('vb'), text: $('vx'), form: $('vf'), input: $('vi'), select: $('vs')
  });

  /* ---------- 4. Idea generator ---------- */
  $('if').addEventListener('submit', e => {
    e.preventDefault();
    safely('ie', () => {
      const cards = C.generateIdeas($('it').value, $('iv').value);
      clearError('ie');
      const out = $('io');
      out.textContent = '';
      cards.forEach(c => {
        const card = el('div', null, { class: 'card idea' });
        card.append(el('h4', c.heading));
        if (c.text) card.append(el('p', c.text));
        if (c.list) {
          const ul = el('ul');
          c.list.forEach(x => ul.append(el('li', x)));
          card.append(ul);
        }
        out.append(card);
      });
      say('Generated ' + cards.length + ' idea cards.');
    });
  });
})();
