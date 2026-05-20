const axios = require('axios');

(async () => {
  try {
    const r = await axios.get('http://localhost:3001/api/health');
    console.log('✅ Server health:', r.data.status);
    console.log('✅ Server timestamp:', r.data.timestamp);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();