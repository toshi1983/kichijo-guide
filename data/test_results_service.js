const fs = require('fs');
const path = require('path');

const TEST_RESULTS_DIR = path.join(process.cwd(), 'テスト結果');
let PDFParseConstructor = null;

const SUBJECT_KEYS = {
    total4: '４科目計',
    total3: '３科目計',
    total2: '２科目計',
    math: '算数',
    japanese: '国語',
    science: '理科',
    social: '社会'
};

const SUBJECT_ORDER = ['math', 'japanese', 'science', 'social'];

const DETAIL_POLICY = `このチャットが参照できるのは、個人成績票から読み取った成績推移と分野別の要約です。
問題冊子そのものの本文、図、表、選択肢全文は参照していません。
具体的な問題文や図が必要な質問では、見えていない情報を想像で断定せず、一般的な解き方や復習手順を案内してください。
図や問題文そのものを見たい場合は、うさトークで画像を送る方法を勧めてください。`;

function normalizeDigits(text = '') {
    return String(text)
        .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
        .replace(/[Ａ-Ｚａ-ｚ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
        .replace(/　/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function compact(text = '') {
    return normalizeDigits(text).replace(/\s+/g, '');
}

function listPdfFolders() {
    if (!fs.existsSync(TEST_RESULTS_DIR)) {
        return [];
    }

    return fs.readdirSync(TEST_RESULTS_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
            const pdfPath = path.join(TEST_RESULTS_DIR, entry.name, '個人成績票.pdf');
            return {
                folderName: entry.name,
                folderPath: path.join(TEST_RESULTS_DIR, entry.name),
                pdfPath
            };
        })
        .filter((entry) => fs.existsSync(entry.pdfPath))
        .sort((a, b) => {
            const dateA = extractFolderMeta(a.folderName).sortKey;
            const dateB = extractFolderMeta(b.folderName).sortKey;
            return dateA.localeCompare(dateB);
        });
}

function ensurePdfRuntimeGlobals() {
    if (globalThis.DOMMatrix && globalThis.DOMPoint && globalThis.DOMRect) {
        return;
    }

    try {
        const geometry = require('../temp_pdf_extract_2/node_modules/@napi-rs/canvas/geometry');
        if (!globalThis.DOMMatrix && geometry.DOMMatrix) {
            globalThis.DOMMatrix = geometry.DOMMatrix;
        }
        if (!globalThis.DOMPoint && geometry.DOMPoint) {
            globalThis.DOMPoint = geometry.DOMPoint;
        }
        if (!globalThis.DOMRect && geometry.DOMRect) {
            globalThis.DOMRect = geometry.DOMRect;
        }
    } catch (error) {
        console.warn('PDF geometry polyfill unavailable:', error.message);
    }
}

function getPdfParseConstructor() {
    if (PDFParseConstructor) {
        return PDFParseConstructor;
    }

    try {
        // pdf.js still touches DOMMatrix on serverless runtimes during text extraction.
        ensurePdfRuntimeGlobals();
        ({ PDFParse: PDFParseConstructor } = require('../temp_pdf_extract_2/node_modules/pdf-parse'));
        return PDFParseConstructor;
    } catch (error) {
        throw new Error(`PDF parser unavailable: ${error.message}`);
    }
}

function extractFolderMeta(folderName) {
    const normalized = normalizeDigits(folderName);
    const yearMatch = normalized.match(/^(\d{4})/);
    const year = yearMatch ? Number(yearMatch[1]) : null;

    let month = null;
    let day = null;

    const monthDayPrefix = normalized.match(/^\d{4}[-_]?(\d{2})(\d{2})/);
    if (monthDayPrefix) {
        month = Number(monthDayPrefix[1]);
        day = Number(monthDayPrefix[2]);
    }

    if (!month) {
        const monthMatch = normalized.match(/(\d{1,2})月/);
        if (monthMatch) {
            month = Number(monthMatch[1]);
        }
    }

    let cleanName = normalized.replace(/^\d{4}/, '');
    cleanName = cleanName.replace(/^[-_]?/, '');
    cleanName = cleanName.replace(/^\d{4}/, '');
    cleanName = cleanName.replace(/^[-_]?/, '');
    cleanName = cleanName.replace(/＜.*?＞/g, '').trim();
    cleanName = cleanName || normalized;

    const typeName = cleanName.replace(/^\d{1,2}月(?:度)?/, '').trim() || cleanName;
    const monthLabel = month ? `${month}月` : '';
    const displayName = year && month
        ? `${year}年${month}月 ${typeName}`.trim()
        : cleanName;

    let chartLabel = monthLabel || cleanName;
    let slug = 'test';

    if (/組分け/.test(cleanName)) {
        chartLabel = `${monthLabel}組`.trim();
        slug = 'kumiwake';
    } else if (/復習/.test(cleanName)) {
        chartLabel = `${monthLabel}復`.trim();
        slug = 'fukushu';
    } else if (/マンスリー/.test(cleanName)) {
        chartLabel = `${monthLabel}M`.trim();
        slug = 'monthly';
    } else if (/オープン/.test(cleanName)) {
        chartLabel = `${monthLabel}SO`.trim();
        slug = 'open';
    }

    const id = year && month
        ? `${year}_${String(month).padStart(2, '0')}_${slug}`
        : cleanName.replace(/[^\w]+/g, '_');

    return {
        year,
        month,
        day,
        id,
        displayName,
        chartLabel,
        cleanName,
        sortKey: `${String(year || 0).padStart(4, '0')}-${String(month || 0).padStart(2, '0')}-${String(day || 0).padStart(2, '0')}`
    };
}

function splitPages(rawText = '') {
    return rawText
        .split(/-- \d+ of \d+ --/g)
        .map((section) => section.trim())
        .filter(Boolean);
}

function extractTestDate(firstPageText = '', meta = {}) {
    const dateMatch = normalizeDigits(firstPageText).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (!dateMatch) {
        if (meta.year && meta.month) {
            return meta.day ? `${meta.year}年${meta.month}月${meta.day}日` : `${meta.year}年${meta.month}月`;
        }
        return '';
    }
    return `${Number(dateMatch[1])}年${Number(dateMatch[2])}月${Number(dateMatch[3])}日`;
}

function parseSummary(firstPageText = '') {
    const lines = firstPageText.split('\n').map((line) => normalizeDigits(line)).filter(Boolean);
    const patterns = {
        total4: /^4科目計\s+(\d+)\s*\/\s*(\d+)\s+([\d.]+)\s+\d+\s*\/\s*\d+\s+([\d.]+)/,
        total3: /^3科目計\s+(\d+)\s*\/\s*(\d+)\s+([\d.]+)\s+\d+\s*\/\s*\d+\s+([\d.]+)/,
        total2: /^2科目計\s+(\d+)\s*\/\s*(\d+)\s+([\d.]+)\s+\d+\s*\/\s*\d+\s+([\d.]+)/,
        math: /^算\s*数\s+(\d+)\s*\/\s*(\d+)\s+([\d.]+)\s+\d+\s*\/\s*\d+\s+([\d.]+)/,
        japanese: /^国\s*語\s+(\d+)\s*\/\s*(\d+)\s+([\d.]+)\s+\d+\s*\/\s*\d+\s+([\d.]+)/,
        science: /^理\s*科\s+(\d+)\s*\/\s*(\d+)\s+([\d.]+)\s+\d+\s*\/\s*\d+\s+([\d.]+)/,
        social: /^社\s*会\s+(\d+)\s*\/\s*(\d+)\s+([\d.]+)\s+\d+\s*\/\s*\d+\s+([\d.]+)/
    };

    return Object.entries(patterns).reduce((acc, [key, pattern]) => {
        const line = lines.find((item) => pattern.test(item));
        if (!line) {
            return acc;
        }
        const match = line.match(pattern);
        if (!match) {
            return acc;
        }
        acc[key] = {
            label: SUBJECT_KEYS[key],
            score: Number(match[1]),
            max: Number(match[2]),
            deviation: Number(match[3]),
            average: Number(match[4])
        };
        return acc;
    }, {});
}

function classifyBreakdownTitle(title, currentSubject) {
    const keywordMap = {
        math: ['計算', '小問集合', '損益', '速さ', '割合', '水量', '数表', '図形', '点の移動', '規則性'],
        japanese: ['漢字', '慣用句', '四字熟語', '説明', '文学', '物語', '論説', '読解'],
        science: ['気象', 'アゲハ', '熱', 'てこ', '季節', '生物', '火山', '地震', '燃焼', '光', '電気', '天体', '植物', '人体', 'ばね'],
        social: ['歴史', '地理', '公民', '年表', '地図', '資料', '総合問題', '政治']
    };

    const found = Object.entries(keywordMap).find(([, keywords]) => keywords.some((keyword) => title.includes(keyword)));
    if (found) {
        return found[0];
    }
    return currentSubject;
}

function parseBreakdown(firstPageText = '') {
    const lines = firstPageText.split('\n').map((line) => normalizeDigits(line)).filter(Boolean);
    const breakdown = {
        math: [],
        japanese: [],
        science: [],
        social: []
    };

    let currentSubject = null;
    const entryPattern = /^(\d+)\s+(.+?)\s+(\d+)\s*\/\s*(\d+)\s+([\d.]+)$/;

    lines.forEach((line) => {
        const match = line.match(entryPattern);
        if (!match) {
            return;
        }

        const title = `${match[1]} ${match[2]}`.trim();
        currentSubject = classifyBreakdownTitle(title, currentSubject);
        if (!currentSubject || !breakdown[currentSubject]) {
            return;
        }

        const score = Number(match[3]);
        const max = Number(match[4]);
        const average = Number(match[5]);

        breakdown[currentSubject].push({
            title,
            score,
            max,
            average,
            rate: max > 0 ? Number(((score / max) * 100).toFixed(1)) : 0
        });
    });

    return breakdown;
}

function parseTrend(secondPageText = '') {
    const lines = secondPageText.split('\n').map((line) => normalizeDigits(line)).filter(Boolean);
    const labelLine = lines.find((line) => line.includes('平均偏差値'));
    if (!labelLine) {
        return null;
    }

    const labels = labelLine
        .replace('平均偏差値', '')
        .split(' ')
        .map((item) => item.trim())
        .filter(Boolean);

    const trend = { labels };
    const subjectLineMap = {
        '4科目計': 'total4',
        '算数': 'math',
        '国語': 'japanese',
        '理科': 'science',
        '社会': 'social'
    };

    for (let index = 0; index < lines.length; index += 1) {
        const key = subjectLineMap[compact(lines[index])];
        if (!key) {
            continue;
        }

        const deviationLine = lines[index + 3] || '';
        if (!deviationLine.startsWith('偏差値')) {
            continue;
        }

        const values = deviationLine.match(/[\d.]+/g) || [];
        if (values.length < labels.length) {
            continue;
        }
        trend[key] = values.slice(0, labels.length).map((value) => Number(value));
    }

    return trend;
}

function summarizeBreakdownItems(items = []) {
    if (!items.length) {
        return '分野別の詳細データはまだありません。';
    }

    const strongest = [...items].sort((a, b) => (b.score / b.max) - (a.score / a.max))[0];
    const weakest = [...items].sort((a, b) => (a.score / a.max) - (b.score / b.max))[0];

    return `得点が比較的取れていたのは「${strongest.title}」(${strongest.score}/${strongest.max})、苦戦したのは「${weakest.title}」(${weakest.score}/${weakest.max})です。`;
}

function buildSharedContext(test) {
    const summaryLines = [
        `実施日: ${test.testDate || test.displayName}`,
        `対象テスト: ${test.displayName}`
    ];

    ['total4', 'total3', 'total2', 'math', 'japanese', 'science', 'social'].forEach((key) => {
        const item = test.summary[key];
        if (!item) {
            return;
        }
        summaryLines.push(`${item.label}: ${item.score}/${item.max}点, 偏差値${item.deviation}, 平均${item.average}`);
    });

    if (test.trend?.labels?.length) {
        const trendLines = [
            '',
            '直近の偏差値推移:'
        ];

        ['total4', 'math', 'japanese', 'science', 'social'].forEach((key) => {
            if (!Array.isArray(test.trend[key])) {
                return;
            }
            trendLines.push(`${SUBJECT_KEYS[key]} ${test.trend[key].join(' → ')}`);
        });

        return `${summaryLines.join('\n')}\n${trendLines.join('\n')}`;
    }

    return summaryLines.join('\n');
}

function buildOverallAdvice(test) {
    const subjectStats = SUBJECT_ORDER
        .map((key) => ({ key, ...(test.summary[key] || {}) }))
        .filter((item) => Number.isFinite(item.deviation));

    if (!subjectStats.length) {
        return '今回の成績を見ながら、まずは得点源と立て直し教科を切り分けていきましょう。';
    }

    const strongest = [...subjectStats].sort((a, b) => b.deviation - a.deviation)[0];
    const weakest = [...subjectStats].sort((a, b) => a.deviation - b.deviation)[0];
    const total = test.summary.total4;

    return `今回の${test.displayName}は、4科${total ? `${total.score}/${total.max}点・偏差値${total.deviation}` : 'の結果'}でした。
相対的に支えになっているのは${SUBJECT_KEYS[strongest.key]}、優先して立て直したいのは${SUBJECT_KEYS[weakest.key]}です。
まずは得点源を維持しつつ、苦手教科の基礎と頻出分野を一つずつ戻していきましょう。`;
}

function buildSubjectAdvice(test, subjectKey) {
    const stat = test.summary[subjectKey];
    const breakdown = test.breakdown[subjectKey] || [];
    if (!stat) {
        return `${test.displayName}の${SUBJECT_KEYS[subjectKey]}について、分かる範囲で整理していきましょう。`;
    }

    const strongest = breakdown.length
        ? [...breakdown].sort((a, b) => (b.score / b.max) - (a.score / a.max))[0]
        : null;
    const weakest = breakdown.length
        ? [...breakdown].sort((a, b) => (a.score / a.max) - (b.score / b.max))[0]
        : null;

    const detailLine = strongest && weakest
        ? `分野別では「${strongest.title}」が比較的取れていて、「${weakest.title}」の立て直し余地が大きいです。`
        : '今回は総合点と偏差値を軸に整理していきます。';

    return `${SUBJECT_KEYS[subjectKey]}は${stat.score}/${stat.max}点、偏差値${stat.deviation}、平均${stat.average}でした。
${detailLine}
まずは基本問題の取りこぼしを減らし、次に苦手分野の解き直しサイクルを固定しましょう。`;
}

function buildSubjectContext(test, subjectKey) {
    const stat = test.summary[subjectKey];
    const items = test.breakdown[subjectKey] || [];

    const lines = [];
    if (stat) {
        lines.push(`${SUBJECT_KEYS[subjectKey]}: ${stat.score}/${stat.max}点, 偏差値${stat.deviation}, 平均${stat.average}`);
    }
    if (items.length) {
        lines.push('分野別の内訳:');
        items.forEach((item) => {
            lines.push(`- ${item.title}: ${item.score}/${item.max} (平均${item.average})`);
        });
    }
    lines.push(summarizeBreakdownItems(items));
    return lines.join('\n');
}

function buildChatContexts(tests = []) {
    return tests.reduce((acc, test) => {
        acc[test.id] = {
            testName: test.displayName,
            targetSchool: '吉祥女子中学校',
            studentName: '西村 紬',
            sharedContext: buildSharedContext(test),
            detailPolicy: DETAIL_POLICY,
            subjects: {
                "成績分析": {
                    context: [
                        buildOverallAdvice(test),
                        ...SUBJECT_ORDER.map((key) => buildSubjectContext(test, key))
                    ].join('\n\n'),
                    initialAdvice: buildOverallAdvice(test)
                },
                "4教科": {
                    context: SUBJECT_ORDER.map((key) => buildSubjectContext(test, key)).join('\n\n'),
                    initialAdvice: buildOverallAdvice(test)
                },
                "国語": {
                    context: buildSubjectContext(test, 'japanese'),
                    initialAdvice: buildSubjectAdvice(test, 'japanese')
                },
                "算数": {
                    context: buildSubjectContext(test, 'math'),
                    initialAdvice: buildSubjectAdvice(test, 'math')
                },
                "理科": {
                    context: buildSubjectContext(test, 'science'),
                    initialAdvice: buildSubjectAdvice(test, 'science')
                },
                "社会": {
                    context: buildSubjectContext(test, 'social'),
                    initialAdvice: buildSubjectAdvice(test, 'social')
                }
            }
        };
        return acc;
    }, {});
}

function buildTrendFromTests(tests = []) {
    if (!tests.length) {
        return null;
    }

    const latestWithTrend = [...tests].reverse().find((test) => test.trend?.labels?.length);
    if (latestWithTrend) {
        return latestWithTrend.trend;
    }

    const labels = tests.map((test) => test.chartLabel);
    const trend = { labels };
    ['total4', 'math', 'japanese', 'science', 'social'].forEach((key) => {
        trend[key] = tests
            .map((test) => test.summary[key]?.deviation)
            .filter((value) => Number.isFinite(value));
    });
    return trend;
}

async function parseTestPdf(entry) {
    const PDFParse = getPdfParseConstructor();
    const buffer = fs.readFileSync(entry.pdfPath);
    const parser = new PDFParse({ data: buffer });

    try {
        const pdf = await parser.getText();
        const pages = splitPages(pdf.text);
        const meta = extractFolderMeta(entry.folderName);
        const firstPageText = pages[1] || pdf.text;
        const secondPageText = pages[2] || '';

        return {
            id: meta.id,
            folderName: entry.folderName,
            displayName: meta.displayName,
            chartLabel: meta.chartLabel,
            testDate: extractTestDate(firstPageText, meta),
            pdfPath: path.relative(process.cwd(), entry.pdfPath),
            summary: parseSummary(firstPageText),
            breakdown: parseBreakdown(firstPageText),
            trend: parseTrend(secondPageText)
        };
    } finally {
        if (typeof parser.destroy === 'function') {
            await parser.destroy();
        }
    }
}

async function buildTestResultsManifest() {
    const entries = listPdfFolders();
    const tests = [];

    for (const entry of entries) {
        // Keep parsing serial to avoid memory spikes on Vercel.
        tests.push(await parseTestPdf(entry));
    }

    const latestTest = tests[tests.length - 1] || null;
    const trend = buildTrendFromTests(tests);

    return {
        generatedAt: new Date().toISOString(),
        latestTestId: latestTest?.id || null,
        latestTest,
        tests,
        chatTests: tests.map((test) => ({
            id: test.id,
            label: test.displayName
        })),
        trend,
        chatContexts: buildChatContexts(tests)
    };
}

module.exports = {
    buildTestResultsManifest
};
