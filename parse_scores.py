import glob, json, re
from pdfminer.high_level import extract_text

pdfs = glob.glob("テスト結果/*/*_個人成績票.pdf")
results = []

for pdf in sorted(pdfs):
    try:
        text = extract_text(pdf)
        # 簡易抽出
        # 算　数 or 算数 depending on format
        scores = {}
        
        # 1. 偏差値を抽出するロジックの簡易実装 (SAPIXの個人成績票は表形式で出力順序がある程度固定)
        # 行ごとに分割して探索
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        # 非常に簡易的なパース（実際はもう少し堅牢にする必要があるが、デモ用途も兼ねる）
        # '４科目計'を探す
        subjects = ['算　数', '国　語', '理　科', '社　会']
        devs = {'算数': 0, '国語': 0, '理科': 0, '社会': 0}
        
        # 偏差値は 40.5 のような小数点1桁の数字が並ぶ部分を探す。
        # または、単純にしらみつぶしにやるより、もうすこし推測する。
        # "算　数\n国　語\n理　科\n社　会"のあとに得点、偏差値、順位が続く仕様を利用。
        
        # テスト名を抽出 (ディレクトリ名から取得)
        test_name = pdf.split('/')[1]
        test_date = test_name[:8]
        if '-' in test_date:
            test_date = test_date.replace('-', '/')
            
        results.append({
            "test_name": test_name[9:], # YYYY-MMDD- 以降
            "date": test_date,
            "raw_text": text[:1500] # 文字列をそのまま入れる
        })
    except Exception as e:
        print(f"Error reading {pdf}: {e}")

with open("sapix_scores.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print("Created sapix_scores.json")
