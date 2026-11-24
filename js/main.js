// Entry point: load state and data, wire events, render.

import * as S from './state.js';
import { renderLists, renderScenarioOptions, scenarioLabel } from './render.js';
import { enableDrag } from './drag.js';

const $ = (selector) => document.querySelector(selector);
const el = {
  setup: $('#setup'),
  scenario: $('#scenario'),
  scenarioTitle: $('#scenario-title'),
  dataError: $('#data-error'),
  characterForm: $('#character-form'),
  customForm: $('#custom-form'),
  restart: $('#restart'),
  newGame: $('#new-game'),
  board: $('#board'),
  lists: { active: $('#active'), inactive: $('#inactive') },
  template: $('#plate-template'),
  status: $('#status'),
};

let state = S.load(localStorage);
let data = null; // contents of data/scenarios.json
let focusAfterRender = null; // { id, action } to keep keyboard focus on a moved plate

const findScenario = (id) => data?.scenarios.find((s) => s.id === id) ?? null;

function announce(message) {
  el.status.textContent = message;
}

function render() {
  renderLists(state, el.lists, el.template);
  el.scenarioTitle.textContent = data ? scenarioLabel(findScenario(state.scenario)) : '';
  el.scenario.value = state.scenario ?? '';
  el.restart.disabled = !state.scenario;
  restoreFocus();
}

function restoreFocus() {
  if (!focusAfterRender) return;
  const { id, action } = focusAfterRender;
  focusAfterRender = null;
  const plate = document.querySelector(`.plate[data-id="${CSS.escape(id)}"]`);
  if (!plate) return;
  const preferred = plate.querySelector(`[data-action="${action}"]:not(:disabled)`);
  (preferred ?? plate.querySelector('button:not(:disabled)'))?.focus();
}

function update(next, message) {
  if (next === state) return;
  state = next;
  S.save(localStorage, state);
  render();
  if (message) announce(message);
}

function moveMessage(id) {
  const name = state.plates[id].name;
  const list = S.listOf(state, id);
  return list === 'active'
    ? `${name} moved to position ${state.active.indexOf(id) + 1} of ${state.active.length}.`
    : `${name} moved to inactive.`;
}

function move(id, list, index) {
  const next = S.movePlate(state, id, list, index);
  if (next === state) return;
  state = next;
  S.save(localStorage, state);
  render();
  announce(moveMessage(id));
}

// --- Plate buttons (event delegation) ----------------------------------------

el.board.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = button.closest('.plate').dataset.id;
  const action = button.dataset.action;
  const position = state.active.indexOf(id);
  focusAfterRender = { id, action };

  switch (action) {
    case 'up': return move(id, 'active', position - 1);
    case 'down': return move(id, 'active', position + 1);
    case 'deactivate': focusAfterRender = { id, action: 'activate' }; return move(id, 'inactive', 0);
    case 'activate': focusAfterRender = { id, action: 'deactivate' }; return move(id, 'active', state.active.length);
    case 'remove': {
      const name = state.plates[id].name;
      if (!confirm(`Remove ${name}?`)) return;
      return update(S.removePlate(state, id), `${name} removed.`);
    }
  }
});

enableDrag(el.board, move);

// --- Setup -------------------------------------------------------------------

function addFromForm(form, add) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = form.elements.name;
    const name = input.value.trim();
    if (!name) return;
    update(add(state, name), `${name} added to the initiative order.`);
    input.value = '';
    input.focus();
  });
}
addFromForm(el.characterForm, S.addCharacter);
addFromForm(el.customForm, S.addCustomMonster);

const hasMonsters = () => Object.values(state.plates).some((p) => p.kind === 'monster');

el.scenario.addEventListener('change', () => {
  const scenario = findScenario(el.scenario.value);
  if (hasMonsters() && !confirm('Switch scenario? The current monsters will be replaced.')) {
    el.scenario.value = state.scenario ?? '';
    return;
  }
  update(S.setScenario(state, scenario, data.monsters),
    scenario ? `${scenarioLabel(scenario)} selected. Its monsters are in the inactive area.` : 'Scenario cleared.');
});

el.restart.addEventListener('click', () => {
  if (!confirm('Restart the scenario? All monsters go back to inactive.')) return;
  update(S.setScenario(state, findScenario(state.scenario), data.monsters), 'Scenario restarted.');
});

el.newGame.addEventListener('click', () => {
  if (!confirm('Start a new game? This removes all characters and monsters.')) return;
  update(S.createState(), 'New game started.');
  el.setup.open = true;
});

// --- Start -------------------------------------------------------------------

async function loadData() {
  try {
    const response = await fetch('data/scenarios.json');
    if (!response.ok) throw new Error(response.statusText);
    data = await response.json();
    renderScenarioOptions(el.scenario, data.scenarios);
    el.scenario.disabled = false;
  } catch {
    el.scenario.replaceChildren(new Option('Scenarios unavailable', ''));
    el.dataError.hidden = false;
  }
  render();
}

el.setup.open = state.active.length + state.inactive.length === 0;
render();
loadData();

// Offline support. Skipped on localhost so development always gets fresh
// files; add ?sw to the URL to test it locally.
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
if ('serviceWorker' in navigator && (!isLocal || new URLSearchParams(location.search).has('sw'))) {
  navigator.serviceWorker.register('sw.js');
}
