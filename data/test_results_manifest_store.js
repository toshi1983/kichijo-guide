const fs = require('fs');
const path = require('path');

const { buildTestResultsManifest } = require('./test_results_service.js');
const { buildFallbackTestResultsManifest } = require('./test_results_manifest_fallback.js');

const GENERATED_MANIFEST_PATH = path.join(process.cwd(), 'data', 'generated', 'test_results_manifest.json');

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function readGeneratedTestResultsManifest() {
    if (!fs.existsSync(GENERATED_MANIFEST_PATH)) {
        return null;
    }

    try {
        const raw = fs.readFileSync(GENERATED_MANIFEST_PATH, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        console.error('generated test_results manifest read error:', error);
        return null;
    }
}

async function resolveTestResultsManifest() {
    const generatedManifest = readGeneratedTestResultsManifest();
    if (generatedManifest) {
        return {
            manifest: clone(generatedManifest),
            source: 'generated'
        };
    }

    try {
        return {
            manifest: await buildTestResultsManifest(),
            source: 'dynamic'
        };
    } catch (error) {
        console.error('dynamic test_results manifest error:', error);
        return {
            manifest: buildFallbackTestResultsManifest(),
            source: 'fallback'
        };
    }
}

module.exports = {
    GENERATED_MANIFEST_PATH,
    readGeneratedTestResultsManifest,
    resolveTestResultsManifest
};
