import { MAP_MASTERY_DATA } from "@/lib/study/mapMastery";

const ALL_EXAMS = ["upsc", "state-pcs", "ssc", "railway", "banking"];
const APTITUDE_EXAMS = ["ssc", "railway", "banking"];

function q(id, prompt, options, answer, explanation, subject, exams = ALL_EXAMS) {
  return { id, prompt, options: [...new Set(options.map(String))], answer: String(answer), explanation, subject, exams, source: "CurrentPulse deterministic foundation bank" };
}

function numberOptions(correct, steps = [1, 2, 3]) {
  const n = Number(correct);
  return [n, n + steps[0], Math.max(0, n - steps[1]), n + steps[2]].map(String);
}

function arithmeticQuestions() {
  const output = [];
  const percents = [10, 20, 25, 50];
  for (let i = 0; i < 60; i += 1) {
    const base = 400 + (i % 15) * 40;
    const pct = percents[i % percents.length];
    const answer = base * pct / 100;
    output.push(q(
      `det-percent-${i}`,
      `What is ${pct}% of ${base}?`,
      [answer, answer + 20, Math.max(1, answer - 20), answer + 40].map(String),
      answer,
      `${pct}% of ${base} = ${base} × ${pct}/100 = ${answer}.`,
      "Quantitative Aptitude",
      APTITUDE_EXAMS
    ));
  }
  for (let i = 0; i < 50; i += 1) {
    const a = 2 + (i % 5);
    const b = a + 2 + (i % 3);
    const unit = 4 + (i % 6);
    const total = (a + b) * unit;
    const answer = b * unit;
    output.push(q(
      `det-ratio-${i}`,
      `Two numbers are in the ratio ${a}:${b} and their sum is ${total}. What is the larger number?`,
      numberOptions(answer, [unit, unit * 2, unit * 3]),
      answer,
      `${a + b} ratio-parts equal ${total}, so one part is ${unit}; the larger number is ${b} × ${unit} = ${answer}.`,
      "Quantitative Aptitude",
      APTITUDE_EXAMS
    ));
  }
  for (let i = 0; i < 50; i += 1) {
    const speed = 40 + (i % 8) * 5;
    const hours = 2 + (i % 4);
    const distance = speed * hours;
    output.push(q(
      `det-speed-${i}`,
      `A vehicle covers ${distance} km at a constant speed of ${speed} km/h. How many hours does it take?`,
      [hours, hours + 1, Math.max(1, hours - 1), hours + 2].map(String),
      hours,
      `Time = distance ÷ speed = ${distance} ÷ ${speed} = ${hours} hours.`,
      "Quantitative Aptitude",
      APTITUDE_EXAMS
    ));
  }
  return output;
}

function reasoningQuestions() {
  const output = [];
  for (let i = 0; i < 60; i += 1) {
    const start = 2 + (i % 9);
    const step = 2 + (i % 6);
    const seq = Array.from({ length: 5 }, (_, index) => start + step * index);
    const answer = start + step * 5;
    output.push(q(
      `det-series-${i}`,
      `Find the next number: ${seq.join(", ")}, ?`,
      [answer, answer + step, answer - 1, answer + 1].map(String),
      answer,
      `The sequence increases by ${step} each time, so the next term is ${answer}.`,
      "Reasoning",
      APTITUDE_EXAMS
    ));
  }
  return output;
}

