
export const MAP_MASTERY_DATA = {
  lakes: {
    trigger: /\b(?:lake|reservoir|lagoon|wetland|ramsar)\b/i,
    india: [
      ["Wular Lake",34.35,74.55,"J&K"],["Dal Lake",34.11,74.87,"J&K"],["Pangong Tso",33.75,78.65,"Ladakh"],
      ["Sambhar Lake",26.92,75.20,"Rajasthan"],["Chilika Lake",19.72,85.32,"Odisha"],["Kolleru Lake",16.62,81.20,"Andhra Pradesh"],
      ["Pulicat Lake",13.63,80.18,"AP–Tamil Nadu"],["Loktak Lake",24.56,93.80,"Manipur"],["Vembanad Lake",9.62,76.42,"Kerala"],
      ["Ashtamudi Lake",8.95,76.58,"Kerala"],["Lonar Lake",19.98,76.51,"Maharashtra"],["Nalsarovar",22.80,72.03,"Gujarat"],
    ],
    world: [
      ["Caspian Sea",41.7,50.7,"Eurasia"],["Lake Superior",47.7,-87.5,"USA–Canada"],["Lake Victoria",-1,33,"East Africa"],
      ["Lake Baikal",53.5,108,"Russia"],["Lake Tanganyika",-6.2,29.6,"East Africa"],["Lake Malawi",-12.2,34.5,"East Africa"],
      ["Lake Titicaca",-15.8,-69.4,"Peru–Bolivia"],["Great Bear Lake",65.9,-120.7,"Canada"],["Great Slave Lake",61.7,-113.5,"Canada"],
      ["Lake Chad",13,14.3,"Sahel"],["Dead Sea",31.5,35.5,"West Asia"],["Aral Sea",45,59,"Kazakhstan–Uzbekistan"],
      ["Great Salt Lake",41.2,-112.6,"USA"],["Lake Mead",36.1,-114.7,"Nevada–Arizona, USA"],
    ],
  },
  mountains: {
    trigger: /\b(?:mountain|hill|peak|range|pass|himalaya|ghat)\b/i,
    india: [
      ["Kangchenjunga",27.70,88.15,"Sikkim"],["Nanda Devi",30.38,79.97,"Uttarakhand"],["Kamet",30.92,79.59,"Uttarakhand"],
      ["Anamudi",10.17,77.06,"Kerala"],["Guru Shikhar",24.65,72.78,"Rajasthan"],["Dhupgarh",22.45,78.37,"Madhya Pradesh"],
      ["Aravalli Range",25,73.5,"NW India"],["Western Ghats",15,74.5,"Western India"],["Eastern Ghats",17,81,"Eastern India"],["Nilgiri Hills",11.4,76.7,"South India"],
    ],
    world: [
      ["Mount Everest",27.99,86.93,"Nepal–China"],["K2",35.88,76.51,"Karakoram"],["Kilimanjaro",-3.07,37.35,"Tanzania"],
      ["Aconcagua",-32.65,-70.01,"Argentina"],["Denali",63.07,-151.01,"USA"],["Elbrus",43.35,42.44,"Russia"],
      ["Mont Blanc",45.83,6.86,"Alps"],["Mount Fuji",35.36,138.73,"Japan"],["Andes",-20,-69,"South America"],
      ["Rockies",45,-110,"North America"],["Atlas Mountains",31,-7.5,"North Africa"],["Ural Mountains",60,59,"Russia"],
    ],
  },
  rivers: {
    trigger: /\b(?:river|tributary|basin|delta|estuary)\b/i,
    india: [
      ["Indus",32,75,"NW"],["Ganga",25.3,83,"North"],["Brahmaputra",26.2,92.9,"Northeast"],["Narmada",22.2,78,"Central"],
      ["Tapi",21.2,75,"Central"],["Godavari",19,79,"Peninsular"],["Krishna",16.5,78,"Peninsular"],["Kaveri",11.5,77,"South"],
      ["Mahanadi",20.5,83.5,"East"],["Teesta",27.2,88.5,"Sikkim–WB"],
    ],
    world: [
      ["Nile",15,32,"Africa"],["Amazon",-3,-60,"South America"],["Yangtze",30,110,"China"],["Mississippi",35,-90,"USA"],
      ["Danube",47,19,"Europe"],["Congo",-2,23,"Central Africa"],["Mekong",16,105,"SE Asia"],["Volga",52,46,"Russia"],
      ["Colorado",36,-112,"USA–Mexico"],["Murray–Darling",-34,145,"Australia"],
    ],
  },
};

export function detectMapMasteryTopic(title = "", text = "") {
  const combined = `${title} ${text}`;
  for (const [key, value] of Object.entries(MAP_MASTERY_DATA)) {
    if (value.trigger.test(combined)) return key;
  }
  return "";
}
