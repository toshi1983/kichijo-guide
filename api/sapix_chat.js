const staticTestContexts = require('../data/sapix_test_context.js');
const { buildTestResultsManifest } = require('../data/test_results_service.js');

let cachedTestContexts = staticTestContexts;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function sanitizeText(value, maxLength = 500) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function getQuotaFallbackMessage(subjectConfig) {
    const baseAdvice = subjectConfig?.initialAdvice
        ? `${subjectConfig.initialAdvice}\n\nいまはAI側の利用制限に当たっているため、追加の個別回答は少し待ってから再試行してください。`
        : 'いまはAI側の利用制限に当たっているため、少し待ってから再試行してください。';

    return `${baseAdvice}\n\n図や問題文そのものを見ながら確認したい場合は、うさトークで画像を送る方法が確実です。`;
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { question, testPeriod, subject, history = [] } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    const sanitizedQuestion = String(question || '').trim().slice(0, 1500);
    const sanitizedHistory = Array.isArray(history)
        ? history
            .slice(-6)
            .map((item) => ({
                role: item?.role === 'user' ? 'user' : 'bot',
                text: sanitizeText(item?.text)
            }))
            .filter((item) => item.text)
        : [];

    if (!apiKey) {
        return res.status(500).json({ reply: 'エラー: GEMINI_API_KEY が設定されていません。' });
    }

    if (!sanitizedQuestion || !testPeriod || !subject) {
        return res.status(400).json({ reply: '質問、テスト時期、科目が必要です。' });
    }

    if ((Date.now() - cachedAt) > CACHE_TTL_MS) {
        try {
            const manifest = await buildTestResultsManifest();
            cachedTestContexts = {
                ...(manifest.chatContexts || {}),
                ...staticTestContexts
            };
            cachedAt = Date.now();
        } catch (error) {
            console.error('sapix_chat manifest refresh error:', error);
            cachedTestContexts = staticTestContexts;
        }
    }

    const testConfig = cachedTestContexts[testPeriod];
    if (!testConfig) {
        return res.status(400).json({ reply: '指定されたテスト時期が見つかりません。' });
    }

    const subjectConfig = testConfig.subjects[subject];
    if (!subjectConfig) {
        return res.status(400).json({ reply: '指定された科目が見つかりません。' });
    }

    if (sanitizedQuestion === '__GET_ADVICE__') {
        return res.status(200).json({ reply: subjectConfig.initialAdvice });
    }

    const historyText = sanitizedHistory.length > 0
        ? `\n--- これまでの会話 ---\n${sanitizedHistory.map((item) => `${item.role === 'user' ? 'ユーザー' : '講師'}: ${item.text}`).join('\n')}\n--------------------\n`
        : '';

    const isSpecificQuestion = /大問|小問|問\d|[（(]\d+[)）]|図|表|グラフ|選択肢|本文/.test(sanitizedQuestion);

    const prompt = `あなたはサピックス（SAPIX）のカリスマ塾講師です。
生徒は${testConfig.targetSchool}を第一志望として目指しています。
今回扱うのは「${testConfig.testName}」の${subject}です。

【重要ルール】
- 回答はやさしく、論理的で、前向きにする
- プレーンなテキストで、改行を使って読みやすくする
- 必要な範囲で簡潔に答える
- 手元にある情報だけで誠実に答える
- 見えていない問題文や図を想像で作らない

【参照可能なテスト情報】
${testConfig.sharedContext}

【${subject}の整理メモ】
${subjectConfig.context}

【詳細質問時の扱い】
${testConfig.detailPolicy}

${isSpecificQuestion ? '【追加注意】ユーザーはかなり具体的な問題を聞いています。問題文や図が見えていない場合は、その限界を最初に短く伝えたうえで、一般的な考え方や復習手順を案内してください。' : ''}
${historyText}
ユーザーからの質問: ${sanitizedQuestion}`;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 700
                }
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error('Gemini API Error:', JSON.stringify(data.error));
            if (data.error.status === 'RESOURCE_EXHAUSTED') {
                return res.status(200).json({ reply: getQuotaFallbackMessage(subjectConfig) });
            }
            return res.status(500).json({ reply: `エラー: ${data.error.message}` });
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!reply) {
            console.error('No reply in response:', JSON.stringify(data));
            return res.status(500).json({ reply: 'AIからの返答を取得できませんでした。' });
        }

        return res.status(200).json({ reply });
    } catch (error) {
        console.error('sapix_chat error:', error);
        return res.status(500).json({ reply: `エラー: ${error.message}` });
    }
}
