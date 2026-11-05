import test from 'node:test';
import assert from 'node:assert/strict';

import {
  chooseFocus,
  explainChoice,
  rankTasks,
  scoreOf,
  validateTasks,
} from '../assets/scoring.js';

const task = (name, impact, urgency) => ({ name, impact, urgency });

test('scoreOf суммирует влияние и срочность', () => {
  assert.equal(scoreOf(task('A', 5, 4)), 9);
  assert.equal(scoreOf(task('B', 1, 1)), 2);
});

test('chooseFocus выбирает задачу с наибольшей суммой', () => {
  const choice = chooseFocus([
    task('Релиз', 5, 4),
    task('Письмо', 2, 5),
    task('Ретро', 3, 3),
  ]);

  assert.equal(choice.winner.name, 'Релиз');
  assert.equal(choice.winner.score, 9);
  assert.equal(choice.gap, 2);
  assert.equal(choice.tieBreak, null);
});

test('при равном балле побеждает большая срочность', () => {
  const choice = chooseFocus([
    task('Важное, но не срочное', 5, 2),
    task('Горит, но мелкое', 2, 5),
    task('Середина', 3, 3),
  ]);

  assert.equal(choice.winner.name, 'Горит, но мелкое');
  assert.equal(choice.gap, 0);
  assert.equal(choice.tieBreak, 'urgency');
});

test('при полном совпадении побеждает задача, введённая раньше', () => {
  const choice = chooseFocus([
    task('Первая', 4, 3),
    task('Вторая', 4, 3),
    task('Третья', 1, 1),
  ]);

  assert.equal(choice.winner.name, 'Первая');
  assert.equal(choice.tieBreak, 'order');
});

test('rankTasks сортирует, не мутируя исходный массив', () => {
  const tasks = [task('A', 1, 1), task('B', 5, 5), task('C', 3, 3)];
  const ranked = rankTasks(tasks);

  assert.deepEqual(tasks.map((item) => item.name), ['A', 'B', 'C']);
  assert.deepEqual(ranked.map((item) => item.name), ['B', 'C', 'A']);
  assert.deepEqual(ranked.map((item) => item.index), [1, 2, 0]);
});

test('chooseFocus требует ровно три задачи', () => {
  assert.throws(() => chooseFocus([task('A', 1, 1)]), RangeError);
});

test('explainChoice объясняет победу по срочности', () => {
  const choice = chooseFocus([
    task('Важное', 5, 2),
    task('Срочное', 2, 5),
    task('Середина', 3, 3),
  ]);
  const reasons = explainChoice(choice).join(' ');

  assert.match(reasons, /7 из 10/);
  assert.match(reasons, /срочность ниже/);
  assert.match(reasons, /решает срочность/);
});

test('explainChoice называет отрыв от второй задачи', () => {
  const choice = chooseFocus([
    task('Релиз', 5, 4),
    task('Письмо', 2, 5),
    task('Ретро', 3, 3),
  ]);
  const reasons = explainChoice(choice).join(' ');

  assert.match(reasons, /Ближайшая альтернатива — «Письмо»/);
  assert.match(reasons, /отрыв 2 балла/);
});

test('validateTasks принимает корректную тройку', () => {
  const result = validateTasks([
    task('A', 1, 5),
    task('B', 3, 3),
    task('C', 5, 1),
  ]);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('validateTasks ловит пустое имя, пропуски и лишние задачи', () => {
  const missing = validateTasks([
    task('   ', 3, 3),
    task('B', Number.NaN, 3),
    task('C', 7, 3),
  ]);

  assert.equal(missing.ok, false);
  assert.equal(missing.errors.length, 3);
  assert.equal(missing.errors[0].field, 'name');
  assert.equal(missing.errors[1].field, 'impact');
  assert.equal(missing.errors[2].field, 'impact');

  const wrongCount = validateTasks([task('A', 1, 1)]);
  assert.equal(wrongCount.ok, false);
  assert.equal(wrongCount.errors[0].field, 'tasks');
});
