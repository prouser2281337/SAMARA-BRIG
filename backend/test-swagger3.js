const axios = require('axios');

(async () => {
  try {
    const r = await axios.get('http://localhost:3001/documentation/json');
    const paths = Object.keys(r.data.paths);
    console.log('Routes found:', paths.length);
    console.log('\nRoutes:');
    paths.forEach(p => {
      const methods = Object.keys(r.data.paths[p]);
      console.log(`  ${methods.join(',').toUpperCase()} ${p}`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
})();