const STATIC = [
  ["polity-14","Article 14 of the Constitution primarily guarantees:","Equality before law",["Freedom of religion","Equality before law","Right to education","Protection against arrest"],"Article 14 guarantees equality before law and equal protection of the laws.","Polity",["upsc","state-pcs","ssc","railway"]],
  ["polity-73","Which Constitutional Amendment gave constitutional status to Panchayats?","73rd",["42nd","52nd","73rd","74th"],"The 73rd Constitutional Amendment added Part IX on Panchayats.","Polity",["upsc","state-pcs","ssc","railway"]],
  ["polity-74","Which Constitutional Amendment is associated with urban local bodies?","74th",["44th","61st","73rd","74th"],"The 74th Constitutional Amendment added Part IX-A on Municipalities.","Polity",["upsc","state-pcs","ssc","railway"]],
  ["eco-rbi","Which institution is India's central bank?","RBI",["RBI","SEBI","SBI","NABARD"],"The Reserve Bank of India is India's central bank.","Banking & Financial Awareness",["banking","ssc","railway"]],
  ["eco-crr","Scheduled banks maintain the Cash Reserve Ratio with:","RBI",["RBI","SEBI","Finance Commission","NITI Aayog"],"CRR is the share of deposits that banks maintain as cash reserves with the RBI.","Banking & Financial Awareness",["banking"]],
  ["eco-upi","UPI is operated by:","NPCI",["NPCI","SEBI","IRDAI","NABARD"],"The National Payments Corporation of India operates UPI.","Banking & Financial Awareness",["banking","ssc","railway"]],
  ["eco-sebi","Which regulator oversees India's securities market?","SEBI",["RBI","SEBI","PFRDA","NABARD"],"SEBI regulates the securities market in India.","Banking & Financial Awareness",["banking","ssc"]],
  ["env-ramsar","The Ramsar Convention is principally associated with:","Wetlands",["Wetlands","Deserts","Glaciers","Coral reefs only"],"The Ramsar Convention is the international framework for wetlands.","Environment",["upsc","state-pcs","ssc","railway"]],
  ["hist-permanent","The Permanent Settlement of Bengal was introduced under:","Lord Cornwallis",["Lord Cornwallis","Lord Wellesley","Lord Ripon","Lord Curzon"],"The Permanent Settlement was introduced in 1793 under Lord Cornwallis.","History",["upsc","state-pcs","ssc","railway"]],
  ["science-current","The SI unit of electric current is:","Ampere",["Ampere","Volt","Ohm","Watt"],"Ampere is the SI base unit of electric current.","General Science",["ssc","railway","state-pcs"]],
  ["science-ph","A solution with pH 3 is:","Acidic",["Acidic","Neutral","Basic","Always saline"],"A pH below 7 indicates an acidic solution.","General Science",["ssc","railway","state-pcs"]],
  ["science-photo","Photosynthesis mainly occurs in the:","Chloroplast",["Chloroplast","Mitochondrion","Ribosome","Lysosome"],"Chloroplasts contain chlorophyll and are the primary site of photosynthesis.","General Science",["ssc","railway","state-pcs"]],
  ["gk-un","The main headquarters of the United Nations is in:","New York",["New York","Geneva","Paris","Vienna"],"The main UN headquarters is in New York City.","General Awareness",["ssc","railway","banking","state-pcs"]],
  ["gk-japan","The currency of Japan is:","Yen",["Yen","Won","Yuan","Ringgit"],"Japan's currency is the yen.","General Awareness",["ssc","railway","banking"]],
  ["geo-chilika","Chilika Lake is in:","Odisha",["Odisha","Kerala","Gujarat","Assam"],"Chilika is a brackish-water lagoon on the Odisha coast.","Geography",["upsc","state-pcs","ssc","railway"]],
  ["geo-mead","Lake Mead is a reservoir on the:","Colorado River",["Colorado River","Mississippi River","Columbia River","Rio Grande"],"Lake Mead was created by Hoover Dam on the Colorado River.","Geography",["upsc","state-pcs","ssc","railway"]],
  ["geo-baikal","Lake Baikal is located in:","Russia",["Russia","Canada","Mongolia","Kazakhstan"],"Lake Baikal lies in Siberia, Russia.","Geography",["upsc","state-pcs","ssc","railway"]],
];

function staticQuestions() {
  return STATIC.map(([id,prompt,answer,options,explanation,subject,exams]) =>
    q(`det-${id}`, prompt, options, answer, explanation, subject, exams)
  );
}

function mapQuestions() {
  const output = [];
  const groups = [
    ["lakes","Lake / wetland"],["mountains","Mountain / range"],["rivers","River / basin"],
  ];
  const flattened = groups.flatMap(([kind,label]) =>
    ["india","world"].flatMap((scope) =>
      MAP_MASTERY_DATA[kind][scope].map(([name,lat,lon,note]) => ({kind,label,scope,name,lat,lon,note}))
    )
  );

  const notes = [...new Set(flattened.map((item) => item.note))];
  const names = flattened.map((item) => item.name);

  flattened.forEach((item, index) => {
    const noteDistractors = notes.filter((value) => value !== item.note).slice(index % Math.max(1, notes.length - 4)).concat(notes).filter((value, i, arr) => value !== item.note && arr.indexOf(value) === i).slice(0, 3);
    const nameDistractors = flattened.filter((other) => other.note !== item.note && other.name !== item.name).slice(index % Math.max(1, flattened.length - 4)).concat(flattened).filter((other, i, arr) => other.name !== item.name && other.note !== item.note && arr.findIndex((x) => x.name === other.name) === i).slice(0, 3).map((other) => other.name);
    output.push(q(
      `map-place-${index}`,
      `${item.name} is associated with which location or region?`,
      [item.note, ...noteDistractors],
      item.note,
      `${item.name} is mapped to ${item.note} in the CurrentPulse reusable geography bank.`,
      "Geography"
    ));
    output.push(q(
      `map-reverse-${index}`,
      `Which of the following mapped features is associated with ${item.note}?`,
      [item.name, ...nameDistractors],
      item.name,
      `${item.name} is the feature in this option set associated with ${item.note}.`,
      "Geography"
    ));
    output.push(q(
      `map-type-${index}`,
      `${item.name} should be placed in which map-mastery category?`,
      ["Lake / wetland","Mountain / range","River / basin","None of these"],
      item.label,
      `${item.name} belongs to the ${item.label.toLowerCase()} category.`,
      "Geography"
    ));
  });
  return output.filter((item) => item.options.length === 4);
}

export const GENERATED_FOUNDATION_QUESTIONS = [
  ...mapQuestions(),
  ...arithmeticQuestions(),
  ...reasoningQuestions(),
  ...staticQuestions(),
];
