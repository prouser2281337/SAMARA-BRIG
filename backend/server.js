const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const jwt = require('@fastify/jwt');
const bcrypt = require('bcryptjs');
const { pool } = require('./db');
const { initDB } = require('./init-db');
const { parseLocalDateTime, formatLocalDateTime, formatLocalDate } = require('./date-utils');
require('dotenv').config();

// Register plugins
fastify.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length'],
  maxAge: 86400
});

fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
});

// JWT verification hook
fastify.decorate('authenticate', async function(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
});

// Health check
fastify.get('/api/health', {
  schema: {
    tags: ['Health'],
    summary: 'Health Check',
    description: 'Проверка работоспособности сервера',
    response: {
      200: {
        description: 'Сервер работает',
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    }
  }
}, async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Get dashboard stats
fastify.get('/api/dashboard/stats', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [brigadesRes, requestsRes, todayAssignmentsRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'on_route') as on_route,
          COUNT(*) FILTER (WHERE status = 'inactive') as inactive
        FROM brigades
      `),
      pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'new') as new,
          COUNT(*) FILTER (WHERE status = 'assigned') as assigned,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE priority = 'urgent' AND status != 'completed') as urgent
        FROM requests
      `),
      pool.query(`SELECT COUNT(*) as count FROM assignments WHERE scheduled_date = $1`, [today])
    ]);

    reply.send({
      brigades: brigadesRes.rows[0],
      requests: requestsRes.rows[0],
      todayAssignments: parseInt(todayAssignmentsRes.rows[0].count, 10)
    });
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to fetch dashboard stats' });
  }
});

// ============================================================
// AUTH ROUTES
// ============================================================

fastify.post('/api/auth/login', async (request, reply) => {
  const { email, password } = request.body;

  if (!email || !password) {
    return reply.code(400).send({ error: 'Bad Request', message: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid email or password' });
    }

    const token = fastify.jwt.sign({ 
      userId: user.id, 
      email: user.email, 
      role: user.role 
    }, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    reply.send({
      user: { 
        id: user.id, 
        email: user.email, 
        fullName: user.full_name, 
        role: user.role 
      },
      token
    });
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to login' });
  }
});

fastify.get('/api/auth/me', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    const userId = request.user.userId;
    const result = await pool.query(
      'SELECT id, email, full_name, role, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'User not found' });
    }

    const user = result.rows[0];
    reply.send({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      createdAt: user.created_at
    });
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to get user profile' });
  }
});

// ============================================================
// BRIGADES ROUTES (CRUD)
// ============================================================

// Get all brigades with optional filter
fastify.get('/api/brigades', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    const { status } = request.query;
    let query = 'SELECT * FROM brigades';
    let params = [];

    if (status && status !== 'all') {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    reply.send(result.rows);
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to fetch brigades' });
  }
});

// Get single brigade
fastify.get('/api/brigades/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    const { id } = request.params;
    const result = await pool.query('SELECT * FROM brigades WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Brigade not found' });
    }

    reply.send(result.rows[0]);
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to fetch brigade' });
  }
});

// Create brigade
fastify.post('/api/brigades', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    console.log('[POST /api/brigades] Body:', JSON.stringify(request.body));
    const { name, qualification, carModel, licensePlate, specialists, status = 'active', color = '#3b82f6' } = request.body;

    // Validation
    if (!name || !qualification || !carModel || !licensePlate) {
      return reply.code(400).send({ 
        error: 'Bad Request', 
        message: 'Name, qualification, carModel and licensePlate are required' 
      });
    }

    const result = await pool.query(
      `INSERT INTO brigades (name, qualification, car_model, license_plate, specialists, status, color) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [name, qualification, carModel, licensePlate, specialists || [], status, color]
    );

    reply.code(201).send(result.rows[0]);
  } catch (err) {
    fastify.log.error(err);
    if (err.code === '23505') {
      return reply.code(409).send({ error: 'Conflict', message: 'License plate already exists' });
    }
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to create brigade' });
  }
});

// Update brigade
fastify.put('/api/brigades/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    const { id } = request.params;
    console.log(`[PUT /api/brigades/${id}] Body:`, JSON.stringify(request.body));
    const { name, qualification, carModel, licensePlate, specialists, status, color } = request.body;

    // Check if the user is trying to set a license plate that belongs to another brigade
    if (licensePlate !== undefined && licensePlate !== null) {
      const existing = await pool.query(
        'SELECT id FROM brigades WHERE license_plate = $1 AND id != $2',
        [licensePlate, id]
      );
      if (existing.rows.length > 0) {
        return reply.code(409).send({ error: 'Conflict', message: 'License plate already exists' });
      }
    }

    const result = await pool.query(
      `UPDATE brigades 
       SET name = COALESCE($1::varchar, name),
           qualification = COALESCE($2::varchar, qualification),
           car_model = COALESCE($3::varchar, car_model),
           license_plate = COALESCE($4::varchar, license_plate),
           specialists = COALESCE($5::text[], specialists),
           status = COALESCE($6::varchar, status),
           color = COALESCE($7::varchar, color),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [name, qualification, carModel, licensePlate, specialists, status, color, id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Brigade not found' });
    }

    reply.send(result.rows[0]);
  } catch (err) {
    fastify.log.error(err);
    console.error('[PUT ERROR DETAIL]', err.message);
    console.error(err.stack);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to update brigade' });
  }
});

