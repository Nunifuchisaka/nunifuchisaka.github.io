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

// サイコロの面ごとの向き（その面を正面に向けるための回転）
const FACE_ROTATION = {
  1: [0, 0],
  2: [0, -90],
  3: [-90, 0],
  4: [90, 0],
  5: [0, 90],
  6: [0, 180],
};
const ROLL_MS = 1100;

const shuffle = (list) => {
  const array = list.slice();
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const initDice = (root) => {
  const cube = root.querySelector(".js_dice_cube");
  const result = root.querySelector(".js_dice_result");
  const questionEl = root.querySelector(".js_dice_question");
  const examplesEl = root.querySelector(".js_dice_examples");
  const rollButton = root.querySelector(".js_dice_roll");
  const remainingEl = root.querySelector(".js_dice_remaining");
  const fullscreenButton = root.querySelector(".js_dice_fullscreen");
  if (!cube || !questionEl || !rollButton) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // 一巡するまで同じ話題を出さない（袋から引く）。一巡したら混ぜ直す。直前と同じ話題が先頭に来たら入れ替える
  let bag = [];
  let last = null;
  const draw = () => {
    if (!bag.length) {
      bag = shuffle(topics.map((_, i) => i));
      if (bag.length > 1 && bag[bag.length - 1] === last) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
    last = bag.pop();
    return topics[last];
  };

  const showRemaining = () => {
    if (!remainingEl) return;
    const n = bag.length || topics.length;
    remainingEl.textContent = remainingEl.dataset.template.replace("{n}", String(n));
  };

  const showTopic = (topic) => {
    questionEl.textContent = topic.q;
    examplesEl.replaceChildren(...(topic.examples || []).map((example) => {
      const li = document.createElement("li");
      li.textContent = example;
      return li;
    }));
    result.classList.remove("is_revealed");
    void result.offsetWidth;
    result.classList.add("is_revealed");
    showRemaining();
  };

  let angleX = -20;
  let angleY = 30;
  cube.style.transform = `rotateX(${angleX}deg) rotateY(${angleY}deg)`;

  rollButton.addEventListener("click", () => {
    if (rollButton.disabled) return;
    const face = 1 + Math.floor(Math.random() * 6);
    const [fx, fy] = FACE_ROTATION[face];
    // 少し斜めから見た向きで止める（立体だと分かるように）
    const nextX = angleX - (((angleX % 360) + 360) % 360) + 720 + fx - 18;
    const nextY = angleY - (((angleY % 360) + 360) % 360) + 720 + fy + 24;
    const topic = draw();
    const target = `rotateX(${nextX}deg) rotateY(${nextY}deg)`;

    if (reduceMotion.matches || !cube.animate) {
      cube.style.transform = target;
      angleX = nextX;
      angleY = nextY;
      showTopic(topic);
      return;
    }

    rollButton.disabled = true;
    root.classList.add("is_rolling");
    const animation = cube.animate(
      [
        { transform: `rotateX(${angleX}deg) rotateY(${angleY}deg) translateY(0)` },
        { transform: `rotateX(${(angleX + nextX) / 2}deg) rotateY(${(angleY + nextY) / 2}deg) translateY(-28%)`, offset: 0.45 },
        { transform: `${target} translateY(0)` },
      ],
      { duration: ROLL_MS, easing: "cubic-bezier(.25, .8, .3, 1)" },
    );
    animation.finished.then(() => {
      cube.style.transform = target;
      angleX = nextX;
      angleY = nextY;
      root.classList.remove("is_rolling");
      rollButton.disabled = false;
      showTopic(topic);
      rollButton.focus();
    });
  });

  // 全画面（VR のブラウザや配信画面で見やすくする）。使えないブラウザではボタンを出さない
  if (fullscreenButton && document.fullscreenEnabled) {
    fullscreenButton.hidden = false;
    const render = () => {
      const active = document.fullscreenElement === root;
      fullscreenButton.textContent = active ? root.dataset.labelExit : root.dataset.labelFullscreen;
    };
    fullscreenButton.addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else root.requestFullscreen().catch(() => {});
    });
    document.addEventListener("fullscreenchange", render);
    render();
  }

  showRemaining();
};

const dice = document.querySelector(".js_dice");
if (dice) initDice(dice);
