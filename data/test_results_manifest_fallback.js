const staticTestContexts = require('./sapix_test_context.js');

const latestTest = {
    id: '2026_03_kumiwake',
    folderName: '2026-３月組分けテスト',
    displayName: '2026年3月 組分けテスト',
    chartLabel: '3月組',
    testDate: '2026年3月8日',
    pdfPath: 'テスト結果/2026-３月組分けテスト/個人成績票.pdf',
    summary: {
        total4: { label: '４科目計', score: 199, max: 500, deviation: 38.9, average: 280.3 },
        total3: { label: '３科目計', score: 161, max: 400, deviation: 38.5, average: 230.2 },
        total2: { label: '２科目計', score: 134, max: 300, deviation: 40.8, average: 176.3 },
        math: { label: '算数', score: 48, max: 150, deviation: 38.3, average: 84.2 },
        japanese: { label: '国語', score: 86, max: 150, deviation: 47.0, average: 92.1 },
        science: { label: '理科', score: 27, max: 100, deviation: 34.0, average: 53.9 },
        social: { label: '社会', score: 38, max: 100, deviation: 42.9, average: 50.1 }
    },
    breakdown: {
        math: [
            { title: '1 計算問題', score: 18, max: 18, average: 12.9, rate: 100.0 },
            { title: '2 小問集合（文章題）', score: 24, max: 36, average: 25.6, rate: 66.7 },
            { title: '3 小問集合（図形）', score: 6, max: 30, average: 18.9, rate: 20.0 },
            { title: '4 損益', score: 0, max: 18, average: 8.7, rate: 0.0 },
            { title: '5 速さ', score: 0, max: 12, average: 7.3, rate: 0.0 },
            { title: '6 水量変化', score: 0, max: 18, average: 6.6, rate: 0.0 },
            { title: '7 数表', score: 0, max: 18, average: 4.2, rate: 0.0 }
        ],
        japanese: [
            { title: '1 漢字の書きとり', score: 14, max: 20, average: 14.2, rate: 70.0 },
            { title: '2 慣用句・四字熟語', score: 4, max: 20, average: 9.5, rate: 20.0 },
            { title: '3 説明的文章の読解', score: 29, max: 56, average: 33.7, rate: 51.8 },
            { title: '4 文学的文章の読解', score: 39, max: 54, average: 34.8, rate: 72.2 }
        ],
        science: [
            { title: '1 気象', score: 5, max: 25, average: 13.7, rate: 20.0 },
            { title: '2 アゲハ', score: 7, max: 25, average: 15.3, rate: 28.0 },
            { title: '3 熱', score: 9, max: 25, average: 14.0, rate: 36.0 },
            { title: '4 てこ', score: 6, max: 25, average: 10.9, rate: 24.0 }
        ],
        social: [
            { title: '1 歴史総合問題', score: 22, max: 61, average: 31.4, rate: 36.1 },
            { title: '2 地理総合問題', score: 16, max: 39, average: 18.8, rate: 41.0 }
        ]
    },
    trend: {
        labels: ['10月M', '12月M', '1月組', '1月復', '3月組'],
        total4: [39.9, 45.2, 44.9, 50.2, 38.9],
        math: [36.7, 49.5, 41.7, 51.2, 38.3],
        japanese: [50.7, 47.1, 52.0, 61.5, 47.0],
        science: [46.2, 43.6, 49.8, 45.1, 34.0],
        social: [35.1, 40.6, 41.3, 41.7, 42.9]
    }
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function buildFallbackTestResultsManifest() {
    const test = clone(latestTest);
    return {
        generatedAt: new Date().toISOString(),
        latestTestId: test.id,
        latestTest: test,
        tests: [clone(latestTest)],
        chatTests: [
            { id: test.id, label: test.displayName }
        ],
        trend: clone(latestTest.trend),
        chatContexts: staticTestContexts,
        fallback: true
    };
}

module.exports = {
    buildFallbackTestResultsManifest
};
