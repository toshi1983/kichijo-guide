export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { question, testPeriod, subject, history = [] } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ reply: 'エラー: GEMINI_API_KEY が設定されていません。' });
    }

    if (!question || !testPeriod || !subject) {
        return res.status(400).json({ reply: '質問、テスト時期、科目が必要です。' });
    }

    const fs = require('fs');
    const path = require('path');

    // フォルダ名とファイル名のマッピング
    const folderName = testPeriod === '2026_03_kumiwake' ? '2026-３月組分けテスト' : '';

    if (!folderName) {
        return res.status(400).json({ reply: '指定されたテスト時期が見つかりません。' });
    }

    const testDir = path.join(process.cwd(), 'テスト結果', folderName);

    let parts = [];

    const systemInstruction = `あなたはサピックス（SAPIX）のカリスマ塾講師です。
生徒（新6年生）は現在「吉祥女子中学校」を第一志望として目指しており、今回のテスト結果に少し落ち込んでいます。
あなたの使命は、以下のSAPIXのテスト資料に基づき、論理的かつ情熱的にアドバイスを送ることです。

【重要方針】
・結果は重く受け止めつつも、決して突き放さず、やる気が出るようなポジティブな声かけをしてください。
・「吉祥女子合格」という目標に向けて、今の立ち位置を客観的に伝え、あと何が足りないのか、具体的な勉強法を提示してください。
・「厳しいことを言うようだけど、ここを乗り越えれば合格が見えてくるよ」という、愛のある厳しさを心がけてください。
・やさしく、わかりやすく、論理的な解説とアドバイスを行ってください。
・回答はプレーンなテキスト（またはMarkdown）で、改行を活用して読みやすくしてください。
`;

    // これまでの会話履歴
    const historyText = history.length > 0
        ? `\n--- これまでの会話 ---\n${history.map(h => `${h.role === 'user' ? 'ユーザー' : '講師'}: ${h.text}`).join('\n')}\n--------------------\n`
        : '';

    if (subject === '成績分析') {
        let promptText = "";
        if (question === "__GET_ADVICE__") {
            promptText = `${systemInstruction}\n指示: 添付の「個人成績票」を徹底的に分析してください。
今回の偏差値や各科目の得点、正答率の傾向を見て、吉祥女子合格に向けて「今の弱点」と「今後1ヶ月で取り組むべき最優先事項」を4教科それぞれ具体的にアドバイスしてください。
子供がまた明日から頑張ろうと思えるような、力強い激励の言葉も最後にかけてください。`;
        } else {
            promptText = `${systemInstruction}${historyText}\n個人成績票に基づく質問: ${question}`;
        }
        parts.push({ text: promptText });

        const scorePdfPath = path.join(testDir, '個人成績票.pdf');
        if (fs.existsSync(scorePdfPath)) {
            try {
                const data = fs.readFileSync(scorePdfPath);
                parts.push({
                    inline_data: { mime_type: 'application/pdf', data: data.toString('base64') }
                });
            } catch (e) {
                console.error(`Error reading ${scorePdfPath}:`, e);
            }
        }
    } else if (subject === '4教科') {
        let promptText = "";
        if (question === "__GET_ADVICE__") {
            promptText = `${systemInstruction}\n指示: 添付の「今回のテスト問題（4教科分）と解答」を徹底的に読み込んでください。
吉祥女子を目指すにあたって、今回の4教科全体の傾向はどう対策すべきか。
復習のポイント、バランスの良い学習方法などを踏まえ、大変わかりやすくてやる気の出るアドバイスを作成してください。最後に子供にエールを送ってください。`;
        } else {
            promptText = `${systemInstruction}${historyText}\nユーザーからの質問: ${question}\n※添付のPDF（問題と解答）を参考にして具体的に解説してください。`;
        }
        parts.push({ text: promptText });

        const subjects4 = ['国語', '算数', '理科', '社会'];
        for (const sub of subjects4) {
            const subName = `三月度組分けテスト　${sub}.pdf`;
            const subPdfPath = path.join(testDir, subName);
            if (fs.existsSync(subPdfPath)) {
                try {
                    const data = fs.readFileSync(subPdfPath);
                    parts.push({
                        inline_data: { mime_type: 'application/pdf', data: data.toString('base64') }
                    });
                } catch (e) {
                    console.error(`Error reading ${subPdfPath}:`, e);
                }
            }
        }

        const answerFileName = `三月度組分けテスト　解答.pdf`;
        const answerPdfPath = path.join(testDir, answerFileName);
        if (fs.existsSync(answerPdfPath)) {
            try {
                const data = fs.readFileSync(answerPdfPath);
                parts.push({
                    inline_data: { mime_type: 'application/pdf', data: data.toString('base64') }
                });
            } catch (e) {
                console.error(`Error reading ${answerPdfPath}:`, e);
            }
        }
    } else {
        let promptText = "";
        if (question === "__GET_ADVICE__") {
            promptText = `${systemInstruction}\n指示: 添付の「今回のテスト問題と解答」を徹底的に読み込んでください。
この科目が吉祥女子合格の武器になるように、今後どう勉強・対策すればよいか（復習のポイント、解き方のコツなど）を踏まえ、やる気の出るアドバイスを作成してください。`;
        } else {
            promptText = `${systemInstruction}${historyText}\nユーザーからの質問: ${question}\n※添付のPDF（問題と解答）を参考にして具体的に解説してください。`;
        }
        parts.push({ text: promptText });

        const subjectFileName = `三月度組分けテスト　${subject}.pdf`;
        const answerFileName = `三月度組分けテスト　解答.pdf`;
        const subjectPdfPath = path.join(testDir, subjectFileName);
        const answerPdfPath = path.join(testDir, answerFileName);

        if (fs.existsSync(subjectPdfPath)) {
            try {
                const data = fs.readFileSync(subjectPdfPath);
                parts.push({
                    inline_data: { mime_type: 'application/pdf', data: data.toString('base64') }
                });
            } catch (e) {
                console.error(`Error reading ${subjectPdfPath}:`, e);
            }
        }

        if (fs.existsSync(answerPdfPath)) {
            try {
                const data = fs.readFileSync(answerPdfPath);
                parts.push({
                    inline_data: { mime_type: 'application/pdf', data: data.toString('base64') }
                });
            } catch (e) {
                console.error(`Error reading ${answerPdfPath}:`, e);
            }
        }
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { temperature: 0.7 }
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error('Gemini API Error:', JSON.stringify(data.error));
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
