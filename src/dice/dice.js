const topics = [
  { q: "宝くじが当たったら何を買う？" },
  { q: "一ヶ月後に隕石が落ちてきて地球が滅ぶとしたら何をする？" },
  { q: "寝る前に聴く環境音は何が好き？", examples: ["焚き火", "暖炉", "川のせせらぎ", "雨", "風", "台風", "雷", "草木"] },
  { q: "あなたの属性は何？", examples: ["炎", "水", "草", "雷", "氷"] },
  { q: "無人島にひとつだけ持っていけるとしたら何を持っていく？" },
  { q: "居心地の良い場所はどんなところ？" },
  { q: "生まれ変わるなら何になりたい？", examples: ["猫", "鳥", "車", "ロボット", "家具"] },
  { q: "好きな季節はどれ？その理由は？", examples: ["春", "夏", "秋", "冬"] },
  { q: "もし一週間だけ好きな職業になれるなら何になる？" },
  { q: "最近ハマっているものは何？" },
  { q: "子供の頃の将来の夢は何だった？" },
  { q: "10億円もらえるけど1年後に記憶を全部失うとしたら何に使う？" },
  { q: "もしVRChatの世界が1日だけ現実になるとしたら何をする？" },
  { q: "好きな時間帯はいつ？", examples: ["朝", "昼", "夕方", "夜", "深夜"] },
  { q: "好きな果物はなに？" },
  { q: "いつか行ってみたい国や場所はどこ？" },
  { q: "なんでも願いがひとつ叶うとしたら何を願う？" },
  { q: "好きな飲み物は？", examples: ["ココア", "コーヒー", "抹茶ラテ", "レモネード", "紅茶"] },
];

let lastIndex = -1;

function pickIndex() {
  if (topics.length <= 1) return 0;
  let index = lastIndex;
  while (index === lastIndex) {
    index = Math.floor(Math.random() * topics.length);
  }
  return index;
}

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("js-dice-button");
  const icon = document.getElementById("js-dice-icon");
  const questionEl = document.getElementById("js-dice-question");
  const exampleEl = document.getElementById("js-dice-example");

  if (!button || !icon || !questionEl || !exampleEl) return;

  const ANIMATION_DURATION = 600;

  button.addEventListener("click", () => {
    if (button.disabled) return;
    button.disabled = true;

    icon.classList.remove("is_rolling");
    void icon.offsetWidth;
    icon.classList.add("is_rolling");

    window.setTimeout(() => {
      const index = pickIndex();
      lastIndex = index;
      const topic = topics[index];

      questionEl.textContent = topic.q;
      exampleEl.textContent = topic.examples ? `（例：${topic.examples.join("、")}）` : "";

      icon.classList.remove("is_rolling");
      button.disabled = false;
    }, ANIMATION_DURATION);
  });
});
