const fs = require('fs');
const path = require('path');

const { buildTestResultsManifest } = require('../data/test_results_service.js');

async function main() {
    const manifest = await buildTestResultsManifest();
    const outputDir = path.join(process.cwd(), 'data', 'generated');
    const outputPath = path.join(outputDir, 'test_results_manifest.json');

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    console.log(`Wrote ${outputPath}`);
    console.log(`Latest test: ${manifest.latestTestId}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
