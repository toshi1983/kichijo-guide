const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { question, imageBase64, mimeType, history } = req.body;

    if (!question && !imageBase64) {
        return res.status(400).json({ error: 'question or image is required' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
- 回答はシンプルで読みやすい形式にする（箇条書きや改行を活用）`;

        const parts = [];

        // System instruction as first part
        parts.push({ text: systemInstruction });

        // Add conversation history
        if (history && history.length > 0) {
            for (const entry of history.slice(-6)) { // Last 6 exchanges
                parts.push({ text: `\n【過去のやり取り】\n${entry.role === 'user' ? 'ユーザー' : 'うさぴょん'}: ${entry.text}` });
            }
        }

        // Add image if provided
        if (imageBase64) {
            parts.push({
                inlineData: {
                    data: imageBase64,
                    mimeType: mimeType || 'image/jpeg'
                }
            });
            parts.push({ text: `\nユーザーからの質問: ${question || 'この問題を解いて説明してください'}` });
        } else {
            parts.push({ text: `\nユーザーからの質問: ${question}` });
        }

        const result = await model.generateContent(parts);
        const reply = result.response.text();

        return res.status(200).json({ reply });

    } catch (error) {
        console.error('usa_chat error:', error);
        return res.status(500).json({ error: 'AI response failed', detail: error.message });
    }
}
