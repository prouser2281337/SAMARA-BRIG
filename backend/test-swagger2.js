const axios = require('axios');

(async () => {
  try {
    const r = await axios.get('http://localhost:3001/documentation/json');
    const paths = Object.keys(r.data.paths);
    console.log('Routes:', paths.join('\n'));
  } catch (err) {
    console.error('Error:', err.message);
  }
})();