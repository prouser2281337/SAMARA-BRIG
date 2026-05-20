const { pool } = require('./db');
const bcrypt = require('bcryptjs');

const seedData = async () => {
  const client = await pool.connect();
  try {
    // Check if demo user exists
    const existingUser = await client.query('SELECT * FROM users WHERE email = $1', ['demo@samara-brig.ru']);
    
    if (existingUser.rows.length === 0) {
      const passwordHash = await bcrypt.hash('demo123', 10);
      await client.query(
        'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
        ['demo@samara-brig.ru', passwordHash, 'Демо Диспетчер', 'dispatcher']
      );
      console.log('Demo user created: demo@samara-brig.ru / demo123');
    } else {
      console.log('Demo user already exists');
    }

    // Create admin user
    const existingAdmin = await client.query('SELECT * FROM users WHERE email = $1', ['admin@samara-brig.ru']);
    
    if (existingAdmin.rows.length === 0) {
      const adminPasswordHash = await bcrypt.hash('admin123', 10);
      await client.query(
        'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
        ['admin@samara-brig.ru', adminPasswordHash, 'Администратор', 'admin']
      );
      console.log('Admin user created: admin@samara-brig.ru / admin123');
    } else {
      console.log('Admin user already exists');
    }

    console.log('Seed completed successfully');
  } catch (err) {
    console.error('Seed error:', err);
    throw err;
  } finally {
    client.release();
  }
};

if (require.main === module) {
  seedData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seedData };
