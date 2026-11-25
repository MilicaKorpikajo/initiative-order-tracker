// The turn lever: a wooden knob on a brass rail beside the initiative order.
// The knob sits beside the plate whose turn it is. Pull it down one notch to
// finish that turn, push it up to undo. Knows nothing about the app: it reads
// the state and calls onAdvance / onUndo.
//
// Stopping points are measured from the real nameplates after each render,
// and again whenever the list changes size (ResizeObserver), so the knob stays
// aligned with plates of any height, on any screen. No timers or loops: the
// knob only moves on pointer events and via one CSS transition.

import { nextInTurn, lastUndo } from './turns.js';

const ENGAGE = 0.6;      // share of the way to the next stop that counts as a pull
const END_TRAVEL = 44;   // px between the last plate and the end-of-round stop
const OVERSHOOT = 8;     // px the knob can be pulled past a stop, with resistance

export function createLever(root, list, { onAdvance, onUndo }) {
  const knob = root.querySelector('.lever-knob');
  const notches = root.querySelector('.lever-notches');
  let state = null;
  let y = null;       // knob centre, px from the top of the lever
  let pull = null;    // drag in progress
  let round = null;

  // --- Layout -----------------------------------------------------------

  function centreOf(id, top) {
    const plate = list.querySelector(`:scope > .plate[data-id="${CSS.escape(id)}"]`);
    if (!plate) return null;
    const r = plate.getBoundingClientRect();
    return r.top - top + r.height / 2;
  }

  function stops() {
    const top = root.getBoundingClientRect().top;
    const centres = state.active.map((id) => centreOf(id, top));
    return { top, centres, end: (centres.at(-1) ?? 0) + END_TRAVEL };
  }

  function layout({ animate = true } = {}) {
    if (!state || pull || document.body.classList.contains('is-dragging')) return;
    const { centres, end } = stops();

    // One notch per plate in the initiative order, plus the end-of-round notch.
    const wanted = centres.length ? centres.length + 1 : 0;
    while (notches.children.length < wanted) notches.append(document.createElement('span'));
    while (notches.children.length > wanted) notches.lastElementChild.remove();
    [...centres, end].forEach((c, i) => {
      if (i >= wanted) return;
      const notch = notches.children[i];
      notch.className = i === centres.length ? 'notch notch-end' : 'notch';
      notch.style.transform = `translateY(${c}px)`;
    });

    const index = state.active.indexOf(state.turn.current);
    root.classList.toggle('is-empty', index === -1);
    if (index === -1) {
      y = null;
      return;
    }
    moveKnob(centres[index], animate);
  }

  function moveKnob(to, animate) {
    const wasPlaced = y !== null;
    y = to;
    knob.classList.toggle('no-anim', !animate || !wasPlaced);
    knob.style.transform = `translateY(${to}px)`;
    if (!animate || !wasPlaced) {
      void knob.offsetWidth; // apply the jump before transitions come back on
      knob.classList.remove('no-anim');
    }
  }

  function update(next) {
    const wrapped = round !== null && next.round !== round;
    state = next;
    round = next.round;
    root.classList.toggle('is-returning', wrapped);
    layout();
    describe();
  }

  // Re-measure when the list or the plates change size (rotation, fonts, wrapping names).
  new ResizeObserver(() => layout({ animate: false })).observe(list);

  // --- Accessibility --------------------------------------------------

  function describe() {
    const { active, turn, plates } = state;
    const index = active.indexOf(turn.current);
    if (index === -1) {
      knob.setAttribute('aria-disabled', 'true');
      knob.tabIndex = -1;
      knob.setAttribute('aria-valuetext', 'No one in the initiative order');
      return;
    }
    knob.removeAttribute('aria-disabled');
    knob.tabIndex = 0;
    knob.setAttribute('aria-valuemin', '1');
    knob.setAttribute('aria-valuemax', String(active.length));
    knob.setAttribute('aria-valuenow', String(index + 1));
    knob.setAttribute('aria-valuetext',
      `Round ${state.round}: ${plates[turn.current].name}'s turn, ${index + 1} of ${active.length}`);
  }

  knob.addEventListener('keydown', (event) => {
    if (!state?.turn.current) return;
    const keys = { ArrowDown: onAdvance, ArrowRight: onAdvance, PageDown: onAdvance,
      ArrowUp: onUndo, ArrowLeft: onUndo, PageUp: onUndo };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    if (!event.repeat) action();
  });

  // --- Pulling the knob -----------------------------------------------

  // Past `max` the knob resists, then stops: one pull is one turn, however far you drag.
  const resist = (d, max) => (d <= max ? d : max + Math.min(OVERSHOOT, (d - max) * 0.25));

  knob.addEventListener('pointerdown', (event) => {
    if (pull || y === null || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    const { centres, end } = stops();
    const index = state.active.indexOf(state.turn.current);
    const next = nextInTurn(state);
    const down = (next ? centres[state.active.indexOf(next)] : end) - y;

    const entry = lastUndo(state);
    const prevAt = entry && !entry.done ? centres[state.active.indexOf(entry.id)] : null;
    const up = !entry ? 0 : prevAt !== null && prevAt < y ? y - prevAt : END_TRAVEL; // round undo: push past the top

    pull = { pointerId: event.pointerId, startY: event.clientY, down: Math.max(down, 24), up, dy: 0, index };
    try { knob.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
    knob.classList.add('is-pulling');
  });

  knob.addEventListener('pointermove', (event) => {
    if (!pull || event.pointerId !== pull.pointerId) return;
    const raw = event.clientY - pull.startY;
    const dy = raw >= 0 ? resist(raw, pull.down) : -resist(-raw, pull.up || 4);
    pull.dy = dy;
    knob.style.transform = `translateY(${y + dy}px)`;
    knob.classList.toggle('is-engaged', dy >= pull.down * ENGAGE || (pull.up > 0 && -dy >= pull.up * ENGAGE));
  });

  function release(commit) {
    if (!pull) return;
    const { dy, down, up, pointerId } = pull;
    pull = null;
    if (knob.hasPointerCapture(pointerId)) knob.releasePointerCapture(pointerId);
    knob.classList.remove('is-pulling', 'is-engaged');
    if (commit && dy >= down * ENGAGE) onAdvance();
    else if (commit && up > 0 && -dy >= up * ENGAGE) onUndo();
    else moveKnob(y, true); // not far enough: spring back, nothing changes
  }

  knob.addEventListener('pointerup', (event) => pull?.pointerId === event.pointerId && release(true));
  knob.addEventListener('pointercancel', () => release(false));
  knob.addEventListener('lostpointercapture', () => release(false));
  document.addEventListener('keydown', (event) => event.key === 'Escape' && release(false));

  return { update, layout };
}
