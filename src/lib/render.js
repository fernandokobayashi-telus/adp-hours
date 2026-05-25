import { formatDuration, formatTime } from './formatter.js';
import { TARGET_MS } from './calculator.js';

export function renderBanner(state, doc, existing) {
  const root = existing ?? doc.createElement('div');
  root.id = 'adp-hours-banner';
  root.className = 'adp-hours-banner';
  root.innerHTML = '';

  const line1 = doc.createElement('div');
  line1.className = 'adp-hours-line1';
  line1.textContent = `Trabalhado hoje: ${formatDuration(state.workedMs)}`;
  root.appendChild(line1);

  const line2 = doc.createElement('div');
  line2.className = 'adp-hours-line2';
  line2.textContent = line2Text(state);
  root.appendChild(line2);

  return root;
}

function line2Text(state) {
  if (state.punchCount === 0) return 'Sem batidas hoje';
  if (state.suggestions.returnAt) {
    return `Volte às ${formatTime(state.suggestions.returnAt)} · Saia às ${formatTime(state.suggestions.punchOutAt)} para 8h`;
  }
  if (state.suggestions.punchOutAt) {
    return `Saia às ${formatTime(state.suggestions.punchOutAt)} para 8h`;
  }
  if (state.isOverTarget) {
    return `✓ extras: ${formatDuration(state.workedMs - TARGET_MS)}`;
  }
  return `Faltam ${formatDuration(TARGET_MS - state.workedMs)}`;
}
