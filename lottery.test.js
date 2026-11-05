import test from 'node:test';
import assert from 'node:assert/strict';
import { drawNumbers, randomIndex } from './lottery.js';

test('추첨은 1~45 범위의 중복 없는 정렬된 6개 번호를 반환한다', () => {
  for (let i = 0; i < 1000; i++) {
    const numbers = drawNumbers();
    assert.equal(numbers.length, 6);
    assert.equal(new Set(numbers).size, 6);
    assert.ok(numbers.every(n => n >= 1 && n <= 45));
    assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b));
  }
});
test('고정 번호를 보존하고 6개 모두 고정할 수 있다', () => {
  const locked = [1, 23, 45];
  assert.ok(locked.every(n => drawNumbers(locked).includes(n)));
  assert.deepEqual(locked, [1, 23, 45]);
  assert.deepEqual(drawNumbers([45, 44, 43, 42, 41, 40]), [40, 41, 42, 43, 44, 45]);
});
test('중복·범위 초과·잘못된 고정 번호는 거절한다', () => {
  for (const locked of [[1, 1], [0], [46], [1.5], [1, 2, 3, 4, 5, 6, 7]]) assert.throws(() => drawNumbers(locked));
});
test('무작위 인덱스가 요청한 범위를 지킨다', () => {
  for (const limit of [1, 2, 6, 45]) {
    for (let i = 0; i < 100; i++) assert.ok(randomIndex(limit) < limit);
  }
});
