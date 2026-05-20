const { pool } = require('./db');

const initDB = async () => {
  const client = await pool.connect();
  try {
    // Users table (already exists from auth)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'dispatcher',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Refresh tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Brigades table
    await client.query(`
      CREATE TABLE IF NOT EXISTS brigades (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        qualification VARCHAR(100) NOT NULL,
        car_model VARCHAR(255) NOT NULL,
        license_plate VARCHAR(20) NOT NULL UNIQUE,
        specialists TEXT[] DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'active',
        color VARCHAR(7) DEFAULT '#3b82f6',
        lat NUMERIC(10, 7),
        lng NUMERIC(10, 7),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Specialists table (separate for proper management)
    await client.query(`
      CREATE TABLE IF NOT EXISTS specialists (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(30),
        qualification VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Junction table for brigades-specialists relationship
    await client.query(`
      CREATE TABLE IF NOT EXISTS brigade_specialists (
        brigade_id INTEGER REFERENCES brigades(id) ON DELETE CASCADE,
        specialist_id INTEGER REFERENCES specialists(id) ON DELETE CASCADE,
        PRIMARY KEY (brigade_id, specialist_id)
      )
    `);

    // Requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        address TEXT NOT NULL,
        coordinates JSONB,
        work_type VARCHAR(255) NOT NULL,
        client VARCHAR(255) NOT NULL,
        phone VARCHAR(30),
        desired_datetime TIMESTAMP,
        planned_duration INTEGER DEFAULT 60,
        status VARCHAR(20) DEFAULT 'new',
        priority VARCHAR(20) DEFAULT 'medium',
        description TEXT,
        assigned_brigade INTEGER REFERENCES brigades(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Assignments table (schedule slots)
    await client.query(`
      CREATE TABLE IF NOT EXISTS assignments (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
        brigade_id INTEGER NOT NULL REFERENCES brigades(id) ON DELETE CASCADE,
        scheduled_date DATE NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        travel_time INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'scheduled',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('База данных успешно инициализирована');
  } catch (err) {
    console.error('Ошибка инициализации БД:', err);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { initDB };
