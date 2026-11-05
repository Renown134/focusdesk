import {
  SCALE_MAX,
  SCALE_MIN,
  TASKS_REQUIRED,
  chooseFocus,
  explainChoice,
  scoreOf,
  validateTasks,
} from './scoring.js';

const form = document.querySelector('#focus-form');
const tasksRoot = document.querySelector('#tasks');
const errorBox = document.querySelector('#form-error');
const resultRoot = document.querySelector('#result');

const TASK_NUMERALS = ['01', '02', '03'];
const TASK_PLACEHOLDERS = [
  'Например: согласовать скоуп релиза',
  'Например: разобрать метрики онбординга',
  'Например: ответить на письмо стейкхолдера',
];
const SCALE_VALUES = Array.from(
  { length: SCALE_MAX - SCALE_MIN + 1 },
  (_, i) => SCALE_MIN + i,
);

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function segments(kind, taskIndex) {
  return SCALE_VALUES.map((value) => `
    <label class="segment">
      <input type="radio" name="${kind}-${taskIndex}" value="${value}" id="${kind}-${taskIndex}-${value}">
      <span class="segment__face">${value}</span>
    </label>`).join('');
}

function taskMarkup(index) {
  const numeral = TASK_NUMERALS[index];
  const n = index + 1;
  return `
    <article class="task" data-index="${index}">
      <div class="task__top">
        <span class="task__index" aria-hidden="true">${numeral}</span>
        <div class="task__field">
          <label class="task__label" for="name-${index}">Задача ${n}</label>
          <input
            class="task__input"
            id="name-${index}"
            name="name-${index}"
            type="text"
            maxlength="120"
            autocomplete="off"
            placeholder="${TASK_PLACEHOLDERS[index]}"
          >
        </div>
        <output class="task__score" data-score="${index}" aria-hidden="true">—</output>
      </div>

      <div class="task__scales">
        <fieldset class="scale" data-kind="impact">
          <legend class="scale__legend">Влияние <span class="scale__hint">на результат</span></legend>
          <div class="segments">${segments('impact', index)}</div>
          <p class="scale__error" data-error="impact-${index}" hidden>Выберите оценку.</p>
        </fieldset>

        <fieldset class="scale" data-kind="urgency">
          <legend class="scale__legend">Срочность <span class="scale__hint">на сегодня</span></legend>
          <div class="segments">${segments('urgency', index)}</div>
          <p class="scale__error" data-error="urgency-${index}" hidden>Выберите оценку.</p>
        </fieldset>
      </div>
    </article>`;
}

tasksRoot.innerHTML = Array.from({ length: TASKS_REQUIRED }, (_, i) => taskMarkup(i)).join('');

function radioValue(kind, index) {
  const checked = form.querySelector(`input[name="${kind}-${index}"]:checked`);
  return checked ? Number(checked.value) : NaN;
}

function readTasks() {
  return Array.from({ length: TASKS_REQUIRED }, (_, index) => ({
    name: form.elements.namedItem(`name-${index}`).value.trim(),
    impact: radioValue('impact', index),
    urgency: radioValue('urgency', index),
  }));
}

function updateScores() {
  for (let index = 0; index < TASKS_REQUIRED; index += 1) {
    const chip = tasksRoot.querySelector(`[data-score="${index}"]`);
    const impact = radioValue('impact', index);
    const urgency = radioValue('urgency', index);
    const complete = Number.isInteger(impact) && Number.isInteger(urgency);
    chip.textContent = complete ? String(impact + urgency) : '—';
    chip.classList.toggle('is-filled', complete);
    chip.title = complete
      ? `Влияние ${impact} + срочность ${urgency} = ${impact + urgency} из 10`
      : 'Оценка появится, когда выбраны оба параметра';
  }
}

function clearErrors() {
  errorBox.hidden = true;
  errorBox.textContent = '';
  form.querySelectorAll('.is-invalid').forEach((el) => {
    el.classList.remove('is-invalid');
    el.removeAttribute('aria-invalid');
  });
  form.querySelectorAll('.scale__error').forEach((el) => {
    el.hidden = true;
  });
}

function fieldForError({ index, field }) {
  if (field === 'name') {
    return form.querySelector(`[name="name-${index}"]`);
  }
  if (field === 'impact' || field === 'urgency') {
    return form.querySelector(`.task[data-index="${index}"] .scale[data-kind="${field}"]`);
  }
  return null;
}

function showErrors(errors) {
  clearErrors();
  const first = errors[0];
  const where = Number.isInteger(first.index) ? `Задача ${first.index + 1}: ` : '';
  errorBox.textContent = `${where}${first.message}`;
  errorBox.hidden = false;

  for (const error of errors) {
    const field = fieldForError(error);
    if (!field) continue;
    field.classList.add('is-invalid');
    field.setAttribute('aria-invalid', 'true');
    if (error.field === 'impact' || error.field === 'urgency') {
      const note = form.querySelector(`[data-error="${error.field}-${error.index}"]`);
      if (note) {
        note.textContent = error.message;
        note.hidden = false;
      }
    }
  }

  const firstField = fieldForError(first);
  const focusTarget = firstField?.matches('input') ? firstField : firstField?.querySelector('input');
  focusTarget?.focus();
}

