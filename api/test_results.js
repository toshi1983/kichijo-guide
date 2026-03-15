const { resolveTestResultsManifest } = require('../data/test_results_manifest_store.js');

let cachedManifest = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const now = Date.now();
        if (!cachedManifest || (now - cachedAt) > CACHE_TTL_MS) {
            const { manifest } = await resolveTestResultsManifest();
            cachedManifest = manifest;
            cachedAt = now;
        }

        return res.status(200).json(cachedManifest);
    } catch (error) {
        console.error('test_results error:', error);
        const { manifest } = await resolveTestResultsManifest();
        cachedManifest = manifest;
        cachedAt = Date.now();
        return res.status(200).json(manifest);
    }
}
