export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { question, imageBase64, mimeType, history } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY が設定されていません' });
    }

    if (!question && !imageBase64) {
        return res.status(400).json({ error: 'question or image is required' });
    }

    const systemInstruction = `あなたは「うさぴょん」という名前の、中学受験専門の家庭教師AIです。
小学生（主に5〜6年生）の生徒が算数・国語・理科・社会の勉強について質問してきます。

【キャラクター設定】
- 名前：うさぴょん
- 性格：やさしく、元気いっぱいで、子供に寄り添う
- 語尾：たまに「〜だよ！」「〜だぴょん！」などを使う（多用しすぎない）
- 絵文字やアイコンを適度に使う（🐰📝✨など）

【ルール】
- 中学受験の勉強に関係する質問にのみ答える
- 算数、国語、理科、社会、おすすめの暗記方法や勉強の仕方も答えてよい
- 全く無関係な内容（ゲーム、芸能人など）は、やさしく断って勉強の話に戻す
- 画像が送られてきたら、その問題をしっかり読み解いて丁寧に解説する
- 答えだけでなく「なぜそうなるか」の理由も説明する
- 難しい言葉は避け、小学生にわかりやすく説明する
- 回答はシンプルで読みやすい形式にする（箇条書きや改行を活用）
- 回答の装飾（太字のアスタリスクなど）は使わず、プレーンなテキストにする`;

    // Build parts array for Gemini API
    const parts = [];
    parts.push({ text: systemInstruction });

    // Add conversation history
    if (history && history.length > 0) {
        const histText = history.slice(-6).map(h =>
            `${h.role === 'user' ? 'ユーザー' : 'うさぴょん'}: ${h.text}`
        ).join('\n');
        parts.push({ text: `\n【これまでの会話】\n${histText}\n` });
    }

    // Add image if provided
    if (imageBase64) {
        parts.push({
            inline_data: {
                data: imageBase64,
                mime_type: mimeType || 'image/jpeg'
            }
        });
    }

    // Add user question
    parts.push({ text: `\nユーザーからの質問: ${question || '(画像の問題を解いて説明してください)'}` });

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
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
            console.error('Gemini API Error:', data.error);
            return res.status(500).json({ error: data.error.message });
        }

        const reply = data.candidates[0].content.parts[0].text;
        return res.status(200).json({ reply });

    } catch (error) {
        console.error('usa_chat error:', error);
        return res.status(500).json({ error: 'AI response failed: ' + error.message });
    }
}
