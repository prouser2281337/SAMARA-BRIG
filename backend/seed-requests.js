const { pool } = require('./db');

const requests = [
  { address: 'ул. Ленинградская, 35, кв. 42', workType: 'Устранение протечки', client: 'Смирнова О.А.', phone: '+7 927 123-45-67', desiredDatetime: '2026-05-12T10:00:00', duration: 90, status: 'assigned', priority: 'high', description: 'Течет труба под раковиной на кухне', assignedBrigade: 1 },
  { address: 'пр. Кирова, 158, офис 201', workType: 'Замена электропроводки', client: 'ООО Техсервис', phone: '+7 846 234-56-78', desiredDatetime: '2026-05-12T11:30:00', duration: 180, status: 'assigned', priority: 'medium', description: 'Необходима полная замена проводки в офисе', assignedBrigade: 2 },
  { address: 'ул. Молодогвардейская, 67, кв. 15', workType: 'Ремонт розеток', client: 'Козлов В.П.', phone: '+7 927 345-67-89', desiredDatetime: '2026-05-12T14:00:00', duration: 60, status: 'new', priority: 'low', description: 'Не работают 2 розетки в спальне' },
  { address: 'ул. Советской Армии, 144, кв. 89', workType: 'Прочистка канализации', client: 'Морозова Е.И.', phone: '+7 927 456-78-90', desiredDatetime: '2026-05-12T09:00:00', duration: 120, status: 'assigned', priority: 'urgent', description: 'Засор в ванной комнате, вода не уходит', assignedBrigade: 1 },
  { address: 'ул. Вольская, 75', workType: 'Установка счетчика', client: 'Романов П.С.', phone: '+7 927 567-89-01', desiredDatetime: '2026-05-13T10:00:00', duration: 90, status: 'new', priority: 'medium', description: 'Установка нового счетчика воды' },
  { address: 'пр. Металлургов, 56, кв. 112', workType: 'Замена автоматов', client: 'Федорова Т.Н.', phone: '+7 927 678-90-12', desiredDatetime: '2026-05-12T15:30:00', duration: 75, status: 'new', priority: 'high', description: 'Выбивает автомат в щитке' },
  { address: 'ул. Победы, 89, кв. 3', workType: 'Ремонт смесителя', client: 'Григорьев А.М.', phone: '+7 927 789-01-23', desiredDatetime: '2026-05-13T11:00:00', duration: 60, status: 'new', priority: 'low', description: 'Капает кран в ванной' },
  { address: 'ул. Стара-Загора, 156А', workType: 'Установка люстры', client: 'ТЦ Самара', phone: '+7 846 890-12-34', desiredDatetime: '2026-05-12T16:00:00', duration: 45, status: 'assigned', priority: 'medium', description: 'Установка люстры в холле', assignedBrigade: 2 }
];

async function seed() {
  // Clear existing seed data to prevent duplicates
  try {
    await pool.query("DELETE FROM requests WHERE client IN ($1,$2,$3,$4,$5,$6,$7,$8)",
      requests.map(r => r.client));
  } catch (e) { /* ignore */ }

  let inserted = 0;
  for (const r of requests) {
    try {
      await pool.query(
        `INSERT INTO requests (address, work_type, client, phone, desired_datetime, planned_duration, status, priority, description, assigned_brigade) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [r.address, r.workType, r.client, r.phone, r.desiredDatetime, r.duration, r.status, r.priority, r.description, r.assignedBrigade || null]
      );
      inserted++;
    } catch (e) {
      console.error('Insert error:', e.message);
    }
  }
  console.log('Inserted', inserted, 'requests');
  await pool.end();
}
seed();