function metric(label, value) {
  const percent = (value / SCALE_MAX) * 100;
  return `
    <div class="metric">
      <div class="metric__head"><span>${label}</span><b>${value}/${SCALE_MAX}</b></div>
      <div class="meter"><span style="width:${percent}%"></span></div>
    </div>`;
}

function renderResult(choice) {
  const { winner, ranked, runnerUp, gap, tieBreak } = choice;
  const reasons = explainChoice(choice);
  const tieNote = tieBreak === 'urgency'
    ? '<p class="focus-card__tie">Решила срочность</p>'
    : tieBreak === 'order'
      ? '<p class="focus-card__tie">Решил порядок ввода</p>'
      : '';

  resultRoot.innerHTML = `
    <div class="focus-card">
      <p class="focus-card__eyebrow">Фокус на сегодня</p>
      <h2 class="focus-card__title" id="focus-title" tabindex="-1">${escapeHtml(winner.name)}</h2>
      <div class="focus-card__summary">
        <div class="focus-card__metrics">
          ${metric('Влияние', winner.impact)}
          ${metric('Срочность', winner.urgency)}
          ${tieNote}
        </div>
        <div class="score" aria-label="Итоговая оценка ${winner.score} из ${SCALE_MAX * 2}">
          <span class="score__value">${winner.score}</span>
          <span class="score__total">из ${SCALE_MAX * 2}</span>
        </div>
      </div>

      <h3 class="focus-card__subhead">Почему именно она</h3>
      <ul class="reasons">
        ${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}
      </ul>
    </div>

    <div class="ranking">
      <h3 class="ranking__title">Как распределились задачи</h3>
      <ol class="ranking__list">
        ${ranked.map((task, place) => `
          <li class="rank-row${task.index === winner.index ? ' is-winner' : ''}">
            <span class="rank-row__place" aria-hidden="true">${place + 1}</span>
            <span class="rank-row__name">${escapeHtml(task.name)}</span>
            <span class="rank-row__tags">В ${task.impact} · С ${task.urgency}</span>
            <span class="rank-row__score">${task.score}</span>
          </li>`).join('')}
      </ol>
      <p class="ranking__note">В — влияние, С — срочность. ${gap !== null && gap === 0
        ? 'Баллы лидеров равны, сработало правило равенства.'
        : 'Побеждает сумма баллов, при равенстве — большая срочность.'}</p>
    </div>

    <div class="result-actions">
      <button type="button" class="button button--ghost" data-action="edit">Изменить задачи</button>
      <button type="button" class="button button--quiet" data-action="reset">Начать заново</button>
    </div>`;

  resultRoot.hidden = false;
  requestAnimationFrame(() => resultRoot.classList.add('is-visible'));

  resultRoot.focus({ preventScroll: true });
  resultRoot.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideResult() {
  resultRoot.hidden = true;
  resultRoot.classList.remove('is-visible');
  resultRoot.innerHTML = '';
}

form.addEventListener('input', (event) => {
  if (event.target.closest('.task')) {
    updateScores();
    if (errorBox.hidden === false) clearErrors();
  }
});

form.addEventListener('change', (event) => {
  if (event.target.matches('input[type="radio"]')) {
    const scale = event.target.closest('.scale');
    scale?.classList.remove('is-invalid');
    scale?.removeAttribute('aria-invalid');
    const note = scale?.querySelector('.scale__error');
    if (note) note.hidden = true;
    updateScores();
    if (errorBox.hidden === false) clearErrors();
  }
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const tasks = readTasks();
  const { ok, errors } = validateTasks(tasks);

  if (!ok) {
    showErrors(errors);
    return;
  }

  clearErrors();
  hideResult();
  renderResult(chooseFocus(tasks));
});

resultRoot.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;

  if (action === 'edit') {
    hideResult();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    form.querySelector('input[type="text"]')?.focus({ preventScroll: true });
  }

  if (action === 'reset') {
    form.reset();
    hideResult();
    clearErrors();
    syncSegmentStates();
    updateScores();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    form.querySelector('input[type="text"]')?.focus({ preventScroll: true });
  }
});

// Отмечает выбранный сегмент для браузеров без :has().
function syncSegmentStates() {
  form.querySelectorAll('.segment').forEach((segment) => {
    segment.classList.toggle('is-checked', segment.querySelector('input').checked);
  });
}

form.addEventListener('change', syncSegmentStates);

syncSegmentStates();
updateScores();

// Экспорт для отладки в консоли — не влияет на работу интерфейса.
window.FocusDesk = { chooseFocus, explainChoice, scoreOf, validateTasks };
