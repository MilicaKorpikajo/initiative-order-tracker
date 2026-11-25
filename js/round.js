// The round counter: a brass porthole with a number wheel inside.
// Locked by default. When unlocked, drag the number up to raise it and down to
// lower it, one step per notch of movement, or use the arrow keys.
// Knows nothing about the app: it shows a number and calls onChange(round).

const STEP = 28; // px of vertical drag per round
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

export function createRoundCounter(root, { onChange }) {
  const dial = root.querySelector('.porthole-dial');
  const number = root.querySelector('.porthole-number');
  const lock = root.querySelector('.porthole-lock');
  let value = null;
  let locked = true;
  let drag = null;

  function show(round) {
    if (round === value) return;
    const direction = value === null ? 0 : Math.sign(round - value);
    value = round;
    number.textContent = String(round);
    dial.setAttribute('aria-valuenow', String(round));
    dial.setAttribute('aria-valuetext', `Round ${round}`);
    // Number wheel: the new number rolls in from below (up) or above (down).
    if (direction && !reducedMotion.matches) {
      number.animate(
        [{ transform: `translateY(${direction * 70}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 180, easing: 'cubic-bezier(.2,.9,.3,1.2)' },
      );
    }
  }

  function setLocked(next) {
    locked = next;
    root.classList.toggle('is-unlocked', !locked);
    dial.setAttribute('aria-readonly', String(locked));
    const label = locked ? 'Unlock the round counter' : 'Lock the round counter';
    lock.setAttribute('aria-label', label);
    lock.title = label;
    lock.querySelector('use').setAttribute('href', locked ? '#i-lock' : '#i-unlock');
  }

  lock.addEventListener('click', () => {
    setLocked(!locked);
    if (!locked) dial.focus();
  });

  dial.addEventListener('keydown', (event) => {
    const steps = { ArrowUp: 1, ArrowRight: 1, PageUp: 1, ArrowDown: -1, ArrowLeft: -1, PageDown: -1 }[event.key];
    if (!steps || locked) return;
    event.preventDefault();
    onChange(value + steps);
  });

  dial.addEventListener('pointerdown', (event) => {
    if (locked || drag || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    drag = { pointerId: event.pointerId, startY: event.clientY, start: value };
    try { dial.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
    root.classList.add('is-turning');
  });

  dial.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const steps = Math.trunc((drag.startY - event.clientY) / STEP); // up = more
    const target = Math.max(1, drag.start + steps);
    if (target !== value) onChange(target);
  });

  function end() {
    if (!drag) return;
    if (dial.hasPointerCapture(drag.pointerId)) dial.releasePointerCapture(drag.pointerId);
    drag = null;
    root.classList.remove('is-turning');
  }
  dial.addEventListener('pointerup', end);
  dial.addEventListener('pointercancel', end);
  dial.addEventListener('lostpointercapture', end);

  setLocked(true);
  return { show };
}
