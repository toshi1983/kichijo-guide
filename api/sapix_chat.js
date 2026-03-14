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

    // 科目に基づくファイル名（全角スペースを含む）
    const subjectFileName = `三月度組分けテスト　${subject}.pdf`;
    const answerFileName = `三月度組分けテスト　解答.pdf`;

    const subjectPdfPath = path.join(testDir, subjectFileName);
    const answerPdfPath = path.join(testDir, answerFileName);

    let parts = [];

    const systemInstruction = `あなたはサピックス（SAPIX）のカリスマ塾講師です。以下のSAPIXのテスト（問題文と解答解説）を参照し、生徒の質問に答えてください。
・やさしく、わかりやすく、そして論理的に解説してください。
・答え合わせだけでなく、「なぜそうなるのか」「どう考えれば解けるのか」というアプローチや考え方に重点を置いてください。
・小学生（新6年生）が理解できる言葉遣いを心がけてください。
・回答はプレーンなテキストで、改行を活用して読みやすくしてください。
`;

    // これまでの会話履歴
    const historyText = history.length > 0
        ? `\n--- これまでの会話 ---\n${history.map(h => `${h.role === 'user' ? 'ユーザー' : '講師'}: ${h.text}`).join('\n')}\n--------------------\n`
        : '';

    let promptText = "";
    if (question === "__GET_ADVICE__") {
        promptText = `${systemInstruction}\n指示: 添付の「今回のテスト問題と解答」を徹底的に読み込んでください。そして、このテストを受けた小学生（新6年生）が、今後この科目の成績を上げるためにどう勉強・対策すればよいか、全体的な傾向や復習のポイント、テスト中の時間配分・考え方のコツなどを踏まえ、大変わかりやすくてやる気の出るアドバイスを作成して教えてください。箇条書きなども使って読みやすくしてください。`;
    } else {
        promptText = `${systemInstruction}${historyText}\nユーザーからの質問: ${question}\n※添付のPDF（問題と解答）を参考にして具体的に解説してください。`;
    }
    
    parts.push({ text: promptText });

    // PDFの読み込みとB64エンコード
    if (fs.existsSync(subjectPdfPath)) {
        try {
            const data = fs.readFileSync(subjectPdfPath);
            parts.push({
                inline_data: {
                    mime_type: 'application/pdf',
                    data: data.toString('base64')
                }
            });
        } catch (e) {
            console.error(`Error reading ${subjectPdfPath}:`, e);
        }
    } else {
        console.warn(`File not found: ${subjectPdfPath}`);
    }

    if (fs.existsSync(answerPdfPath)) {
        try {
            const data = fs.readFileSync(answerPdfPath);
            parts.push({
                inline_data: {
                    mime_type: 'application/pdf',
                    data: data.toString('base64')
                }
            });
        } catch (e) {
            console.error(`Error reading ${answerPdfPath}:`, e);
        }
    } else {
        console.warn(`File not found: ${answerPdfPath}`);
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
