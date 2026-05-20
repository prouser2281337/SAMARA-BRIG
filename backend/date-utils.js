/**
 * Все даты хранятся и передаются как wall-clock (YYYY-MM-DDTHH:mm:ss, без timezone).
 * PostgreSQL TIMESTAMP WITHOUT TIME ZONE хранит ровно те часы, которые вставлены.
 * parseLocalDateTime создаёт Date где wall-clock components = UTC components.
 * formatLocalDateTime читает UTC components как wall-clock.
 *
 * Это позволяет избежать timezone shifts между frontend (UTC+4 Самара) и backend (UTC).
 */
const pad = (n) => String(n).padStart(2, '0');

/**
 * Парсит строку YYYY-MM-DDTHH:mm(:ss)?(Z|+00:00)?
 * Возвращает Date в локальной зоне сервера, где wall-clock компоненты = переданным.
 * Пример: "2026-05-14T15:00:00" → new Date(2026,4,14,15,0,0) → getHours() === 15.
 */
function parseLocalDateTime(str) {
  if (!str) return null;
  const m = String(str).trim().match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/
  );
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const h = parseInt(m[4], 10);
  const min = parseInt(m[5], 10);
  const s = m[6] ? parseInt(m[6], 10) : 0;
  // Локальный конструктор — wall-clock время сохраняется в локальных getters
  return new Date(y, mo, d, h, min, s);
}

/**
 * Форматирует Date в строку YYYY-MM-DDTHH:mm:ss.
 * Использует локальные getters, т.к. Date от pg (TIMESTAMP WITHOUT TIME ZONE)
 * и Date от parseLocalDateTime оба хранят wall-clock в локальных компонентах.
 */
function formatLocalDateTime(date) {
  if (!date || isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${m}-${d}T${h}:${min}:${s}`;
}

/**
 * Форматирует Date в YYYY-MM-DD (wall-clock).
 */
function formatLocalDate(date) {
  if (!date || isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  return `${y}-${m}-${d}`;
}

module.exports = { parseLocalDateTime, formatLocalDateTime, formatLocalDate };
