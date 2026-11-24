// Turns state into DOM. Full redraw of two short lists: simple and cheap.

import { LISTS } from './state.js';
import { findClass, iconUrl } from './classes.js';

const LABELS = {
  up: (name) => `Move ${name} up`,
  down: (name) => `Move ${name} down`,
  deactivate: (name) => `Move ${name} to inactive`,
  activate: (name) => `Move ${name} to initiative order`,
  remove: (name) => `Remove ${name}`,
};

function isRemovable(plate) {
  return plate.kind === 'character' || plate.custom === true;
}

function plateElement(template, plate, list, index, count) {
  const li = template.content.firstElementChild.cloneNode(true);
  li.dataset.id = plate.id;
  li.dataset.kind = plate.custom ? 'custom' : plate.kind;
  li.querySelector('.name').textContent = plate.name;
  if (plate.boss) li.querySelector('.badge').hidden = false;

  const cls = plate.kind === 'character' ? findClass(plate.name) : null;
  if (cls) {
    const icon = li.querySelector('.class-icon');
    const url = `url("${iconUrl(cls)}")`;
    icon.style.maskImage = url;
    icon.style.webkitMaskImage = url;
    icon.hidden = false;
  }

  const wanted = list === 'active'
    ? ['up', 'down', 'deactivate']
    : ['activate', ...(isRemovable(plate) ? ['remove'] : [])];

  for (const button of li.querySelectorAll('[data-action]')) {
    const action = button.dataset.action;
    if (!wanted.includes(action)) {
      button.remove();
      continue;
    }
    const label = LABELS[action](plate.name);
    button.setAttribute('aria-label', label);
    button.title = label;
    if ((action === 'up' && index === 0) || (action === 'down' && index === count - 1)) button.disabled = true;
  }
  return li;
}

/** @param lists { active: HTMLElement, inactive: HTMLElement } */
export function renderLists(state, lists, template) {
  for (const list of LISTS) {
    const ids = state[list];
    lists[list].replaceChildren(
      ...ids.map((id, i) => plateElement(template, state.plates[id], list, i, ids.length)),
    );
  }
}

export function renderScenarioOptions(select, scenarios) {
  const options = scenarios.map((s) => new Option(`${s.number}. ${s.name}`, s.id));
  select.replaceChildren(new Option('Choose a scenario…', ''), ...options);
}

export function scenarioLabel(scenario) {
  return scenario ? `#${scenario.number} ${scenario.name}` : 'No scenario selected';
}
