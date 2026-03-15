const { buildTestResultsManifest } = require('../data/test_results_service.js');

let cachedManifest = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const now = Date.now();
        if (!cachedManifest || (now - cachedAt) > CACHE_TTL_MS) {
            cachedManifest = await buildTestResultsManifest();
            cachedAt = now;
        }

        return res.status(200).json(cachedManifest);
    } catch (error) {
        console.error('test_results error:', error);
        return res.status(500).json({ error: 'テスト結果の読み込みに失敗しました。' });
    }
}
