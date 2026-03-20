export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { question, school, history = [], isPlanner = false } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  const extractPlannerDateLabel = (value) => {
    const match = String(value || '').match(/「([^」]+)」の計画/);
    return match?.[1] || '今日';
  };

  const stripPlannerContext = (value) => String(value || '')
    .replace(/^※現在ユーザーはカレンダー上の「[^」]+」の計画について相談しています。\s*/u, '')
    .trim();

  const buildPlannerFallback = (value, reason = '') => {
    const requestText = stripPlannerContext(value);
    const dateLabel = extractPlannerDateLabel(value);
    const isRestDay = /(休み|休日|春休み|夏休み|冬休み|土曜|日曜|祝日)/.test(requestText);
    const focusMath = /(算数|計算|図形|割合|速さ)/.test(requestText);
    const focusJapanese = /(国語|読解|漢字|記述)/.test(requestText);

    const studyBlock1 = focusMath ? '算数 45分\n  計算と一行題でウォームアップ後、苦手単元を1つ解き直す' : '算数 40分\n  計算 10分 + 苦手単元 30分';
    const studyBlock2 = focusJapanese ? '国語 40分\n  読解1題または知識分野の復習、最後に漢字 10分' : '国語 35分\n  読解または語句 1セット';
    const reviewBlock = '間違い直し 20分\n  できなかった問題だけに絞ってやり直す';
    const memoryBlock = '理科・社会 25分\n  暗記カードや要点確認を1テーマずつ';

    const schedule = isRestDay
      ? [
        `- [ ] 09:00-09:15 予定確認\n  今日やることを3つに絞る`,
        `- [ ] 09:15-10:00 ${studyBlock1}`,
        `- [ ] 10:15-10:55 ${studyBlock2}`,
        `- [ ] 11:10-11:35 ${memoryBlock}`,
        `- [ ] 14:00-14:40 ${reviewBlock}`,
        `- [ ] 14:50-15:20 音読または確認テスト\n  その日の仕上げとして短時間で見直す`
      ]
      : [
        `- [ ] 帰宅後 15分 休憩と準備\n  宿題と学習道具を整える`,
        `- [ ] 1コマ目 35-40分 ${studyBlock1}`,
        `- [ ] 休憩 10分`,
        `- [ ] 2コマ目 30-35分 ${studyBlock2}`,
        `- [ ] 3コマ目 20-25分 ${memoryBlock}`,
        `- [ ] 最後 15-20分 ${reviewBlock}`
      ];

    const reasonLine = reason
      ? `AI計画作成が一時的に不安定だったため、まずはすぐ使えるたたき台を返します。`
      : `まずは実行しやすい形で、${dateLabel}用のたたき台を作りました。`;

    return `${reasonLine}

対象日: ${dateLabel}
相談内容: ${requestText || '学習計画の作成'}

おすすめ計画
${schedule.join('\n')}

進め方のコツ
- 最初に「絶対やるもの」を2つ決める
- 各コマが終わったらチェックを付ける
- 終わらなかった分は翌日に回すより、今日のうちに5分だけ見直しておく

必要なら次に、
1. 算数を重めにする版
2. 4科目バランス版
3. 夜だけ短時間版
のどれかに絞って作り直せます。`;
  };

  const extractReplyText = (data) => {
    const parts = data?.candidates?.flatMap((candidate) => candidate?.content?.parts || []) || [];
    return parts
      .map((part) => typeof part?.text === 'string' ? part.text.trim() : '')
      .find(Boolean) || '';
  };

  const sanitizeText = (value, maxLength = 700) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
  const sanitizedQuestion = String(question || '').trim().slice(0, 1800);
  const sanitizedHistory = Array.isArray(history)
    ? history
      .slice(-8)
      .map((item) => ({
        isUser: Boolean(item?.isUser),
        text: sanitizeText(item?.text)
      }))
      .filter((item) => item.text)
    : [];

  if (!apiKey) {
    if (isPlanner) {
      return res.status(200).json({ reply: buildPlannerFallback(sanitizedQuestion, 'missing_api_key'), fallback: true });
    }
    return res.status(500).json({ reply: "エラー: Vercel環境変数にGEMINI_API_KEYが設定されていません。" });
  }

  if (!isPlanner && (!sanitizedQuestion || !school)) {
    return res.status(400).json({ reply: "質問と学校名が必要です。" });
  }

  if (isPlanner && !sanitizedQuestion) {
    return res.status(400).json({ reply: "質問が必要です。" });
  }

  // Build conversational history text if it exists
  const historyText = sanitizedHistory.length > 0
    ? `\n--- これまでの会話履歴 ---\n${sanitizedHistory.map(h => `${h.isUser ? '質問者' : 'AI'}: ${h.text}`).join('\n')}\n--------------------\n`
    : '';

  let prompt = "";
  if (isPlanner) {
    prompt = `あなたは中学受験に向けた子供の勉強計画を作成する、専属のプロフェッショナルAIコーチです。
ユーザー（保護者または受験生）の要望を聞き、無理がなく、かつ効果的な勉強スケジュールや学習メニューを具体的に提案してください。

【重要ルール】
あなたは中学受験や学習に関する専用のAIアシスタントです。もし中学受験、学習内容、勉強方法、スケジュール管理とは全く関係のない話題（例：プログラミング、料理のレシピ、ニュース、一般的な雑談など）を質問された場合は、絶対にその質問には答えず、「申し訳ありません、私は中学受験・学習サポート専用のアシスタントです。勉強の計画や受験に関するご相談のみ承っております。」と丁寧にお断りしてください。

※回答は文字の装飾(太字のためのアスタリスクなど)を極力使わずプレーンなテキストにし、適度に改行を入れてください。
※スケジュールを表やリストで提示する場合は、Markdown形式（箇条書きには「- 」、タスクのチェックボックスには「- [ ] 」など）を使ってきれいに整理してください。特に、達成度がわかるようにチェックボックス([ ])を使うと効果的です。
${historyText}
ユーザーからの要望: ${sanitizedQuestion}`;
  } else {
    prompt = `あなたは中学受験のプロフェッショナルAIアドバイザーです。
質問者が志望している学校は「${school}」です。
この学校の出題傾向や入試情報、その他学習に関する質問に対して、専門的かつ分かりやすく、そして受験生や保護者を励ますようなトーンで丁寧に答えてください。

【重要ルール】
あなたは中学受験や学習に関する専用のAIアシスタントです。もし中学受験、学校選び、学習内容、勉強方法とは全く関係のない話題（例：プログラミング、料理のレシピ、ニュース、一般的な雑談など）を質問された場合は、絶対にその質問には答えず、「申し訳ありません、私は中学受験サポート専用のアシスタントですので、志望校や学習についてのご相談にのみお答えしております。」と丁寧にお断りしてください。

※回答は文字の装飾(太字のためのアスタリスクなど)を極力使わずプレーンなテキストにし、適度に改行を入れてください。
※長くなりすぎず、要点を絞って答えてください。
${historyText}
質問: ${sanitizedQuestion}`;
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
          maxOutputTokens: 700,
        }
      })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || data?.error) {
      const errorMessage = data?.error?.message || `HTTP ${response.status}`;
      console.error("Gemini API Error:", errorMessage);
      if (isPlanner) {
        return res.status(200).json({ reply: buildPlannerFallback(sanitizedQuestion, errorMessage), fallback: true });
      }
      return res.status(500).json({ reply: `エラー: API連携に失敗しました。(${errorMessage})` });
    }

    const reply = extractReplyText(data);

    if (!reply) {
      console.error("Gemini API Error: empty response", data);
      if (isPlanner) {
        return res.status(200).json({ reply: buildPlannerFallback(sanitizedQuestion, 'empty_response'), fallback: true });
      }
      return res.status(500).json({ reply: "エラー: AIの返答を取得できませんでした。" });
    }

    res.status(200).json({ reply });

  } catch (error) {
    console.error("Fetch Error:", error);
    if (isPlanner) {
      return res.status(200).json({ reply: buildPlannerFallback(sanitizedQuestion, error?.message || 'fetch_error'), fallback: true });
    }
    res.status(500).json({ reply: "エラー: 予期せぬネットワークエラーが発生しました。" });
  }
}
