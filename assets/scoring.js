/**
 * Логика выбора фокуса для FocusDesk.
 *
 * Чистые функции без DOM: их же использует UI и проверяют тесты.
 *
 * Правила:
 *  - итоговая оценка задачи = влияние + срочность (1–5 каждая, итог 2–10);
 *  - при равной оценке выше стоит задача с большей срочностью;
 *  - если совпали и оценка, и срочность — побеждает задача, введённая раньше.
 */

export const SCALE_MIN = 1;
export const SCALE_MAX = 5;
export const TASKS_REQUIRED = 3;

/**
 * @typedef {Object} Task
 * @property {string} name
 * @property {number} impact  Влияние, 1–5
 * @property {number} urgency Срочность, 1–5
 */

/**
 * @typedef {Task & {index: number, score: number}} RankedTask
 */

/** Сумма влияния и срочности: от 2 до 10. */
export function scoreOf(task) {
  return task.impact + task.urgency;
}

function compareRanked(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  if (b.urgency !== a.urgency) return b.urgency - a.urgency;
  return a.index - b.index;
}

/**
 * Сортирует задачи по приоритету, не мутируя исходный массив.
 * @param {Task[]} tasks
 * @returns {RankedTask[]}
 */
export function rankTasks(tasks) {
  return tasks
    .map((task, index) => ({ ...task, index, score: scoreOf(task) }))
    .sort(compareRanked);
}

/**
 * Выбирает карточку фокуса и описывает, как принято решение.
 * @param {Task[]} tasks ровно три задачи
 */
export function chooseFocus(tasks) {
  if (!Array.isArray(tasks) || tasks.length !== TASKS_REQUIRED) {
    throw new RangeError(`Ожидалось ровно ${TASKS_REQUIRED} задачи.`);
  }
  const ranked = rankTasks(tasks);
  const [winner, runnerUp = null] = ranked;
  const gap = runnerUp ? winner.score - runnerUp.score : null;

  /** @type {'urgency' | 'order' | null} */
  let tieBreak = null;
  if (runnerUp && gap === 0) {
    tieBreak = winner.urgency > runnerUp.urgency ? 'urgency' : 'order';
  }

  return { ranked, winner, runnerUp, gap, tieBreak };
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function points(n) {
  return `${n} ${plural(n, 'балл', 'балла', 'баллов')}`;
}

function profileSentence({ impact, urgency }) {
  if (impact >= 4 && urgency >= 4) {
    return 'Высокое влияние и высокая срочность: задача двигает результат и не терпит отсрочки.';
  }
  if (impact >= 4 && urgency <= 2) {
    return 'Влияние заметно выше срочности: это важная работа, которая легко теряется в текучке.';
  }
  if (urgency >= 4 && impact <= 2) {
    return 'Срочность выше влияния: задачу нужно закрыть сегодня, но на результат недели она повлияет слабо.';
  }
  if (impact <= 2 && urgency <= 2) {
    return 'Обе оценки низкие: фокус достаётся этой задаче только потому, что остальные ещё легче отложить.';
  }
  return 'Сбалансированная ставка: влияние и срочность близки, без крайностей.';
}

/**
 * Объяснение выбора — короткие тезисы для карточки фокуса.
 * @returns {string[]}
 */
export function explainChoice({ winner, runnerUp, gap, tieBreak }) {
  const reasons = [
    `Итоговая оценка — ${winner.score} из 10: влияние ${winner.impact}/5, срочность ${winner.urgency}/5.`,
  ];

  if (!runnerUp) {
    return reasons;
  }

  if (gap > 0) {
    reasons.push(
      `Ближайшая альтернатива — «${runnerUp.name}»: ${points(runnerUp.score)}; отрыв ${gap} ${plural(gap, 'балл', 'балла', 'баллов')}.`,
    );
  } else if (tieBreak === 'urgency') {
    reasons.push(
      `У «${runnerUp.name}» столько же баллов, но срочность ниже: ${runnerUp.urgency} против ${winner.urgency}. При равенстве баллов решает срочность.`,
    );
  } else {
    reasons.push(
      `У «${runnerUp.name}» совпали и балл, и срочность — выбрана задача, которую вы ввели раньше.`,
    );
  }

  reasons.push(profileSentence(winner));
  return reasons;
}

/**
 * Проверяет форму: ровно три задачи, название и обе оценки.
 * @param {Task[]} tasks
 * @returns {{ok: boolean, errors: Array<{index: number|null, field: string, message: string}>}}
 */
export function validateTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length !== TASKS_REQUIRED) {
    return {
      ok: false,
      errors: [{ index: null, field: 'tasks', message: `Нужно ровно ${TASKS_REQUIRED} задачи.` }],
    };
  }

  const errors = [];
  tasks.forEach((task, index) => {
    const name = typeof task.name === 'string' ? task.name.trim() : '';
    if (!name) {
      errors.push({ index, field: 'name', message: 'Введите название задачи.' });
    } else if (name.length > 120) {
      errors.push({ index, field: 'name', message: 'Название длиннее 120 символов.' });
    }

    for (const field of ['impact', 'urgency']) {
      const value = task[field];
      if (!Number.isInteger(value) || value < SCALE_MIN || value > SCALE_MAX) {
        errors.push({ index, field, message: 'Выберите оценку от 1 до 5.' });
      }
    }
  });

  return { ok: errors.length === 0, errors };
}
