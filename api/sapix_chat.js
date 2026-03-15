const testContexts = require('../data/sapix_test_context.js');
const fs = require('fs');
const path = require('path');

function sanitizeText(value, maxLength = 500) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export default async function handler(req, res) {
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

    const testConfig = testContexts[testPeriod];
    if (!testConfig) {
        return res.status(400).json({ reply: '指定されたテスト時期が見つかりません。' });
    }

    const subjectConfig = testConfig.subjects[subject];
    if (!subjectConfig) {
        return res.status(400).json({ reply: '指定された科目が見つかりません。' });
    }

    // Determine PDF paths based on testPeriod and subject
    const folderName = testPeriod === '2026_03_kumiwake' ? '2026-３月組分けテスト' : '';
    const testDir = path.join(process.cwd(), 'テスト結果', folderName);
    let pdfPaths = [];

    if (subject === '成績分析') {
        const scorePdf = path.join(testDir, '個人成績票.pdf');
        if (fs.existsSync(scorePdf)) pdfPaths.push(scorePdf);
    } else if (subject === '4教科') {
        const subs = ['国語', '算数', '理科', '社会'];
        subs.forEach(s => {
            const p = path.join(testDir, `三月度組分けテスト　${s}.pdf`);
            if (fs.existsSync(p)) pdfPaths.push(p);
        });
        const ans = path.join(testDir, '三月度組分けテスト　解答.pdf');
        if (fs.existsSync(ans)) pdfPaths.push(ans);
    } else {
        const subPdf = path.join(testDir, `三月度組分けテスト　${subject}.pdf`);
        const ansPdf = path.join(testDir, '三月度組分けテスト　解答.pdf');
        if (fs.existsSync(subPdf)) pdfPaths.push(subPdf);
        if (fs.existsSync(ansPdf)) pdfPaths.push(ansPdf);
    }

    const historyText = sanitizedHistory.length > 0
        ? `\n--- これまでの会話 ---\n${sanitizedHistory.map((item) => `${item.role === 'user' ? 'ユーザー' : '講師'}: ${item.text}`).join('\n')}\n--------------------\n`
        : '';

    const systemInstruction = `あなたはサピックス（SAPIX）のカリスマ塾講師です。
生徒（西村 紬さん）は現在「${testConfig.targetSchool}」を第一志望として目指しており、今回のテスト結果に少し落ち込んでいます。
あなたの使命は、提供されたテスト資料（PDF）と成績データに基づき、論理的かつ情熱的にアドバイスを送ることです。

【重要方針】
・結果は重く受け止めつつも、決して突き放さず、やる気が出るようなポジティブな声かけをしてください。
・今の立ち位置を客観的に伝えつつ、合格に向けた具体的なアクションプランを提示してください。
・「厳しいことを言うようだけど、ここを乗り越えれば合格が見えてくるよ」という、愛のある指導を心がけてください。
・回答はプレーンなテキスト（またはMarkdown）で、改行を活用して読みやすくしてください。

【生徒の成績状況】
${testConfig.sharedContext}

【${subject}の分析状況】
${subjectConfig.context}
`;

    let promptText = "";
    if (sanitizedQuestion === '__GET_ADVICE__') {
        promptText = `${systemInstruction}\n指示: 添付のPDF（問題・解答・成績表）を読み込んでください。そして、この科目の成績を上げるために、今後どう勉強・対策すればよいか、具体的なアドバイスを作成してください。`;
    } else {
        promptText = `${systemInstruction}${historyText}\nユーザーからの質問: ${sanitizedQuestion}\n※添付のPDFを参考にして、具体的に解説やアドバイスを行ってください。`;
    }

    let contents = [{
        parts: [{ text: promptText }]
    }];

    // Read PDFs
    pdfPaths.forEach(p => {
        try {
            const data = fs.readFileSync(p);
            contents[0].parts.push({
                inline_data: {
                    mime_type: 'application/pdf',
                    data: data.toString('base64')
                }
            });
        } catch (e) {
            console.error(`Error reading PDF ${p}:`, e);
        }
    });

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 1024
                }
            })
        });

        const data = await response.json();
        if (data.error) {
            console.error('Gemini API Error:', JSON.stringify(data.error));
            return res.status(500).json({ reply: `エラー: ${data.error.message}` });
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!reply) {
            return res.status(500).json({ reply: 'AIからの返答を取得できませんでした。' });
        }

        return res.status(200).json({ reply });
    } catch (error) {
        console.error('sapix_chat error:', error);
        return res.status(500).json({ reply: `エラー: ${error.message}` });
    }
}
