import { drawNumbers } from './lottery.js';

const $ = selector => document.querySelector(selector);
const storageKey = 'lucky-six-history-v1';
let games = 1;
let locked = [];
let busy = false;
let toastTimer;
let history = [];
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(saved)) history = saved.filter(item => item && Number.isFinite(item.time) && Array.isArray(item.numbers) && item.numbers.length === 6 && new Set(item.numbers).size === 6 && item.numbers.every(n => Number.isInteger(n) && n >= 1 && n <= 45)).slice(0, 30);
} catch { /* The app also works with browser storage disabled. */ }

function color(n) { return ['yellow', 'blue', 'red', 'gray', 'green'][Math.floor((n - 1) / 10)]; }
function ball(n, isLocked = false) {
  const el = document.createElement('span');
  el.className = `ball ${n ? color(n) : 'empty'}${isLocked ? ' locked' : ''}`;
  el.textContent = n || '–';
  if (isLocked) el.title = '고정한 번호';
  return el;
}
function balls(numbers, showLocks = false) {
  const el = document.createElement('div');
  el.className = 'balls';
  numbers.forEach(n => el.append(ball(n, showLocks && locked.includes(n))));
  return el;
}
function showResults(rows) {
  $('#results').replaceChildren();
  rows.forEach((numbers, index) => {
    const row = document.createElement('div');
    row.className = 'result-row';
    if (rows.length > 1) {
      const label = document.createElement('span');
      label.className = 'result-label';
      label.textContent = String.fromCharCode(65 + index);
      row.append(label);
    }
    row.append(balls(numbers, true));
    $('#results').append(row);
  });
  if (rows[0].every(n => !n)) {
    const caption = document.createElement('div');
    caption.className = 'draw-caption';
    caption.textContent = '당신을 기다리는 여섯 개의 행운';
    $('#results').append(caption);
  }
}
function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2500);
}
function saveHistory() {
  try { localStorage.setItem(storageKey, JSON.stringify(history)); }
  catch { toast('이 브라우저에서는 기록을 저장할 수 없어요.'); }
}
function renderHistory() {
  $('#history').replaceChildren();
  $('#history-count').textContent = history.length;
  $('#clear-history').disabled = history.length === 0;
  if (!history.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-history';
    empty.innerHTML = '<span>⌁</span>아직 추첨한 번호가 없어요. 첫 번째 행운을 뽑아보세요.';
    $('#history').append(empty);
  }
  history.forEach(item => {
    const row = document.createElement('div');
    row.className = 'history-entry';
    const meta = document.createElement('div');
    meta.className = 'history-meta';
    const title = document.createElement('strong');
    title.textContent = '행운의 조합';
    const date = new Date(item.time);
    meta.append(title, date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
    const copy = document.createElement('button');
    copy.className = 'copy-button';
    copy.textContent = '복사 ↗';
    copy.setAttribute('aria-label', `${item.numbers.join(', ')} 복사`);
    copy.addEventListener('click', async () => {
      const text = item.numbers.join(', ');
      try { await navigator.clipboard.writeText(text); toast('행운의 번호를 복사했어요.'); }
      catch {
        const input = document.createElement('textarea');
        input.value = text;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.append(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        toast(copied ? '행운의 번호를 복사했어요.' : `번호: ${text}`);
      }
    });
    row.append(meta, balls(item.numbers), copy);
    $('#history').append(row);
  });
}
function renderLocks() {
  $('#lock-count').textContent = `${locked.length} / 6`;
  document.querySelectorAll('.number-choice').forEach(button => {
    const selected = locked.includes(Number(button.textContent));
    button.setAttribute('aria-pressed', selected);
    button.disabled = busy || (!selected && locked.length === 6);
  });
  $('#locked-preview').replaceChildren(...locked.map(n => ball(n)));
}
for (let n = 1; n <= 45; n++) {
  const button = document.createElement('button');
  button.className = 'number-choice';
  button.textContent = n;
  button.setAttribute('aria-label', `${n}번 고정`);
  button.addEventListener('click', () => {
    if (busy) return;
    locked = locked.includes(n) ? locked.filter(value => value !== n) : [...locked, n].sort((a, b) => a - b);
    renderLocks();
  });
  $('#number-grid').append(button);
}
function updateCount(delta) {
  games = Math.max(1, Math.min(5, games + delta));
  $('#count').value = games;
  $('#decrease').disabled = busy || games === 1;
  $('#increase').disabled = busy || games === 5;
}
$('#decrease').addEventListener('click', () => updateCount(-1));
$('#increase').addEventListener('click', () => updateCount(1));
$('#lock-toggle').addEventListener('click', () => {
  const expanded = $('#lock-toggle').getAttribute('aria-expanded') !== 'true';
  $('#lock-toggle').setAttribute('aria-expanded', expanded);
  $('#lock-content').hidden = !expanded;
  $('#lock-chevron').textContent = expanded ? '−' : '+';
});
$('#clear-locks').addEventListener('click', () => { if (!busy) { locked = []; renderLocks(); } });
$('#draw').addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  $('#draw').disabled = true;
  $('#clear-locks').disabled = true;
  $('#results').setAttribute('aria-busy', 'true');
  updateCount(0);
  renderLocks();
  $('#draw-label').textContent = ' 행운을 고르는 중 ';
  $('#results').classList.add('drawing');
  try {
    const rows = Array.from({ length: games }, () => drawNumbers(locked));
    await new Promise(resolve => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 550));
    showResults(rows);
    const time = Date.now();
    history = [...rows.map(numbers => ({ numbers, time })), ...history].slice(0, 30);
    saveHistory();
    renderHistory();
  } catch { toast('번호를 뽑지 못했어요. 다시 시도해주세요.'); }
  finally {
    busy = false;
    $('#draw').disabled = false;
    $('#clear-locks').disabled = false;
    $('#draw-label').textContent = ' 행운의 번호 뽑기 ';
    $('#results').classList.remove('drawing');
    $('#results').setAttribute('aria-busy', 'false');
    updateCount(0);
    renderLocks();
  }
});
$('#clear-history').addEventListener('click', () => {
  history = [];
  saveHistory();
  renderHistory();
  toast('추첨 기록을 비웠어요.');
});
showResults([Array(6).fill(null)]);
renderHistory();
renderLocks();
updateCount(0);
