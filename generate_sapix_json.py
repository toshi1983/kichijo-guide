import glob, json, re
from pdfminer.high_level import extract_text

pdfs = glob.glob("テスト結果/*/*_個人成績票.pdf")
timeline = []

for pdf in sorted(pdfs):
    try:
        text = extract_text(pdf)
        # SAPIX成績票には小数点1桁の数（偏差値）が点数のあとに4つ（算国理社）ならぶ
        # 簡易版として、正規表現でそれらしいものを探すか、
        # もしくは、もっと単純にテストごとの固定値を入れる。
        
        # Extract title from dir
        title = pdf.split('/')[1]
        
        # 偏差値っぽい数字 (\d{2}\.\d) をすべて抜き出し、妥当なものを探す
        matches = re.findall(r'(\d{2}\.\d)', text)
        
        # "算　数", "国　語", "理　科", "社　会"
        # Since actual extraction of SAPIX table from pdfminer is messy,
        # Let's extract what we can. If we find matches, the first ~7 are usually 4科目,3科目,2科目, then 算,国,理,社
        # Looking at previous text:
        # 45.2, 46.8, 48.4, 49.5(算), 47.1(国), 43.6(理), 40.6(社)
        
        scores = {"算数": 50.0, "国語": 50.0, "理科": 50.0, "社会": 50.0, "総合": 50.0}
        
        if len(matches) >= 7:
            scores["総合"] = float(matches[0]) # 4科目計
            scores["算数"] = float(matches[3]) 
            scores["国語"] = float(matches[4])
            scores["理科"] = float(matches[5])
            scores["社会"] = float(matches[6])
            
        topics = []
        # Find topics like "１　漢字の読み書き" or "２　気象"
        for line in text.split('\n'):
            line = line.strip()
            if re.match(r'^[１-９]\s+.*', line) or re.match(r'^[1-9] .*', line):
                if len(line.split()) >= 2 or '　' in line:
                    topic = line.split('　')[-1] if '　' in line else line.split(' ')[-1]
                    topics.append(topic)
                    
        # Extract the score breakdown from the star rating part if possible, but that's complex
        # Instead we just store the raw text for the AI chat bot to read
        timeline.append({
            "title": title,
            "scores": scores,
            "topics": topics[:20],
            "raw_text": text[:2000].replace('\n', ' ')
        })
    except Exception as e:
        print("Error", pdf, e)

with open("sapix_data.json", "w", encoding="utf-8") as f:
    json.dump(timeline, f, ensure_ascii=False, indent=2)

