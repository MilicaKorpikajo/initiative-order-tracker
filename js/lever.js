// The turn lever: a wooden knob on a brass rail beside the initiative order.
// The knob sits beside the plate whose turn it is. Pull it down one notch to
// finish that turn, or further to finish several (the bottom notch ends the
// round); push it up to undo. The plates that will change are shown while you
// drag, so nothing happens by surprise. Knows nothing about the app: it reads
// the state and calls onAdvance(count) / onUndo(count).
//
// Stopping points are measured from the real nameplates after each render,
// and again whenever the list changes size (ResizeObserver), so the knob stays
// aligned with plates of any height, on any screen. No timers or loops: the
// knob only moves on pointer events and via one CSS transition.

import { remainingInTurn, undoPath } from './turns.js';

const ENGAGE = 0.6;      // share of the way to the next stop that counts as a pull
const END_TRAVEL = 44;   // px between the last plate and the end-of-round stop
const OVERSHOOT = 8;     // px the knob can be pulled past the last stop, with resistance
const DETENT = 8;        // px around each notch where the knob is drawn towards it

export function createLever(root, list, { onAdvance, onUndo }) {
  const knob = root.querySelector('.lever-knob');
  const notches = root.querySelector('.lever-notches');
  let state = null;
  let y = null;       // knob centre, px from the top of the lever
  let pull = null;    // drag in progress
  let round = null;
  let hover = null;   // stop plan while a mouse is over the rail

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
    hover = null;
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

  // Keyboard: arrows move one notch, End finishes the round, Home undoes back
  // to the start of this round.
  knob.addEventListener('keydown', (event) => {
    if (!state?.turn.current) return;
    const actions = {
      ArrowDown: () => onAdvance(1), ArrowRight: () => onAdvance(1), PageDown: () => onAdvance(1),
      ArrowUp: () => onUndo(1), ArrowLeft: () => onUndo(1), PageUp: () => onUndo(1),
      End: () => onAdvance(remainingInTurn(state).length + 1),
      Home: () => { const n = undoPath(state).findIndex((e) => e.done); onUndo(n === -1 ? undoPath(state).length : n); },
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    if (!event.repeat) action();
  });

  // --- Pulling the knob -----------------------------------------------

  // Past the last stop the knob resists, then stops.
  const resist = (d, max) => (d <= max ? d : max + Math.min(OVERSHOOT, (d - max) * 0.25));

  // How many stops a drag of `d` px has reached: each counts once the knob is
  // most of the way from the previous stop to it.
  function reached(d, distances) {
    let count = 0;
    let prev = 0;
    for (const stop of distances) {
      if (d < prev + (stop - prev) * ENGAGE) break;
      count++;
      prev = stop;
    }
    return count;
  }

  // Notches feel like notches: near one, the knob is drawn towards it.
  function detent(d, distances) {
    for (const stop of distances) if (Math.abs(d - stop) < DETENT) return stop + (d - stop) * 0.35;
    return d;
  }

  // Show which plates a release would change: dimmed (to finish) or lit (to reopen).
  let marked = [];
  function mark(ids, cls) {
    for (const el of marked) el.classList.remove('will-finish', 'will-reopen');
    marked = ids.map((id) => list.querySelector(`:scope > .plate[data-id="${CSS.escape(id)}"]`)).filter(Boolean);
    for (const el of marked) el.classList.add(cls);
  }

  // Where the knob can go from here: distances (px) to each stop below and
  // above it, and the plates that reaching each stop would finish or reopen.
  function plan() {
    const { centres, end } = stops();
    const at = (id) => centres[state.active.indexOf(id)];

    // Down: each plate still to act this round, then the end-of-round notch.
    const remaining = remainingInTurn(state);
    const down = [...remaining.map(at), end].map((c) => c - y);
    down[0] = Math.max(down[0], 24);
    const finishing = [state.turn.current, ...remaining];

    // Up: each earlier turn, as long as it sits higher on the rail. Undoing the
    // end of the last round (knob at the top) means pushing past the top.
    const up = [];
    const reopening = [];
    let last = y;
    for (const [i, entry] of undoPath(state).entries()) {
      if (entry.done) {
        if (i === 0) up.push(END_TRAVEL);
        break;
      }
      const c = at(entry.id);
      if (!(c < last)) break;
      up.push(y - c);
      reopening.push(entry.id);
      last = c;
    }
    return { down, up, finishing, reopening };
  }

  knob.addEventListener('pointerdown', (event) => {
    if (pull || y === null || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    pull = { pointerId: event.pointerId, startY: event.clientY, ...plan(), dy: 0, count: 0 };
    hover = null;
    try { knob.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
    knob.classList.add('is-pulling');
  });

  knob.addEventListener('pointermove', (event) => {
    if (!pull || event.pointerId !== pull.pointerId) return;
    const raw = event.clientY - pull.startY;
    const { down, up } = pull;
    let dy;
    let count;
    if (raw >= 0) {
      dy = detent(resist(raw, down.at(-1)), down);
      count = reached(raw, down);
    } else {
      dy = -detent(resist(-raw, up.at(-1) ?? 4), up);
      count = -reached(-raw, up);
    }
    pull.dy = dy;
    knob.style.transform = `translateY(${y + dy}px)`;
    if (count === pull.count) return;
    pull.count = count;
    knob.classList.toggle('is-engaged', count !== 0);
    if (count > 0) mark(pull.finishing.slice(0, count), 'will-finish');
    else mark(pull.reopening.slice(0, -count), 'will-reopen');
  });

  function release(commit) {
    if (!pull) return;
    const { count, pointerId } = pull;
    pull = null;
    if (knob.hasPointerCapture(pointerId)) knob.releasePointerCapture(pointerId);
    knob.classList.remove('is-pulling', 'is-engaged');
    mark([], '');
    if (commit && count > 0) onAdvance(count);
    else if (commit && count < 0) onUndo(-count);
    else moveKnob(y, true); // not far enough (or cancelled): spring back, nothing changes
  }

  // --- Mouse: click a notch to slide there -----------------------------
  // Only for a mouse: on touch screens a stray tap on the rail must not end turns.

  // How many turns a click at clientY means: the nearest stop, + down / - up.
  function clickTarget(clientY) {
    hover ??= plan();
    const d = clientY - root.getBoundingClientRect().top - y;
    const options = [0, ...(d >= 0 ? hover.down : hover.up)];
    const dist = Math.abs(d);
    let best = 0;
    options.forEach((stop, i) => { if (Math.abs(dist - stop) < Math.abs(dist - options[best])) best = i; });
    return d >= 0 ? best : -best;
  }

  function preview(count) {
    if (count > 0) mark(hover.finishing.slice(0, count), 'will-finish');
    else mark(hover.reopening.slice(0, -count), 'will-reopen');
  }

  root.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || pull || y === null || event.target.closest('.lever-knob')) return;
    preview(clickTarget(event.clientY));
  });

  root.addEventListener('pointerleave', () => {
    hover = null;
    if (!pull) mark([], '');
  });

  root.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || pull || y === null || event.target.closest('.lever-knob')) return;
    event.preventDefault();
    const count = clickTarget(event.clientY);
    hover = null;
    mark([], '');
    if (count > 0) onAdvance(count);
    else if (count < 0) onUndo(-count);
  });

  knob.addEventListener('pointerup', (event) => pull?.pointerId === event.pointerId && release(true));
  knob.addEventListener('pointercancel', () => release(false));
  knob.addEventListener('lostpointercapture', () => release(false));
  document.addEventListener('keydown', (event) => event.key === 'Escape' && release(false));

  return { update, layout };
}
