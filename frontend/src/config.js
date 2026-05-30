const splitCsv = (value, fallback = []) => {
  if (!value) return fallback;
  return value.split(",").map((item) => item.trim()).filter(Boolean);
};

const config = {
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL,
    wsUrl: import.meta.env.VITE_WS_URL,
    timeout: Number(import.meta.env.VITE_API_TIMEOUT ?? 10000),
  },
  map: {
    tileUrl: import.meta.env.VITE_MAP_TILE_URL,
    apiKey: import.meta.env.VITE_MAP_API_KEY,
    geoJsonUrls: splitCsv(import.meta.env.VITE_MAP_GEOJSON_URLS, [
      "https://cdn.jsdelivr.net/gh/adarshbiradar/maps-geojson@master/india.json",
      "https://cdn.jsdelivr.net/gh/geohacker/india@master/state/india_state.geojson",
      "https://cdn.jsdelivr.net/gh/Subhash9325/GeoJson-Data-of-Indian-States@master/Indian_States",
    ]),
  },
  auth: {
    tokenKey: import.meta.env.VITE_AUTH_TOKEN_KEY ?? "auth_token",
  },
  user: {
    defaultName: import.meta.env.VITE_DEFAULT_USER_NAME ?? "R. Kulkarni",
    defaultRole: import.meta.env.VITE_DEFAULT_USER_ROLE ?? "District Education Officer",
    defaultPassword: import.meta.env.VITE_DEFAULT_PASSWORD ?? "admin",
  },
};

export default config;