// Delete brigade
fastify.delete('/api/brigades/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    const { id } = request.params;
    console.log(`[DELETE /api/brigades/${id}] Received request`);
    const result = await pool.query('DELETE FROM brigades WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      console.log(`[DELETE /api/brigades/${id}] Brigade not found`);
      return reply.code(404).send({ error: 'Not Found', message: 'Brigade not found' });
    }

    console.log(`[DELETE /api/brigades/${id}] Brigade deleted successfully`);
    reply.send({ message: 'Brigade deleted successfully' });
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to delete brigade' });
  }
});

// ============================================================
// REQUESTS ROUTES (CRUD)
// ============================================================

// Get all requests with optional filters
fastify.get('/api/requests', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    const { status, priority } = request.query;
    let query = 'SELECT r.*, b.name as assigned_brigade_name FROM requests r LEFT JOIN brigades b ON r.assigned_brigade = b.id';
    const conditions = [];
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`r.status = $${params.length}`);
    }
    if (priority && priority !== 'all') {
      params.push(priority);
      conditions.push(`r.priority = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY r.created_at DESC';

    const result = await pool.query(query, params);
    reply.send(result.rows.map(r => ({
      ...r,
      desired_datetime: formatLocalDateTime(r.desired_datetime),
    })));
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to fetch requests' });
  }
});

// Get single request
fastify.get('/api/requests/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    const { id } = request.params;
    const result = await pool.query(
      'SELECT r.*, b.name as assigned_brigade_name FROM requests r LEFT JOIN brigades b ON r.assigned_brigade = b.id WHERE r.id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Request not found' });
    }
    reply.send(result.rows[0]);
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to fetch request' });
  }
});

// Create request
fastify.post('/api/requests', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    const { address, coordinates, workType, client, phone, desiredDatetime, plannedDuration, priority, description } = request.body;

    if (!address || !workType || !client) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Address, workType and client are required' });
    }

    const result = await pool.query(
      `INSERT INTO requests (address, coordinates, work_type, client, phone, desired_datetime, planned_duration, status, priority, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', $8, $9)
       RETURNING *`,
      [address, coordinates ? JSON.stringify(coordinates) : null, workType, client, phone || null, desiredDatetime ? formatLocalDateTime(parseLocalDateTime(desiredDatetime)) : null, plannedDuration || 60, priority || 'medium', description || null]
    );

    reply.code(201).send(result.rows[0]);
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to create request' });
  }
});

// Update request
fastify.put('/api/requests/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    const { id } = request.params;
    const { address, coordinates, workType, client, phone, desiredDatetime, plannedDuration, status, priority, description } = request.body;

    const result = await pool.query(
      `UPDATE requests
       SET address = COALESCE($1, address),
           coordinates = COALESCE($2, coordinates),
           work_type = COALESCE($3, work_type),
           client = COALESCE($4, client),
           phone = COALESCE($5, phone),
           desired_datetime = COALESCE($6, desired_datetime),
           planned_duration = COALESCE($7, planned_duration),
           status = COALESCE($8, status),
           priority = COALESCE($9, priority),
           description = COALESCE($10, description),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING *`,
      [address, coordinates ? JSON.stringify(coordinates) : undefined, workType, client, phone, desiredDatetime ? formatLocalDateTime(parseLocalDateTime(desiredDatetime)) : null, plannedDuration, status, priority, description, id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Request not found' });
    }

    reply.send(result.rows[0]);
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to update request' });
  }
});

// Delete request
fastify.delete('/api/requests/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    const { id } = request.params;
    const result = await pool.query('DELETE FROM requests WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Request not found' });
    }

    reply.send({ message: 'Request deleted successfully' });
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to delete request' });
  }
});

// Get brigade stats
fastify.get('/api/brigades/stats', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'on_route') as on_route,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive
      FROM brigades
    `);

    reply.send(result.rows[0]);
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to fetch stats' });
  }
});

