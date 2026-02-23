export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { question, school, history = [], isPlanner = false } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ reply: "エラー: Vercel環境変数にGEMINI_API_KEYが設定されていません。" });
  }

  if (!isPlanner && (!question || !school)) {
    return res.status(400).json({ reply: "質問と学校名が必要です。" });
  }

  if (isPlanner && !question) {
    return res.status(400).json({ reply: "質問が必要です。" });
  }

  // Build conversational history text if it exists
  const historyText = history.length > 0
    ? `\n--- これまでの会話履歴 ---\n${history.map(h => `${h.isUser ? '質問者' : 'AI'}: ${h.text}`).join('\n')}\n--------------------\n`
    : '';

  let prompt = "";
  if (isPlanner) {
    prompt = `あなたは中学受験に向けた子供の勉強計画を作成する、専属のプロフェッショナルAIコーチです。
ユーザー（保護者または受験生）の要望を聞き、無理がなく、かつ効果的な勉強スケジュールや学習メニューを具体的に提案してください。
※回答は文字の装飾(太字のためのアスタリスクなど)を極力使わずプレーンなテキストにし、適度に改行を入れてください。
※スケジュールを表やリストで提示する場合は、Markdown形式（箇条書きには「- 」、タスクのチェックボックスには「- [ ] 」など）を使ってきれいに整理してください。特に、達成度がわかるようにチェックボックス([ ])を使うと効果的です。
${historyText}
ユーザーからの要望: ${question}`;
  } else {
    prompt = `あなたは中学受験のプロフェッショナルAIアドバイザーです。
質問者が志望している学校は「${school}」です。
この学校の出題傾向や入試情報、その他学習に関する以下の質問に対して、専門的かつ分かりやすく、そして受験生や保護者を励ますようなトーンで丁寧に答えてください。
※回答は文字の装飾(太字のためのアスタリスクなど)を極力使わずプレーンなテキストにし、適度に改行を入れてください。
${historyText}
質問: ${question}`;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("Gemini API Error:", data.error);
      return res.status(500).json({ reply: `エラー: API連携に失敗しました。(${data.error.message})` });
    }

    const reply = data.candidates[0].content.parts[0].text;
    res.status(200).json({ reply });

  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({ reply: "エラー: 予期せぬネットワークエラーが発生しました。" });
  }
}
