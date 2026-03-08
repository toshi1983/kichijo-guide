# 中学受験対策ツールのネットワーク構成

作成された中学受験対策ツール（Webアプリケーション）のネットワーク構成は、**「フロントエンド（ブラウザ） ↔ サーバーレス関数（Vercel） ↔ 外部AI（Gemini API）」**という3層構造（3層アーキテクチャ）になっています。

## 全体構成図（データフロー）

```text
[ユーザーの端末 (ブラウザ)] 
      │
      │ ① HTTP POST リクエスト (質問テキスト, 画像データ, 会話履歴)
      ↓
[Vercel Serverless Functions (バックエンド)]  <-- APIキーをここで安全に管理
  ・ /api/chat.js (学習相談・計画用)
  ・ /api/usa_chat.js (うさぴょん先生用)
      │
      │ ② HTTPS リクエスト (プロンプト生成 + Gemini API呼び出し)
      ↓
[Google Gemini API (外部サービス)]
  ・ gemini-2.5-flash モデル
```

## 1. フロントエンド層（クライアント / ブラウザ）
* **該当ファイル:** `usa_talk.html`, `planner.html`, `school_research.html` などのHTML/JS群
* **役割:** ユーザーからのテキスト入力や画像アップロードを受け付けます。その後、入力データをJSON形式（画像はBase64エンコード）にまとめ、自分自身のサーバーの `/api/...` エンドポイントに向けて **HTTP POSTリクエスト** を送信します。
* **特徴:** この層にはAPIキーや複雑なビジネスロジックを持たせず、純粋なユーザーインターフェースとしての機能に特化しています。

## 2. バックエンド層（Vercel Serverless Functions）
* **該当ファイル:** `api/chat.js`, `api/usa_chat.js`
* **役割:** ブラウザから送られてきたデータ（質問・画像・会話履歴など）を受け取る **中継サーバー（APIルーティング）** として機能します。受け取ったデータに「プロンプト（AIの性格設定や役割などのシステム指示）」を付与し、GoogleのGemini APIへリクエストを転送します。
* **セキュリティ・ネットワーク上のメリット:** ブラウザのJavaScriptから直接Gemini APIにアクセスすると、ソースコード上にAPIキーが漏洩してしまいます。間にこのVercelのサーバーレス関数を挟み、環境変数 `process.env.GEMINI_API_KEY` を参照する構成にすることで、**APIキーを完全に隠蔽・保護**しています。

## 3. 外部API層（Google Gemini API）
* **通信先:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
* **役割:** Vercelから送られてきたテキストや画像データを解析・推論し、回答を生成してVercelへ返します（その後、Vercelからブラウザへ回答がそのままJSONとして返却されます）。

## まとめ
この構成は、モダンなWeb開発で推奨される **BFF (Backend For Frontend)** の設計パターンに近く、サーバー（仮想マシンなど）を常時稼働させる必要のない「サーバーレス構成」となっています。コストパフォーマンスが高く、セキュアにAI機能を組み込めている優れたネットワークアーキテクチャです。