// ============================================================
// ASSIGNMENTS & PLANNING ROUTES
// ============================================================

// Helper: format Date to local YYYY-MM-DDTHH:mm:ss (without timezone suffix)
// PostgreSQL TIMESTAMP WITHOUT TIME ZONE stores exactly what we insert.
const toLocalISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}:${s}`;
};

// Helper: check if brigade qualification matches request work type
const checkQualification = (workType, brigadeQualification) => {
  const reqLower = workType.toLowerCase();
  const brigLower = brigadeQualification.toLowerCase();

  if (brigLower.includes('универсал')) return true;

  return (
    (reqLower.includes('сантех') && brigLower.includes('сантех')) ||
    (reqLower.includes('электр') && brigLower.includes('электр')) ||
    (reqLower.includes('канализац') && brigLower.includes('сантех')) ||
    (reqLower.includes('счетчик') && brigLower.includes('сантех')) ||
    (reqLower.includes('розетк') && brigLower.includes('электр')) ||
    (reqLower.includes('смесител') && brigLower.includes('сантех')) ||
    (reqLower.includes('люстр') && brigLower.includes('электр')) ||
    (reqLower.includes('автомат') && brigLower.includes('электр')) ||
    (reqLower.includes('протечк') && brigLower.includes('сантех'))
  );
};

// Get schedule for a date (with all assignments and brigades)
fastify.get('/api/schedule/:date', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    const { date } = request.params;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Date must be YYYY-MM-DD' });
    }

    // Get all brigades
    const brigadesResult = await pool.query('SELECT id, name, qualification, car_model, license_plate, color, status FROM brigades ORDER BY id');

    // Get assignments for this date
    const assignmentsResult = await pool.query(`
      SELECT a.*, r.address, r.work_type, r.client, r.phone, r.priority, r.description, r.planned_duration
      FROM assignments a
      JOIN requests r ON a.request_id = r.id
      WHERE a.scheduled_date = $1
      ORDER BY a.start_time
    `, [date]);

    // Get unassigned requests for this date (desired_datetime on that day, status='new')
    const unassignedResult = await pool.query(`
      SELECT * FROM requests
      WHERE status = 'new'
        AND desired_datetime::date = $1
      ORDER BY
        CASE priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        desired_datetime ASC
    `, [date]);

    reply.send({
      date,
      brigades: brigadesResult.rows,
      assignments: assignmentsResult.rows.map(a => ({
        ...a,
        start_time: formatLocalDateTime(a.start_time),
        end_time: formatLocalDateTime(a.end_time),
      })),
      unassigned: unassignedResult.rows.map(r => ({
        ...r,
        desired_datetime: formatLocalDateTime(r.desired_datetime),
      })),
    });
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to fetch schedule' });
  }
});

// Get unassigned requests (all new requests without brigade, optional date filter)
fastify.get('/api/requests/unassigned', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    const { date } = request.query;
    let query = `
      SELECT r.* FROM requests r
      WHERE r.status = 'new' AND r.assigned_brigade IS NULL
    `;
    const params = [];
    if (date) {
      params.push(date);
      query += ` AND r.desired_datetime::date = $${params.length}`;
    }
    query += ` ORDER BY
      CASE r.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
      END,
      r.desired_datetime ASC`;

    const result = await pool.query(query, params);
    reply.send(result.rows);
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to fetch unassigned requests' });
  }
});

// Create assignment (manual drag-drop or auto-plan)
fastify.post('/api/assignments', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    const { requestId, brigadeId, scheduledDate, startTime, endTime, travelTime = 0 } = request.body;

    if (!requestId || !brigadeId || !scheduledDate || !startTime || !endTime) {
      return reply.code(400).send({ error: 'Bad Request', message: 'requestId, brigadeId, scheduledDate, startTime, endTime are required' });
    }

    // 1. Validate request exists
    const reqResult = await pool.query('SELECT * FROM requests WHERE id = $1', [requestId]);
    if (reqResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Request not found' });
    }
    const requestData = reqResult.rows[0];

    // 2. Validate brigade exists
    const brigadeResult = await pool.query('SELECT * FROM brigades WHERE id = $1', [brigadeId]);
    if (brigadeResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Brigade not found' });
    }
    const brigade = brigadeResult.rows[0];

    // 3. Validate qualification
    const isQualified = checkQualification(requestData.work_type, brigade.qualification);
    if (!isQualified) {
      return reply.code(409).send({ error: 'Conflict', message: 'Brigade qualification does not match request work type' });
    }

    // 4. Validate startTime matches desired_datetime exactly
    const desiredStr = formatLocalDateTime(requestData.desired_datetime);
    if (startTime !== desiredStr) {
      return reply.code(409).send({ error: 'Conflict', message: `Start time must be ${desiredStr} (request desired time)` });
    }

    // 5. Validate duration matches planned_duration
    const actualDurationMin = Math.round((parseLocalDateTime(endTime).getTime() - parseLocalDateTime(startTime).getTime()) / 60000);
    if (actualDurationMin !== requestData.planned_duration) {
      return reply.code(409).send({ error: 'Conflict', message: `Duration must be ${requestData.planned_duration} minutes` });
    }

    // 6. Check for conflicts: another assignment for same brigade overlapping time
    const conflict = await pool.query(`
      SELECT id FROM assignments
      WHERE brigade_id = $1 AND scheduled_date = $2
        AND (start_time, end_time) OVERLAPS ($3::timestamp, $4::timestamp)
    `, [brigadeId, scheduledDate, startTime, endTime]);

    if (conflict.rows.length > 0) {
      return reply.code(409).send({ error: 'Conflict', message: 'Time slot conflicts with existing assignment for this brigade' });
    }

    const result = await pool.query(
      `INSERT INTO assignments (request_id, brigade_id, scheduled_date, start_time, end_time, travel_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [requestId, brigadeId, scheduledDate, startTime, endTime, travelTime]
    );

    // Update request status and assigned_brigade
    await pool.query(
      `UPDATE requests SET status = 'assigned', assigned_brigade = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [brigadeId, requestId]
    );

    reply.code(201).send(result.rows[0]);
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to create assignment' });
  }
});

// Update assignment (move to different time/brigade)
fastify.put('/api/assignments/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    const { id } = request.params;
    const { brigadeId, startTime, endTime, travelTime } = request.body;

    const result = await pool.query(
      `UPDATE assignments
       SET brigade_id = COALESCE($1, brigade_id),
           start_time = COALESCE($2, start_time),
           end_time = COALESCE($3, end_time),
           travel_time = COALESCE($4, travel_time),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [brigadeId, startTime, endTime, travelTime, id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Assignment not found' });
    }

    reply.send(result.rows[0]);
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to update assignment' });
  }
});

