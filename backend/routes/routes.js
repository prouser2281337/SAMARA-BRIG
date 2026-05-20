const { GARAGE, getRouteDuration, getRouteGeometry, buildFullRoute } = require('../services/gis');

module.exports = async function (fastify, opts) {
  // Получить данные о маршрутах для диспетчера на дату
  fastify.get('/api/routes/:date', {
    onRequest: [fastify.authenticate],
    schema: {
      tags: ['Routes'],
      summary: 'Получить маршруты бригад',
      description: 'Возвращает маршруты всех бригад на указанную дату',
      params: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date', description: 'Дата в формате YYYY-MM-DD' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { date } = request.params;
      const { pool } = opts;

      // 1. Получить все назначения на дату
      // scheduled_date is timestamptz stored as UTC. When user passes YYYY-MM-DD,
      // compare using ::text to get local date representation
      const assignmentsRes = await pool.query(`
        SELECT a.*, r.address, r.work_type, r.client, r.phone, r.description, r.priority, r.planned_duration,
               (r.coordinates->>'lat')::numeric as lat,
               (r.coordinates->>'lng')::numeric as lng
        FROM assignments a
        JOIN requests r ON a.request_id = r.id
        WHERE a.scheduled_date::text >= $1 AND a.scheduled_date::text < ($1::date + interval '1 day')::text
        ORDER BY a.brigade_id, a.start_time
      `, [date]);

      const assignments = assignmentsRes.rows;
      if (assignments.length === 0) {
        return reply.send({ date, brigades: [] });
      }

      // 2. Сгруппировать по бригадам
      const perBrigade = {};
      for (const a of assignments) {
        if (!perBrigade[a.brigade_id]) {
          perBrigade[a.brigade_id] = [];
        }
        perBrigade[a.brigade_id].push(a);
      }

      // 3. Для каждой бригады построить маршрут
      const { formatLocalDateTime } = require('../date-utils');
      const brigadesResult = [];

      for (const [brigadeId, tasks] of Object.entries(perBrigade)) {
        // Сортировать по start_time
        tasks.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

        const points = tasks.map((t) => ({
          id: t.request_id,
          address: t.address,
          work_type: t.work_type,
          client: t.client,
          start_time: formatLocalDateTime(t.start_time),
          end_time: formatLocalDateTime(t.end_time),
          lat: t.lat ? parseFloat(t.lat) : null,
          lng: t.lng ? parseFloat(t.lng) : null,
        }));

        // Если координаты не сохранены в БД, геокодируем адреса
        for (const pt of points) {
          if (!pt.lat || !pt.lng) {
            const geo = await require('../services/gis').geocodeAddress(pt.address);
            if (geo) {
              pt.lat = geo.lat;
              pt.lng = geo.lng;
              // Сохранить координаты в БД
              await pool.query(
                'UPDATE requests SET coordinates = $1 WHERE id = $2',
                [JSON.stringify({ lat: geo.lat, lng: geo.lng }), pt.id]
              );
            }
          }
        }

        // Построить маршрут гараж → точки → гараж
        const routePoints = points.filter((p) => p.lat && p.lng).map((p) => ({
          lat: p.lat,
          lng: p.lng,
          name: `${p.client} — ${p.address}`,
          id: p.id,
        }));

        let legs = [];
        if (routePoints.length > 0) {
          legs = await buildFullRoute(routePoints);
        }

        // Получить бригаду
        const brigRes = await pool.query('SELECT id, name, qualification, color, car_model FROM brigades WHERE id = $1', [brigadeId]);
        const brigade = brigRes.rows[0];

        brigadesResult.push({
          brigade,
          points,
          legs,
          totalDuration: legs.reduce((sum, l) => sum + l.duration, 0),
          totalLength: legs.reduce((sum, l) => sum + l.length, 0),
        });
      }

      reply.send({ date, garage: GARAGE, brigades: brigadesResult });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to fetch routes' });
    }
  });

  // Геокодирование адреса
  fastify.get('/api/geocode', {
    onRequest: [fastify.authenticate],
    schema: {
      tags: ['GIS'],
      summary: 'Геокодирование адреса',
      description: 'Поиск координат по адресу через 2GIS API',
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Адрес для поиска' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { q } = request.query;
      if (!q) return reply.code(400).send({ error: 'Bad Request', message: 'q is required' });
      const result = await require('../services/gis').geocodeAddress(q);
      reply.send(result || { error: 'not found' });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Internal Server Error', message: 'Geocoding failed' });
    }
  });
};