const { GARAGE, getRouteDuration, geocodeAddress } = require('../services/gis');

/**
 * Алгоритм автоматического планирования
 *
 * Принципы:
 * - Распределить заявки между бригадами, руководствуясь:
 *   1. Квалификация бригады должна соответствовать типу работ
 *   2. Желаемое время клиента (desired_datetime)
 *   3. Минимизация холостых пробегов (geocoding + 2GIS routing)
 *   4. Равномерная загрузка бригад
 */
async function autoPlan(pool, date, WORK_START = 9, WORK_END = 18) {
  // 1. Загрузить данные
  const [brigadesRes, requestsRes] = await Promise.all([
    pool.query(`SELECT * FROM brigades WHERE status = 'active' ORDER BY id`),
    pool.query(`
      SELECT * FROM requests
      WHERE status = 'new' AND assigned_brigade IS NULL
        AND desired_datetime::date = $1
      ORDER BY
        CASE priority
          WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4
        END,
        desired_datetime ASC
    `, [date]),
  ]);

  const brigades = brigadesRes.rows;
  const requests = requestsRes.rows;

  if (requests.length === 0) return { planned: 0, unplanned: 0, details: [] };
  if (brigades.length === 0) return { planned: 0, unplanned: 0, details: [] };

  // 2. Геокодировать адреса заявок если нужно
  for (const req of requests) {
    if (!req.coordinates) {
      const geo = await geocodeAddress(req.address);
      if (geo) {
        req.coordinates = { lat: geo.lat, lng: geo.lng };
        await pool.query(
          'UPDATE requests SET coordinates = $1 WHERE id = $2',
          [JSON.stringify(req.coordinates), req.id]
        );
      }
    } else if (typeof req.coordinates === 'string') {
      req.coordinates = JSON.parse(req.coordinates);
    }
  }

  // 3. Загрузить существующие назначения
  const existingRes = await pool.query(`
    SELECT brigade_id, start_time, end_time FROM assignments WHERE scheduled_date = $1
  `, [date]);
  const existing = existingRes.rows;

  // busySlots[brigadeId] = [{start, end, lat, lng, requestId}]
  const busySlots = {};
  for (const b of brigades) { busySlots[b.id] = []; }
  for (const e of existing) {
    if (!busySlots[e.brigade_id]) busySlots[e.brigade_id] = [];
    busySlots[e.brigade_id].push({
      start: new Date(e.start_time),
      end: new Date(e.end_time),
    });
  }

  // 4. Проверка квалификации
  const checkQualification = (workType, q) => {
    const w = workType.toLowerCase();
    const b = q.toLowerCase();
    if (b.includes('универсал')) return true;
    return (
      (w.includes('сантех') && b.includes('сантех')) ||
      (w.includes('электр') && b.includes('электр')) ||
      (w.includes('канализац') && b.includes('сантех')) ||
      (w.includes('счетчик') && b.includes('сантех')) ||
      (w.includes('розетк') && b.includes('электр')) ||
      (w.includes('смесител') && b.includes('сантех')) ||
      (w.includes('люстр') && b.includes('электр')) ||
      (w.includes('автомат') && b.includes('электр')) ||
      (w.includes('протечк') && b.includes('сантех'))
    );
  };

  // 5. Рассчитать время от гаража до каждого объекта (параллельно, партиями)
  const travelFromGarage = {};
  const batchSize = 5;
  const geoRequests = requests.filter((r) => r.coordinates);
  for (let i = 0; i < geoRequests.length; i += batchSize) {
    const batch = geoRequests.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (req) => {
        const d = await getRouteDuration(GARAGE, req.coordinates);
        return { id: req.id, duration: d.duration };
      })
    );
    for (const r of results) travelFromGarage[r.id] = r.duration;
  }

  // 6. Жадное назначение
  const planned = [];
  const unplanned = [];
  const { formatLocalDateTime } = require('../date-utils');

  for (const req of requests) {
    const desired = new Date(req.desired_datetime);
    const duration = req.planned_duration || 60;

    // Кандидаты-бригады
    const candidates = [];
    for (const b of brigades) {
      if (!checkQualification(req.work_type, b.qualification)) continue;

      // Проверить свободен ли слот [desired, desired + duration]
      const slots = busySlots[b.id] || [];
      const startT = new Date(desired);
      const endT = new Date(desired.getTime() + duration * 60000);
      const hasConflict = slots.some((s) => !(endT <= s.start || startT >= s.end));
      if (hasConflict) continue;

      // Score = веса: ближе к гаражу (меньше пробег), меньше загрузка
      const fromGarageSec = travelFromGarage[req.id] || 0;
      const brigadeLoad = slots.reduce((sum, s) => sum + (s.end - s.start) / 60000, 0);
      const score = fromGarageSec + brigadeLoad * 30; // 1 мин загрузки = 30 сек пробега

      candidates.push({ brigade: b, score, startT, endT });
    }

    if (candidates.length === 0) {
      unplanned.push({ requestId: req.id, reason: 'No suitable brigade / slot conflict' });
      continue;
    }

    // Выбрать лучшую (минимальный score)
    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0];

    // Расстояние от предыдущей точки или от гаража
    const prevSlots = busySlots[best.brigade.id] || [];
    let travelSec = 0;
    if (prevSlots.length > 0 && req.coordinates) {
      const last = prevSlots[prevSlots.length - 1];
      const fromCoords = last.coordinates || GARAGE;
      const dGeo = await getRouteDuration(fromCoords, req.coordinates);
      travelSec = dGeo.duration;
    } else {
      travelSec = travelFromGarage[req.id] || 0;
    }

    // INSERT assignment
    await pool.query(
      `INSERT INTO assignments (request_id, brigade_id, scheduled_date, start_time, end_time, travel_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.id,
        best.brigade.id,
        date,
        formatLocalDateTime(best.startT),
        formatLocalDateTime(best.endT),
        Math.ceil(travelSec / 60),
      ]
    );

    // Update request
    await pool.query(
      `UPDATE requests SET status = 'assigned', assigned_brigade = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [best.brigade.id, req.id]
    );

    // Занять слот
    busySlots[best.brigade.id].push({
      start: best.startT,
      end: best.endT,
      coordinates: req.coordinates,
    });

    planned.push({
      requestId: req.id,
      brigadeId: best.brigade.id,
      start: best.startT,
      end: best.endT,
      travelTimeMin: Math.ceil(travelSec / 60),
    });
  }

  return { planned: planned.length, unplanned: unplanned.length, details: { planned, unplanned } };
}

module.exports = { autoPlan };
