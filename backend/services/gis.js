const axios = require('axios');

const DG_CATALOG_API = 'https://catalog.api.2gis.com/3.0';
const DG_ROUTING_API = 'https://routing.api.2gis.com';
const API_KEY = process.env.API_KEY

const GARAGE = {
  name: 'Гараж',
  address: 'г. Самара, ул. Молодогвардейская, 244',
  lat: 53.209294,
  lng: 50.125493,
};

async function geocodeAddress(address) {
  try {
    const url = `${DG_CATALOG_API}/items?q=${encodeURIComponent(address + ' Самара')}&key=${API_KEY}&fields=items.point`;
    const res = await axios.get(url, { timeout: 10000 });
    const items = res.data?.result?.items || [];
    if (items.length === 0) return null;
    const item = items[0];
    const point = item.point || {};
    return {
      lat: point.lat,
      lng: point.lon,
      fullName: item.full_name,
      purpose: item.purpose_name,
    };
  } catch (err) {
    console.error('[geocodeAddress] error:', err.message);
    return null;
  }
}

async function routeBetweenPoints(from, to) {
  try {
    const url = `${DG_ROUTING_API}/carrouting/6.0.0/2gis?key=${API_KEY}`;
    const body = {
      points: [
        { lat: Number(from.lat), lon: Number(from.lng) },
        { lat: Number(to.lat), lon: Number(to.lng) },
      ],
    };
    console.log('[routeBetweenPoints] URL:', url);
    console.log('[routeBetweenPoints] Body:', JSON.stringify(body));
    const res = await axios.post(url, body, { timeout: 2000 });
    console.log('[routeBetweenPoints] Status:', res.status);
    console.log('[routeBetweenPoints] Has result:', !!res.data?.result);
    const route = res.data?.result?.[0];
    if (!route) {
      console.log('[routeBetweenPoints] No route found, response keys:', Object.keys(res.data || {}));
      return null;
    }

    const allSelections = [];
    const maneuvers = route.maneuvers || [];
    for (const m of maneuvers) {
      const paths = m.outcoming_path?.geometry || [];
      for (const p of paths) {
        if (p.selection) allSelections.push(p.selection);
      }
    }
    let geometry = null;
    if (allSelections.length > 0) {
      geometry = allSelections.join(' ');
    }

    return {
      duration: route.total_duration || 0,
      length: route.total_distance || 0,
      geometry,
    };
  } catch (err) {
    console.error('[routeBetweenPoints] error:', err.message, err.response?.status);
    return null;
  }
}

async function getRouteDuration(from, to) {
  const result = await routeBetweenPoints(from, to);
  if (!result) return { duration: 0, length: 0 };
  return { duration: result.duration, length: result.length };
}

async function getRouteGeometry(from, to) {
  return routeBetweenPoints(from, to);
}

async function buildFullRoute(points) {
  const legs = [];
  let prev = GARAGE;
  for (const pt of points) {
    const geo = await getRouteGeometry(prev, pt);
    const fallback = !geo ? estimateDirectRoute(prev, pt) : null;
    legs.push({
      from: { lat: prev.lat, lng: prev.lng, name: prev.name || '' },
      to: { lat: pt.lat, lng: pt.lng, name: pt.name || '' },
      duration: geo?.duration ?? fallback.duration,
      length: geo?.length ?? fallback.length,
      geometry: geo?.geometry || null
    });
    prev = pt;
  }
  const back = await getRouteGeometry(prev, GARAGE);
  const backFallback = !back ? estimateDirectRoute(prev, GARAGE) : null;
  legs.push({
    from: { lat: prev.lat, lng: prev.lng, name: prev.name || '' },
    to: { lat: GARAGE.lat, lng: GARAGE.lng, name: GARAGE.name },
    duration: back?.duration ?? backFallback.duration,
    length: back?.length ?? backFallback.length,
    geometry: back?.geometry || null
  });
  return legs;
}

function getMapScriptUrl() {
  return `https://maps.api.2gis.ru/2.0/loader.js?pkg=full&key=${API_KEY}`;
}

// Функция Haversine для расчёта прямого расстояния между точками
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const deltaLatRad = (lat2 - lat1) * Math.PI / 180;
  const deltaLngRad = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(deltaLatRad / 2) ** 2 +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLngRad / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Fallback: прямой маршрут с оценкой времени
function estimateDirectRoute(from, to, speedKmh = 40) {
  const length = haversineDistance(from.lat, from.lng, to.lat, to.lng);
  const speedMs = (speedKmh * 1000) / 3600;
  const duration = Math.round(length / speedMs);
  return { duration, length };
}

module.exports = {
  GARAGE,
  geocodeAddress,
  getRouteDuration,
  getRouteGeometry,
  buildFullRoute,
  getMapScriptUrl,
};