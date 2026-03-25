import api from './index.js';

const CACHE_TTL = {
	list: 5 * 60_000,
	featured: 5 * 60_000,
	comic: 3 * 60_000,
	chapters: 3 * 60_000,
};

const listCache = new Map();
const featuredCache = new Map();
const comicCache = new Map();
const chaptersCache = new Map();

const inFlightList = new Map();
const inFlightFeatured = new Map();
const inFlightComic = new Map();
const inFlightChapters = new Map();

const toCachedResponse = (data) => ({ data, fromCache: true });

const now = () => Date.now();

const getCached = (cache, key) => {
	const hit = cache.get(key);
	if (!hit) return null;
	if (hit.expiresAt <= now()) {
		cache.delete(key);
		return null;
	}
	return hit.data;
};

const setCached = (cache, key, data, ttl) => {
	cache.set(key, { data, expiresAt: now() + ttl });
};

const makeParamKey = (params = {}) => {
	const entries = Object.entries(params)
		.filter(([, value]) => value !== undefined && value !== null && value !== '')
		.sort(([a], [b]) => a.localeCompare(b));
	return JSON.stringify(entries);
};

const fetchWithCache = ({
	cache,
	inFlight,
	key,
	ttl,
	force = false,
	fetcher,
}) => {
	if (!force) {
		const cached = getCached(cache, key);
		if (cached) return Promise.resolve(toCachedResponse(cached));

		const running = inFlight.get(key);
		if (running) return running;
	}

	const request = fetcher()
		.then((res) => {
			setCached(cache, key, res.data, ttl);
			return res;
		})
		.finally(() => {
			inFlight.delete(key);
		});

	inFlight.set(key, request);
	return request;
};

export const getComics = (params = {}, options = {}) => {
	const key = makeParamKey(params);
	const requestConfig = options.requestConfig || {};
	return fetchWithCache({
		cache: listCache,
		inFlight: inFlightList,
		key,
		ttl: CACHE_TTL.list,
		force: options.force,
		fetcher: () => api.get('/comics', { params, ...requestConfig }),
	});
};

export const getFeaturedComics = (options = {}) => {
	const key = 'featured';
	const requestConfig = options.requestConfig || {};
	return fetchWithCache({
		cache: featuredCache,
		inFlight: inFlightFeatured,
		key,
		ttl: CACHE_TTL.featured,
		force: options.force,
		fetcher: () => api.get('/comics/featured', requestConfig),
	});
};

export const getComic = (id, options = {}) => {
	const key = String(id);
	const requestConfig = options.requestConfig || {};
	return fetchWithCache({
		cache: comicCache,
		inFlight: inFlightComic,
		key,
		ttl: CACHE_TTL.comic,
		force: options.force,
		fetcher: () => api.get(`/comics/${id}`, requestConfig),
	});
};

export const getComicChapters = (id, options = {}) => {
	const key = String(id);
	const requestConfig = options.requestConfig || {};
	return fetchWithCache({
		cache: chaptersCache,
		inFlight: inFlightChapters,
		key,
		ttl: CACHE_TTL.chapters,
		force: options.force,
		fetcher: () => api.get(`/comics/${id}/chapters`, requestConfig),
	});
};

export const prefetchComicDetail = (id) => Promise.allSettled([
	getComic(id),
	getComicChapters(id),
]);

export const prefetchHomeData = () => Promise.allSettled([
	getFeaturedComics(),
	getComics({ limit: 10, sort: 'views' }),
	getComics({ limit: 10 }),
]);

export const invalidateComicCache = (id) => {
	if (id !== undefined && id !== null) {
		const key = String(id);
		comicCache.delete(key);
		chaptersCache.delete(key);
		return;
	}

	listCache.clear();
	featuredCache.clear();
	comicCache.clear();
	chaptersCache.clear();
};
