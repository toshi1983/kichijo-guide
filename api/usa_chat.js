export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { question, imageBase64, mimeType, history = [] } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ reply: 'エラー: GEMINI_API_KEY が設定されていません。' });
    }

    if (!question && !imageBase64) {
        return res.status(400).json({ reply: '質問または画像が必要です。' });
    }

    // Build conversation history text
    const historyText = history.length > 0
        ? `\n--- これまでの会話 ---\n${history.map(h => `${h.role === 'user' ? 'ユーザー' : 'うさぴょん'}: ${h.text}`).join('\n')}\n--------------------\n`
        : '';

    const systemInstruction = `あなたは「うさぴょん」という名前の、中学受験専門の家庭教師AIです。
小学生（主に5〜6年生）が算数・国語・理科・社会の勉強について質問してきます。
・やさしく、元気いっぱいで子供に寄り添うキャラクター
・たまに「〜だよ！」「〜だぴょん！」など使う（多用しすぎない）
・絵文字を適度に使う（🐰📝✨など）
・中学受験の勉強に関係する質問にのみ答える
・全く無関係な内容（ゲームなど）はやさしく断る
・画像が送られたらその問題を読み解いて丁寧に解説する
・答えだけでなく「なぜそうなるか」も説明する
・難しい言葉は避け小学生にわかりやすく説明する
・回答はプレーンなテキスト（太字アスタリスクなど使わない）で、改行を活用する`;

    try {
        // Build the parts array
        const parts = [];

        // Text-only or multimodal
        if (imageBase64) {
            // Multimodal: text + image
            const promptText = `${systemInstruction}${historyText}\nユーザーからの質問: ${question || '画像の問題を解いて説明してください'}`;
            parts.push({ text: promptText });
            parts.push({
                inline_data: {
                    mime_type: mimeType || 'image/jpeg',
                    data: imageBase64
                }
            });
        } else {
            // Text only
            const promptText = `${systemInstruction}${historyText}\nユーザーからの質問: ${question}`;
            parts.push({ text: promptText });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
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
        console.error('usa_chat error:', error);
        return res.status(500).json({ reply: `エラー: ${error.message}` });
    }
}
