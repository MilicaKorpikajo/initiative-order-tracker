// Pointer-based drag and drop for nameplates. Works with touch, mouse and pen.
// Knows nothing about the app: on drop it calls onDrop(id, list, index).
//
// Touch: drag by the grip handle, so the rest of the page scrolls normally.
// Mouse: drag anywhere on the plate except its buttons.
// Esc cancels a drag in progress.

const START_DISTANCE = 6; // px moved before a press becomes a drag
const EDGE = 56;          // px from the viewport edge where the page scrolls
const SCROLL_STEP = 14;

export function enableDrag(container, onDrop) {
  let drag = null;

  function onPointerDown(event) {
    if (drag || !event.isPrimary || event.button !== 0) return;
    const plate = event.target.closest('.plate');
    if (!plate || event.target.closest('button')) return;
    if (!event.target.closest('.grip') && event.pointerType !== 'mouse') return;

    event.preventDefault(); // no text selection or native drag
    drag = { plate, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, started: false };
    try {
      plate.setPointerCapture(event.pointerId);
    } catch {
      // Pointer already gone (e.g. lifted in the same frame): drag events still bubble to the container.
    }
  }

  function start() {
    const { plate } = drag;
    const rect = plate.getBoundingClientRect();
    const placeholder = document.createElement('li');
    placeholder.className = 'placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.style.height = `${rect.height}px`;
    plate.before(placeholder);

    Object.assign(plate.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px` });
    plate.classList.add('dragging');
    document.body.classList.add('is-dragging');
    Object.assign(drag, { started: true, placeholder });
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.started) {
      if (Math.hypot(dx, dy) < START_DISTANCE) return;
      start();
    }
    drag.plate.style.transform = `translate(${dx}px, ${dy}px)`;
    placePlaceholder(event.clientX, event.clientY);
    autoScroll(event.clientY);
  }

  // Put the placeholder where the plate would land. Only touches the DOM when that changes.
  function placePlaceholder(x, y) {
    const list = document.elementFromPoint(x, y)?.closest('[data-list]');
    if (!list || !container.contains(list)) return;
    const before = [...list.querySelectorAll(':scope > .plate:not(.dragging)')]
      .find((item) => {
        const r = item.getBoundingClientRect();
        return y < r.top + r.height / 2;
      }) ?? null;
    if (drag.placeholder.parentElement === list && nextPlate(drag.placeholder) === before) return;
    list.insertBefore(drag.placeholder, before);
  }

  function nextPlate(node) {
    let next = node.nextElementSibling;
    while (next && !next.matches('.plate:not(.dragging)')) next = next.nextElementSibling;
    return next;
  }

  // Scrolls only while the pointer moves near an edge: no timers or animation loops.
  function autoScroll(y) {
    if (y < EDGE) window.scrollBy(0, -SCROLL_STEP);
    else if (y > window.innerHeight - EDGE) window.scrollBy(0, SCROLL_STEP);
  }

  function finish(drop) {
    if (!drag) return;
    const { plate, placeholder, started, pointerId } = drag;
    drag = null;
    if (plate.hasPointerCapture(pointerId)) plate.releasePointerCapture(pointerId);
    if (!started) return;

    const list = placeholder.parentElement;
    const index = [...list.children]
      .filter((child) => child.matches('.plate:not(.dragging)'))
      .indexOf(nextPlate(placeholder));
    const position = index === -1 ? list.querySelectorAll(':scope > .plate:not(.dragging)').length : index;

    placeholder.remove();
    plate.classList.remove('dragging');
    plate.removeAttribute('style');
    document.body.classList.remove('is-dragging');
    if (drop) onDrop(plate.dataset.id, list.dataset.list, position);
  }

  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', (event) => drag?.pointerId === event.pointerId && finish(true));
  container.addEventListener('pointercancel', () => finish(false));
  container.addEventListener('lostpointercapture', () => finish(true));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drag?.started) finish(false);
  });
}
