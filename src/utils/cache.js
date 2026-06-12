// IMPROVED: Plain JS Map for in-memory caching
const cache = new Map();

/**
 * Get item from cache
 * @param {string} key 
 * @returns {any|null}
 */
export const getCached = (key) => {
  const item = cache.get(key);
  if (!item) return null;
  
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.data;
};

/**
 * Set item in cache
 * @param {string} key 
 * @param {any} data 
 * @param {number} ttlSeconds - Default 60 seconds
 */
export const setCache = (key, data, ttlSeconds = 60) => {
  cache.set(key, { 
    data, 
    expiry: Date.now() + ttlSeconds * 1000 
  });
};

/**
 * Delete item from cache
 * @param {string} key 
 */
export const deleteCache = (key) => {
  cache.delete(key);
};

export const deleteCacheByPrefix = (prefix) => {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
};

export default cache;