// Delete assignment
fastify.delete('/api/assignments/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    const { id } = request.params;

    // Get request_id to unassign it
    const assignResult = await pool.query('SELECT request_id FROM assignments WHERE id = $1', [id]);
    if (assignResult.rows.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Assignment not found' });
    }
    const requestId = assignResult.rows[0].request_id;

    await pool.query('DELETE FROM assignments WHERE id = $1', [id]);
    await pool.query(
      `UPDATE requests SET status = 'new', assigned_brigade = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [requestId]
    );

    reply.send({ message: 'Assignment deleted, request returned to unassigned' });
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to delete assignment' });
  }
});

// ============================================================
// AUTO-PLANNING ALGORITHM
// ============================================================

fastify.post('/api/schedule/:date/auto-plan', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  try {
    const { date } = request.params;
    const result = await require('./services/planning').autoPlan(pool, date, 9, 18);
    reply.send({
      date,
      planned: result.planned,
      unplanned: result.unplanned,
      details: result.details,
    });
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Internal Server Error', message: 'Auto-planning failed' });
  }
});

// Start server
const start = async () => {
  try {
    await initDB();

    // Register routes plugin (GIS/routes)
    await fastify.register(require('./routes/routes'), { pool });
    await fastify.ready();
    
    const port = process.env.PORT || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
