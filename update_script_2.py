import json

with open("js/quiz_data.js", "r") as f:
    text = f.read()
    json_str = text.split("=", 1)[1].rsplit(";", 1)[0].strip()
    quiz = json.loads(json_str)

with open("js/jan_overrides_2.json", "r") as f:
    overrides = json.load(f)

for o in overrides:
    for i, q in enumerate(quiz):
        if q["id"] == o["id"]:
            quiz[i] = o
            break

with open("js/quiz_data.js", "w") as f:
    f.write("const quizData = " + json.dumps(quiz, ensure_ascii=False, indent=4) + ";\n")
