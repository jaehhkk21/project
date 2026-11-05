export function randomIndex(limit) {
  const cap = Math.floor(4294967296 / limit) * limit;
  const buffer = new Uint32Array(1);
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= cap);
  return buffer[0] % limit;
}

export function drawNumbers(locked = [], pick = randomIndex) {
  if (locked.length > 6 || new Set(locked).size !== locked.length || locked.some(n => !Number.isInteger(n) || n < 1 || n > 45)) {
    throw new Error('고정 번호는 1~45 사이에서 최대 6개까지 선택할 수 있어요.');
  }
  const pool = Array.from({ length: 45 }, (_, i) => i + 1).filter(n => !locked.includes(n));
  const result = [...locked];
  while (result.length < 6) result.push(pool.splice(pick(pool.length), 1)[0]);
  return result.sort((a, b) => a - b);
}
