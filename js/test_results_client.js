async function fetchTestResultsManifest() {
    const response = await fetch('/api/test_results', { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
}

function getLatestTestFromManifest(manifest) {
    return manifest?.latestTest || null;
}

function getTrendFromManifest(manifest) {
    return manifest?.trend || null;
}

window.fetchTestResultsManifest = fetchTestResultsManifest;
window.getLatestTestFromManifest = getLatestTestFromManifest;
window.getTrendFromManifest = getTrendFromManifest;
