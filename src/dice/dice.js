const topicsByLocale = {
  ja: [
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
  ],
  en: [
    { q: "If you won the lottery, what would you buy?" },
    { q: "If a meteor were going to destroy Earth in a month, what would you do?" },
    { q: "What ambient sound do you like listening to before bed?", examples: ["Campfire", "Fireplace", "Babbling brook", "Rain", "Wind", "Typhoon", "Thunder", "Rustling leaves"] },
    { q: "What's your elemental type?", examples: ["Fire", "Water", "Grass", "Lightning", "Ice"] },
    { q: "If you could bring only one thing to a deserted island, what would it be?" },
    { q: "What kind of place feels most comfortable to you?" },
    { q: "If you were reincarnated, what would you want to become?", examples: ["Cat", "Bird", "Car", "Robot", "Furniture"] },
    { q: "Which season do you like best, and why?", examples: ["Spring", "Summer", "Autumn", "Winter"] },
    { q: "If you could be any profession for just one week, what would you choose?" },
    { q: "What have you been into lately?" },
    { q: "What did you want to be when you grew up as a kid?" },
    { q: "If you got 1 billion yen but would lose all your memories in a year, what would you spend it on?" },
    { q: "If the world of VRChat became real for just one day, what would you do?" },
    { q: "What's your favorite time of day?", examples: ["Morning", "Midday", "Evening", "Night", "Late night"] },
    { q: "What's your favorite fruit?" },
    { q: "Is there a country or place you'd like to visit someday?" },
    { q: "If you could have one wish granted, what would you wish for?" },
    { q: "What's your favorite drink?", examples: ["Cocoa", "Coffee", "Matcha latte", "Lemonade", "Black tea"] },
  ],
};

const locale = document.documentElement.lang === "en" ? "en" : "ja";
const topics = topicsByLocale[locale];
const exampleLabel = locale === "en" ? (list) => `(e.g. ${list.join(", ")})` : (list) => `（例：${list.join("、")}）`;

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
      exampleEl.textContent = topic.examples ? exampleLabel(topic.examples) : "";

      icon.classList.remove("is_rolling");
      button.disabled = false;
    }, ANIMATION_DURATION);
  });
});
