import sys
import json
from pdfminer.high_level import extract_text

def extract_scores(pdf_path):
    try:
        text = extract_text(pdf_path)
        
        # 簡易的な抽出ロジック（実際の内容に合わせて改良が必要です）
        # 例：「算数 偏差値 55.4」のような行を探す
        result = {
            "math": {"total": 50, "fields": [50, 50, 50, 50, 50, 50]},
            "science": {"total": 50, "fields": [50, 50, 50, 50, 50, 50]},
            "raw_text_snippet": text[:500] # デバッグ用
        }

        # テキストデータを解析してキーワードごとの数値を拾う
        lines = text.split('\n')
        for line in lines:
            line = line.strip()
            # サンプルの解析ロジック（実際のフォーマットに合わせる必要あり）
            if "算数" in line and "偏差値" in line:
                # ここで数値を抽出する処理を入れる（正規表現などで）
                pass
            
            # TODO: より高度な解析ロジックをここに実装
        
        # 今回はデモとして、いくつかのキーワード探索を行う
        # 実際のPDF構造が不明なため、テキスト全体を返して次につなげる
        
        print(json.dumps({"success": True, "text": text}, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file path provided"}, ensure_ascii=False))
    else:
        extract_scores(sys.argv[1])
