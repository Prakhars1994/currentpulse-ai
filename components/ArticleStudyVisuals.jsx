"use client";

import { useMemo, useState } from "react";
import { MapPin, Mountain, Map as MapIcon, Trees, Waves, LocateFixed } from "lucide-react";
import { filterRelevantMapLocations, isMapRelevantArticle } from "@/lib/study/mapRelevance";

const INDIA_BOUNDS = { north: 37.5, south: 5.0, west: 67.0, east: 99.0 };
const WORLD_BOUNDS = { north: 90, south: -90, west: -180, east: 180 };

// Stable approximate coordinates for common UPSC-relevant Indian locations.
// Unknown places are intentionally shown without a guessed marker rather than
// putting a dot in the wrong state/country.
const INDIA_LOCATIONS = {
  india: { label: "India", lat: 22.8, lon: 79.0 },
  "new delhi": { label: "New Delhi", lat: 28.6139, lon: 77.2090, state: "Delhi", city: "New Delhi" },
  delhi: { label: "Delhi", lat: 28.7041, lon: 77.1025, state: "Delhi" },
  mumbai: { label: "Mumbai", lat: 19.0760, lon: 72.8777, state: "Maharashtra", city: "Mumbai" },
  pune: { label: "Pune", lat: 18.5204, lon: 73.8567, state: "Maharashtra", city: "Pune" },
  satara: { label: "Satara", lat: 17.6805, lon: 74.0183, state: "Maharashtra", city: "Satara" },
  maharashtra: { label: "Maharashtra", lat: 19.7515, lon: 75.7139, state: "Maharashtra" },
  ahmedabad: { label: "Ahmedabad", lat: 23.0225, lon: 72.5714, state: "Gujarat", city: "Ahmedabad" },
  surat: { label: "Surat", lat: 21.1702, lon: 72.8311, state: "Gujarat", city: "Surat" },
  gujarat: { label: "Gujarat", lat: 22.2587, lon: 71.1924, state: "Gujarat" },
  jaipur: { label: "Jaipur", lat: 26.9124, lon: 75.7873, state: "Rajasthan", city: "Jaipur" },
  rajasthan: { label: "Rajasthan", lat: 27.0238, lon: 74.2179, state: "Rajasthan" },
  amritsar: { label: "Amritsar", lat: 31.6340, lon: 74.8723, state: "Punjab", city: "Amritsar" },
  punjab: { label: "Punjab", lat: 31.1471, lon: 75.3412, state: "Punjab" },
  chandigarh: { label: "Chandigarh", lat: 30.7333, lon: 76.7794, state: "Chandigarh", city: "Chandigarh" },
  haryana: { label: "Haryana", lat: 29.0588, lon: 76.0856, state: "Haryana" },
  lucknow: { label: "Lucknow", lat: 26.8467, lon: 80.9462, state: "Uttar Pradesh", city: "Lucknow" },
  varanasi: { label: "Varanasi", lat: 25.3176, lon: 82.9739, state: "Uttar Pradesh", city: "Varanasi" },
  ballia: { label: "Ballia", lat: 25.7607, lon: 84.1471, state: "Uttar Pradesh", city: "Ballia" },
  balla: { label: "Ballia", lat: 25.7607, lon: 84.1471, state: "Uttar Pradesh", city: "Ballia" },
  "uttar pradesh": { label: "Uttar Pradesh", lat: 26.8467, lon: 80.9462, state: "Uttar Pradesh" },
  patna: { label: "Patna", lat: 25.5941, lon: 85.1376, state: "Bihar", city: "Patna" },
  bihar: { label: "Bihar", lat: 25.0961, lon: 85.3131, state: "Bihar" },
  kolkata: { label: "Kolkata", lat: 22.5726, lon: 88.3639, state: "West Bengal", city: "Kolkata" },
  tamluk: { label: "Tamluk", lat: 22.3000, lon: 87.9200, state: "West Bengal", city: "Tamluk" },
  "west bengal": { label: "West Bengal", lat: 22.9868, lon: 87.8550, state: "West Bengal" },
  guwahati: { label: "Guwahati", lat: 26.1445, lon: 91.7362, state: "Assam", city: "Guwahati" },
  assam: { label: "Assam", lat: 26.2006, lon: 92.9376, state: "Assam" },
  gangtok: { label: "Gangtok", lat: 27.3389, lon: 88.6065, state: "Sikkim", city: "Gangtok" },
  sikkim: { label: "Sikkim", lat: 27.5330, lon: 88.5122, state: "Sikkim" },
  bhubaneswar: { label: "Bhubaneswar", lat: 20.2961, lon: 85.8245, state: "Odisha", city: "Bhubaneswar" },
  odisha: { label: "Odisha", lat: 20.9517, lon: 85.0985, state: "Odisha" },
  bhopal: { label: "Bhopal", lat: 23.2599, lon: 77.4126, state: "Madhya Pradesh", city: "Bhopal" },
  gwalior: { label: "Gwalior", lat: 26.2183, lon: 78.1828, state: "Madhya Pradesh", city: "Gwalior" },
  "madhya pradesh": { label: "Madhya Pradesh", lat: 22.9734, lon: 78.6569, state: "Madhya Pradesh" },
  raipur: { label: "Raipur", lat: 21.2514, lon: 81.6296, state: "Chhattisgarh", city: "Raipur" },
  chhattisgarh: { label: "Chhattisgarh", lat: 21.2787, lon: 81.8661, state: "Chhattisgarh" },
  ranchi: { label: "Ranchi", lat: 23.3441, lon: 85.3096, state: "Jharkhand", city: "Ranchi" },
  jharkhand: { label: "Jharkhand", lat: 23.6102, lon: 85.2799, state: "Jharkhand" },
  bengaluru: { label: "Bengaluru", lat: 12.9716, lon: 77.5946, state: "Karnataka", city: "Bengaluru" },
  bangalore: { label: "Bengaluru", lat: 12.9716, lon: 77.5946, state: "Karnataka", city: "Bengaluru" },
  banglore: { label: "Bengaluru", lat: 12.9716, lon: 77.5946, state: "Karnataka", city: "Bengaluru" },
  mysuru: { label: "Mysuru", lat: 12.2958, lon: 76.6394, state: "Karnataka", city: "Mysuru" },
  mysore: { label: "Mysuru", lat: 12.2958, lon: 76.6394, state: "Karnataka", city: "Mysuru" },
  karnataka: { label: "Karnataka", lat: 15.3173, lon: 75.7139, state: "Karnataka" },
  kochi: { label: "Kochi", lat: 9.9312, lon: 76.2673, state: "Kerala", city: "Kochi" },
  thiruvananthapuram: { label: "Thiruvananthapuram", lat: 8.5241, lon: 76.9366, state: "Kerala", city: "Thiruvananthapuram" },
  kerala: { label: "Kerala", lat: 10.8505, lon: 76.2711, state: "Kerala" },
  chennai: { label: "Chennai", lat: 13.0827, lon: 80.2707, state: "Tamil Nadu", city: "Chennai" },
  "tamil nadu": { label: "Tamil Nadu", lat: 11.1271, lon: 78.6569, state: "Tamil Nadu" },
  hyderabad: { label: "Hyderabad", lat: 17.3850, lon: 78.4867, state: "Telangana", city: "Hyderabad" },
  telangana: { label: "Telangana", lat: 18.1124, lon: 79.0193, state: "Telangana" },
  visakhapatnam: { label: "Visakhapatnam", lat: 17.6868, lon: 83.2185, state: "Andhra Pradesh", city: "Visakhapatnam" },
  "andhra pradesh": { label: "Andhra Pradesh", lat: 15.9129, lon: 79.7400, state: "Andhra Pradesh" },
  goa: { label: "Goa", lat: 15.2993, lon: 74.1240, state: "Goa" },
  srinagar: { label: "Srinagar", lat: 34.0837, lon: 74.7973, state: "Jammu & Kashmir", city: "Srinagar" },
  "jammu and kashmir": { label: "Jammu & Kashmir", lat: 33.7782, lon: 76.5762, state: "Jammu & Kashmir" },
  leh: { label: "Leh", lat: 34.1526, lon: 77.5771, state: "Ladakh", city: "Leh" },
  ladakh: { label: "Ladakh", lat: 34.1526, lon: 77.5771, state: "Ladakh" },
  dehradun: { label: "Dehradun", lat: 30.3165, lon: 78.0322, state: "Uttarakhand", city: "Dehradun" },
  uttarakhand: { label: "Uttarakhand", lat: 30.0668, lon: 79.0193, state: "Uttarakhand" },
  shimla: { label: "Shimla", lat: 31.1048, lon: 77.1734, state: "Himachal Pradesh", city: "Shimla" },
  "himachal pradesh": { label: "Himachal Pradesh", lat: 31.1048, lon: 77.1734, state: "Himachal Pradesh" },
  himachal: { label: "Himachal Pradesh", lat: 31.1048, lon: 77.1734, state: "Himachal Pradesh" },
  "bay of bengal": { label: "Bay of Bengal", lat: 15.0, lon: 88.0 },
  "arabian sea": { label: "Arabian Sea", lat: 15.0, lon: 69.0 },
  "indian ocean": { label: "Indian Ocean", lat: 7.5, lon: 78.0 },
  "arunachal pradesh": { label: "Arunachal Pradesh", lat: 28.2180, lon: 94.7278, state: "Arunachal Pradesh" },
  itanagar: { label: "Itanagar", lat: 27.0844, lon: 93.6053, state: "Arunachal Pradesh", city: "Itanagar" },
  imphal: { label: "Imphal", lat: 24.8170, lon: 93.9368, state: "Manipur", city: "Imphal" },
  manipur: { label: "Manipur", lat: 24.6637, lon: 93.9063, state: "Manipur" },
  shillong: { label: "Shillong", lat: 25.5788, lon: 91.8933, state: "Meghalaya", city: "Shillong" },
  meghalaya: { label: "Meghalaya", lat: 25.4670, lon: 91.3662, state: "Meghalaya" },
  aizawl: { label: "Aizawl", lat: 23.7271, lon: 92.7176, state: "Mizoram", city: "Aizawl" },
  mizoram: { label: "Mizoram", lat: 23.1645, lon: 92.9376, state: "Mizoram" },
  kohima: { label: "Kohima", lat: 25.6751, lon: 94.1086, state: "Nagaland", city: "Kohima" },
  nagaland: { label: "Nagaland", lat: 26.1584, lon: 94.5624, state: "Nagaland" },
  agartala: { label: "Agartala", lat: 23.8315, lon: 91.2868, state: "Tripura", city: "Agartala" },
  tripura: { label: "Tripura", lat: 23.9408, lon: 91.9882, state: "Tripura" },
  "port blair": { label: "Port Blair", lat: 11.6234, lon: 92.7265, state: "Andaman & Nicobar Islands", city: "Port Blair" },
  "andaman and nicobar islands": { label: "Andaman & Nicobar Islands", lat: 11.7401, lon: 92.6586, state: "Andaman & Nicobar Islands" },
  puducherry: { label: "Puducherry", lat: 11.9416, lon: 79.8083, state: "Puducherry", city: "Puducherry" },
  lakshadweep: { label: "Lakshadweep", lat: 10.5667, lon: 72.6417, state: "Lakshadweep" },
  puri: { label: "Puri", lat: 19.8135, lon: 85.8312, state: "Odisha", city: "Puri" },
  "nathu la": { label: "Nathu La", lat: 27.3866, lon: 88.8317, state: "Sikkim" },
  "lohagad fort": { label: "Lohagad Fort", lat: 18.7100, lon: 73.4769, state: "Maharashtra" },
};

const WORLD_LOCATIONS = {
  china: { label: "China", lat: 35.9, lon: 104.2, country: "China" },
  pakistan: { label: "Pakistan", lat: 30.4, lon: 69.3, country: "Pakistan" },
  bangladesh: { label: "Bangladesh", lat: 23.7, lon: 90.4, country: "Bangladesh" },
  nepal: { label: "Nepal", lat: 28.4, lon: 84.1, country: "Nepal" },
  bhutan: { label: "Bhutan", lat: 27.5, lon: 90.4, country: "Bhutan" },
  myanmar: { label: "Myanmar", lat: 21.9, lon: 95.9, country: "Myanmar" },
  "sri lanka": { label: "Sri Lanka", lat: 7.9, lon: 80.8, country: "Sri Lanka" },
  maldives: { label: "Maldives", lat: 3.2, lon: 73.2, country: "Maldives" },
  afghanistan: { label: "Afghanistan", lat: 33.9, lon: 67.7, country: "Afghanistan" },
  japan: { label: "Japan", lat: 36.2, lon: 138.3, country: "Japan" },
  vietnam: { label: "Vietnam", lat: 14.1, lon: 108.3, country: "Vietnam" },
  indonesia: { label: "Indonesia", lat: -0.8, lon: 113.9, country: "Indonesia" },
  australia: { label: "Australia", lat: -25.3, lon: 133.8, country: "Australia" },
  russia: { label: "Russia", lat: 61.5, lon: 105.3, country: "Russia" },
  ukraine: { label: "Ukraine", lat: 48.4, lon: 31.2, country: "Ukraine" },
  germany: { label: "Germany", lat: 51.2, lon: 10.5, country: "Germany" },
  france: { label: "France", lat: 46.2, lon: 2.2, country: "France" },
  greece: { label: "Greece", lat: 39.1, lon: 21.8, country: "Greece" },
  italy: { label: "Italy", lat: 41.9, lon: 12.6, country: "Italy" },
  "united kingdom": { label: "United Kingdom", lat: 55.4, lon: -3.4, country: "United Kingdom" },
  uk: { label: "United Kingdom", lat: 55.4, lon: -3.4, country: "United Kingdom" },
  "united states": { label: "United States", lat: 39.8, lon: -98.6, country: "United States" },
  usa: { label: "United States", lat: 39.8, lon: -98.6, country: "United States" },
  canada: { label: "Canada", lat: 56.1, lon: -106.3, country: "Canada" },
  brazil: { label: "Brazil", lat: -14.2, lon: -51.9, country: "Brazil" },
  venezuela: { label: "Venezuela", lat: 6.4, lon: -66.6, country: "Venezuela" },
  cuba: { label: "Cuba", lat: 21.5, lon: -77.8, country: "Cuba" },
  "south africa": { label: "South Africa", lat: -30.6, lon: 22.9, country: "South Africa" },
  sudan: { label: "Sudan", lat: 12.9, lon: 30.2, country: "Sudan" },
  iran: { label: "Iran", lat: 32.4, lon: 53.7, country: "Iran" },
  israel: { label: "Israel", lat: 31.0, lon: 34.9, country: "Israel" },
  egypt: { label: "Egypt", lat: 26.8, lon: 30.8, country: "Egypt" },
  "red sea": { label: "Red Sea", lat: 20.3, lon: 38.5, country: "World" },
  "strait of hormuz": { label: "Strait of Hormuz", lat: 26.6, lon: 56.3, country: "World" },
  taiwan: { label: "Taiwan", lat: 23.7, lon: 121.0, country: "Taiwan" },
  nauru: { label: "Nauru", lat: -0.5228, lon: 166.9315, country: "Nauru" },
  kiribati: { label: "Kiribati", lat: 1.8709, lon: -157.3626, country: "Kiribati" },
  tuvalu: { label: "Tuvalu", lat: -7.1095, lon: 177.6493, country: "Tuvalu" },
  "marshall islands": { label: "Marshall Islands", lat: 7.1315, lon: 171.1845, country: "Marshall Islands" },
  micronesia: { label: "Micronesia", lat: 7.4256, lon: 150.5508, country: "Micronesia" },
  "solomon islands": { label: "Solomon Islands", lat: -9.6457, lon: 160.1562, country: "Solomon Islands" },
  "papua new guinea": { label: "Papua New Guinea", lat: -6.3150, lon: 143.9555, country: "Papua New Guinea" },
  fiji: { label: "Fiji", lat: -17.7134, lon: 178.0650, country: "Fiji" },
  vanuatu: { label: "Vanuatu", lat: -15.3767, lon: 166.9592, country: "Vanuatu" },
  samoa: { label: "Samoa", lat: -13.7590, lon: -172.1046, country: "Samoa" },
  tonga: { label: "Tonga", lat: -21.1790, lon: -175.1982, country: "Tonga" },
  "new zealand": { label: "New Zealand", lat: -40.9006, lon: 174.8860, country: "New Zealand" },
  kazakhstan: { label: "Kazakhstan", lat: 48.0196, lon: 66.9237, country: "Kazakhstan" },
  uzbekistan: { label: "Uzbekistan", lat: 41.3775, lon: 64.5853, country: "Uzbekistan" },
  oman: { label: "Oman", lat: 21.4735, lon: 55.9754, country: "Oman" },
  dhofar: { label: "Dhofar", lat: 17.05, lon: 54.15, country: "Oman" },
  "hallaniyat islands": { label: "Hallaniyat Islands", lat: 17.5, lon: 56.05, country: "Oman" },
  "arabian sea": { label: "Arabian Sea", lat: 15.0, lon: 65.0, country: "World" },
  "gulf of oman": { label: "Gulf of Oman", lat: 24.5, lon: 58.5, country: "World" },
  "saudi arabia": { label: "Saudi Arabia", lat: 23.8859, lon: 45.0792, country: "Saudi Arabia" },
  turkey: { label: "Türkiye", lat: 38.9637, lon: 35.2433, country: "Türkiye" },
  turkiye: { label: "Türkiye", lat: 38.9637, lon: 35.2433, country: "Türkiye" },
  "türkiye": { label: "Türkiye", lat: 38.9637, lon: 35.2433, country: "Türkiye" },
  ghana: { label: "Ghana", lat: 7.9465, lon: -1.0232, country: "Ghana" },
  "madura island": { label: "Madura Island", lat: -7.0731, lon: 113.3916, country: "Indonesia" },
  "danube river": { label: "Danube River", lat: 45.20, lon: 22.30, country: "Europe" },
  "pacific ocean": { label: "Pacific Ocean", lat: 0, lon: 165, country: "World" },
};

const LOCATION_ALIASES = {
  naoero: "nauru",
  "republic of naoero": "nauru",
  "republic of nauru": "nauru",
  "u.s.": "united states",
  "u.s.a.": "united states",
  america: "united states",
  "khuriya muriya islands": "hallaniyat islands",
  "kuria muria islands": "hallaniyat islands",
  "great britain": "united kingdom",
  "andaman & nicobar islands": "andaman and nicobar islands",
  "jammu & kashmir": "jammu and kashmir",
};

// Curated, reusable regional context. Coordinates are deliberately limited to
// stable, well-known physical features and landmarks instead of AI guesses.
const REGIONAL_ATLAS = {
  Delhi: { nearby: [["Red Fort", 28.6562, 77.2410], ["Qutub Minar", 28.5245, 77.1855]], physical: [["Yamuna", 28.65, 77.25, "river"], ["Aravalli Ridge", 28.55, 77.15, "mountain"]] },
  Maharashtra: { nearby: [["Ajanta Caves", 20.5519, 75.7033], ["Ellora Caves", 20.0268, 75.1771]], physical: [["Western Ghats", 18.6, 73.7, "mountain"], ["Godavari", 19.9, 75.3, "river"]] },
  Rajasthan: { nearby: [["Jaipur", 26.9124, 75.7873], ["Jaisalmer", 26.9157, 70.9083]], physical: [["Aravalli Range", 25.2, 74.1, "mountain"], ["Thar Desert", 27.0, 71.0, "feature"]] },
  Gujarat: { nearby: [["Dholavira", 23.886, 70.214], ["Gir", 21.124, 70.824]], physical: [["Narmada", 21.8, 73.0, "river"], ["Great Rann", 23.8, 69.8, "feature"]] },
  "Uttar Pradesh": { nearby: [["Agra", 27.1767, 78.0081], ["Varanasi", 25.3176, 82.9739]], physical: [["Ganga", 25.5, 82.0, "river"], ["Yamuna", 27.0, 78.0, "river"]] },
  "West Bengal": { nearby: [["Darjeeling", 27.041, 88.266], ["Sundarbans", 21.9497, 89.1833]], physical: [["Hooghly", 22.5, 88.3, "river"], ["Himalaya", 27.3, 88.3, "mountain"]] },
  Assam: { nearby: [["Kaziranga", 26.5775, 93.1711], ["Majuli", 27.0, 94.2]], physical: [["Brahmaputra", 26.4, 92.5, "river"], ["Barail Hills", 25.2, 93.0, "mountain"]] },
  Odisha: { nearby: [["Konark", 19.8876, 86.0945], ["Puri", 19.8135, 85.8312]], physical: [["Mahanadi", 20.5, 85.5, "river"], ["Chilika Lake", 19.72, 85.32, "feature"]] },
  Karnataka: { nearby: [["Hampi", 15.335, 76.46], ["Mysuru", 12.2958, 76.6394]], physical: [["Western Ghats", 13.3, 75.2, "mountain"], ["Kaveri", 12.4, 76.8, "river"]] },
  Kerala: { nearby: [["Munnar", 10.0889, 77.0595], ["Kochi", 9.9312, 76.2673]], physical: [["Western Ghats", 10.3, 76.8, "mountain"], ["Periyar", 10.0, 76.5, "river"]] },
  "Tamil Nadu": { nearby: [["Mahabalipuram", 12.6208, 80.1945], ["Madurai", 9.9252, 78.1198]], physical: [["Kaveri", 10.9, 78.8, "river"], ["Nilgiri Hills", 11.4, 76.7, "mountain"]] },
  Chandigarh: { nearby: [["Rock Garden", 30.7525, 76.807], ["Sukhna Lake", 30.7421, 76.8188]], physical: [["Shivalik Hills", 30.9, 76.8, "mountain"], ["Sutlej", 31.0, 76.5, "river"]] },
  "Arunachal Pradesh": { nearby: [["Itanagar", 27.0844, 93.6053], ["Tawang", 27.5861, 91.8594]], physical: [["Eastern Himalaya", 28.0, 94.0, "mountain"], ["Siang", 28.15, 94.95, "river"]] },
  Sikkim: { nearby: [["Gangtok", 27.3389, 88.6065], ["Nathu La", 27.3866, 88.8317]], physical: [["Kangchenjunga", 27.7025, 88.1475, "mountain"], ["Teesta", 27.25, 88.55, "river"]] },
  "Andaman & Nicobar Islands": { nearby: [["Port Blair", 11.6234, 92.7265], ["Barren Island", 12.2787, 93.8587]], physical: [["Andaman Sea", 11.5, 94.0, "feature"], ["Ten Degree Channel", 10.0, 92.5, "feature"]] },
  Bihar: { nearby: [["Patna", 25.5941, 85.1376], ["Bodh Gaya", 24.6961, 84.9869]], physical: [["Ganga", 25.45, 85.45, "river"], ["Kosi", 25.9, 86.55, "river"]] },
  "Madhya Pradesh": { nearby: [["Bhopal", 23.2599, 77.4126], ["Khajuraho", 24.8318, 79.9199]], physical: [["Narmada", 22.75, 78.0, "river"], ["Vindhya Range", 24.2, 78.2, "mountain"]] },
  Chhattisgarh: { nearby: [["Raipur", 21.2514, 81.6296], ["Jagdalpur", 19.0748, 82.0080]], physical: [["Mahanadi", 21.3, 82.2, "river"], ["Bastar Plateau", 19.3, 81.9, "feature"]] },
  Jharkhand: { nearby: [["Ranchi", 23.3441, 85.3096], ["Jamshedpur", 22.8046, 86.2029]], physical: [["Damodar", 23.65, 85.8, "river"], ["Chota Nagpur Plateau", 23.3, 85.2, "feature"]] },
  Telangana: { nearby: [["Hyderabad", 17.385, 78.4867], ["Warangal", 17.9689, 79.5941]], physical: [["Godavari", 18.75, 79.8, "river"], ["Krishna", 16.5, 79.3, "river"]] },
  "Andhra Pradesh": { nearby: [["Visakhapatnam", 17.6868, 83.2185], ["Tirupati", 13.6288, 79.4192]], physical: [["Godavari Delta", 16.75, 82.2, "river"], ["Eastern Ghats", 16.2, 79.8, "mountain"]] },
  Uttarakhand: { nearby: [["Dehradun", 30.3165, 78.0322], ["Joshimath", 30.555, 79.565]], physical: [["Ganga Headwaters", 30.9, 79.1, "river"], ["Greater Himalaya", 30.8, 79.6, "mountain"]] },
  "Himachal Pradesh": { nearby: [["Shimla", 31.1048, 77.1734], ["Dharamshala", 32.219, 76.3234]], physical: [["Sutlej", 31.35, 77.65, "river"], ["Dhauladhar", 32.15, 76.65, "mountain"]] },
  Punjab: { nearby: [["Amritsar", 31.634, 74.8723], ["Ludhiana", 30.901, 75.8573]], physical: [["Sutlej", 31.0, 75.8, "river"], ["Beas", 31.5, 75.4, "river"]] },
  Haryana: { nearby: [["Gurugram", 28.4595, 77.0266], ["Kurukshetra", 29.9695, 76.8783]], physical: [["Yamuna", 29.4, 77.2, "river"], ["Aravalli Hills", 28.2, 76.9, "mountain"]] },
  Goa: { nearby: [["Panaji", 15.4909, 73.8278], ["Mormugao", 15.3874, 73.8154]], physical: [["Mandovi", 15.5, 73.9, "river"], ["Western Ghats", 15.3, 74.1, "mountain"]] },
  Meghalaya: { nearby: [["Shillong", 25.5788, 91.8933], ["Cherrapunji", 25.2702, 91.732]], physical: [["Meghalaya Plateau", 25.55, 91.5, "feature"], ["Umngot", 25.2, 92.0, "river"]] },
  Nagaland: { nearby: [["Kohima", 25.6751, 94.1086], ["Dimapur", 25.9091, 93.7266]], physical: [["Naga Hills", 25.8, 94.3, "mountain"], ["Doyang", 26.1, 94.0, "river"]] },
  Manipur: { nearby: [["Imphal", 24.817, 93.9368], ["Moreh", 24.2474, 94.302]], physical: [["Loktak Lake", 24.55, 93.8, "feature"], ["Manipur Hills", 24.7, 94.3, "mountain"]] },
  Mizoram: { nearby: [["Aizawl", 23.7271, 92.7176], ["Lunglei", 22.8671, 92.7655]], physical: [["Mizo Hills", 23.3, 92.8, "mountain"], ["Tlawng", 23.6, 92.65, "river"]] },
  Tripura: { nearby: [["Agartala", 23.8315, 91.2868], ["Udaipur", 23.5335, 91.483]], physical: [["Gumti", 23.45, 91.55, "river"], ["Jampui Hills", 24.0, 92.0, "mountain"]] },
  "Jammu & Kashmir": { nearby: [["Srinagar", 34.0837, 74.7973], ["Pahalgam", 34.0161, 75.315]], physical: [["Jhelum", 34.05, 74.85, "river"], ["Pir Panjal", 33.6, 74.6, "mountain"]] },
  Ladakh: { nearby: [["Leh", 34.1526, 77.5771], ["Kargil", 34.5539, 76.1349]], physical: [["Indus", 34.15, 77.35, "river"], ["Karakoram", 35.5, 77.5, "mountain"]] },
  Lakshadweep: { nearby: [["Kavaratti", 10.5667, 72.6417], ["Minicoy", 8.292, 73.049]], physical: [["Arabian Sea", 10.0, 72.5, "feature"], ["Nine Degree Channel", 9.0, 72.8, "feature"]] },
};

const WORLD_ATLAS = {
  Nauru: { nearby: [["Marshall Islands", 7.1315, 171.1845], ["Tuvalu", -7.1095, 177.6493], ["Solomon Islands", -9.6457, 160.1562]], physical: [["Pacific Ocean", 0, 165, "feature"], ["Equator", 0, 166.9, "feature"]] },
  Iran: { nearby: [["Iraq", 33.2, 43.7], ["Afghanistan", 33.9, 67.7], ["Pakistan", 30.4, 69.3], ["Türkiye", 39.0, 35.2]], physical: [["Persian Gulf", 26.5, 52.0, "feature"], ["Strait of Hormuz", 26.6, 56.3, "feature"], ["Zagros Mountains", 32.0, 50.0, "mountain"]] },
  "United Kingdom": { nearby: [["Ireland", 53.2, -8.2], ["France", 46.2, 2.2], ["Belgium", 50.5, 4.5]], physical: [["North Sea", 56.0, 3.0, "feature"], ["English Channel", 50.2, -1.0, "feature"]] },
  "United States": { nearby: [["Canada", 56.1, -106.3], ["Mexico", 23.6, -102.5]], physical: [["Pacific Ocean", 35.0, -135.0, "feature"], ["Atlantic Ocean", 35.0, -65.0, "feature"], ["Rocky Mountains", 40.0, -110.0, "mountain"]] },
  China: { nearby: [["India", 22.8, 79.0], ["Mongolia", 46.9, 103.8], ["Russia", 61.5, 105.3], ["Vietnam", 14.1, 108.3]], physical: [["Himalaya", 29.0, 88.0, "mountain"], ["Yangtze", 30.5, 112.0, "river"], ["South China Sea", 15.0, 114.0, "feature"]] },
  Russia: { nearby: [["Ukraine", 48.4, 31.2], ["Kazakhstan", 48.0, 66.9], ["China", 35.9, 104.2]], physical: [["Caspian Sea", 41.7, 50.4, "feature"], ["Black Sea", 43.0, 34.0, "feature"], ["Ural Mountains", 60.0, 59.0, "mountain"]] },
  Ukraine: { nearby: [["Poland", 51.9, 19.1], ["Russia", 61.5, 105.3], ["Romania", 45.9, 24.9]], physical: [["Black Sea", 43.0, 34.0, "feature"], ["Dnieper", 49.0, 32.0, "river"]] },
  Israel: { nearby: [["Jordan", 30.6, 36.2], ["Egypt", 26.8, 30.8], ["Lebanon", 33.9, 35.9]], physical: [["Mediterranean Sea", 32.0, 34.0, "feature"], ["Dead Sea", 31.5, 35.5, "feature"]] },
  Oman: { nearby: [["Yemen", 15.6, 48.5], ["Saudi Arabia", 23.9, 45.1], ["United Arab Emirates", 23.4, 53.8]], physical: [["Arabian Sea", 15.0, 65.0, "feature"], ["Gulf of Oman", 24.5, 58.5, "feature"], ["Al Hajar Mountains", 23.2, 57.3, "mountain"]] },
  "Saudi Arabia": { nearby: [["Yemen", 15.6, 48.5], ["Oman", 21.5, 55.9], ["United Arab Emirates", 23.4, 53.8]], physical: [["Red Sea", 21.0, 38.0, "feature"], ["Persian Gulf", 26.5, 52.0, "feature"], ["Arabian Desert", 23.0, 45.0, "feature"]] },
  "Türkiye": { nearby: [["Greece", 39.1, 21.8], ["Syria", 34.8, 38.9], ["Georgia", 42.3, 43.4]], physical: [["Black Sea", 43.0, 34.0, "feature"], ["Bosporus", 41.1, 29.0, "feature"], ["Anatolian Plateau", 39.0, 33.0, "feature"]] },
  Kazakhstan: { nearby: [["Russia", 61.5, 105.3], ["China", 35.9, 104.2], ["Uzbekistan", 41.4, 64.6]], physical: [["Caspian Sea", 43.5, 51.5, "feature"], ["Aral Sea", 45.0, 59.0, "feature"], ["Tian Shan", 42.0, 75.0, "mountain"]] },
  Indonesia: { nearby: [["Malaysia", 4.2, 101.9], ["Papua New Guinea", -6.3, 144.0], ["Australia", -25.3, 133.8]], physical: [["Indian Ocean", -10.0, 100.0, "feature"], ["Pacific Ocean", 0.0, 135.0, "feature"], ["Sunda Strait", -6.0, 105.8, "feature"]] },
  Japan: { nearby: [["South Korea", 35.9, 127.8], ["China", 35.9, 104.2], ["Russia", 61.5, 105.3]], physical: [["Pacific Ocean", 35.0, 150.0, "feature"], ["Sea of Japan", 40.0, 135.0, "feature"]] },
  Pakistan: { nearby: [["India", 22.8, 79.0], ["Afghanistan", 33.9, 67.7], ["Iran", 32.4, 53.7]], physical: [["Indus", 29.5, 70.5, "river"], ["Arabian Sea", 22.0, 65.0, "feature"], ["Karakoram", 35.5, 76.5, "mountain"]] },
  Bangladesh: { nearby: [["India", 22.8, 79.0], ["Myanmar", 21.9, 95.9]], physical: [["Ganga-Brahmaputra Delta", 22.4, 90.0, "river"], ["Bay of Bengal", 16.0, 88.0, "feature"]] },
  Nepal: { nearby: [["India", 22.8, 79.0], ["China", 35.9, 104.2]], physical: [["Himalaya", 28.2, 84.0, "mountain"], ["Koshi", 27.2, 87.1, "river"]] },
  Bhutan: { nearby: [["India", 22.8, 79.0], ["China", 35.9, 104.2]], physical: [["Eastern Himalaya", 27.5, 90.5, "mountain"], ["Manas", 26.9, 90.9, "river"]] },
  "Sri Lanka": { nearby: [["India", 22.8, 79.0], ["Maldives", 3.2, 73.2]], physical: [["Indian Ocean", 5.0, 80.0, "feature"], ["Palk Strait", 9.5, 79.5, "feature"]] },
  Maldives: { nearby: [["India", 22.8, 79.0], ["Sri Lanka", 7.9, 80.8]], physical: [["Indian Ocean", 3.0, 73.0, "feature"], ["Eight Degree Channel", 8.0, 73.0, "feature"]] },
  Myanmar: { nearby: [["India", 22.8, 79.0], ["Thailand", 15.9, 100.9], ["China", 35.9, 104.2]], physical: [["Andaman Sea", 12.0, 96.0, "feature"], ["Irrawaddy", 20.0, 95.0, "river"], ["Arakan Yoma", 20.0, 94.0, "mountain"]] },
};

// Compact atlas layers used only when they improve exam-oriented geography.
// These are stable reference locations, not model-generated coordinates.
const STATE_NEIGHBORS = {
  Delhi: [["Haryana", 29.0588, 76.0856], ["Uttar Pradesh", 26.8467, 80.9462]],
  Maharashtra: [["Gujarat", 22.2587, 71.1924], ["Madhya Pradesh", 22.9734, 78.6569], ["Karnataka", 15.3173, 75.7139], ["Goa", 15.2993, 74.124]],
  Rajasthan: [["Gujarat", 22.2587, 71.1924], ["Haryana", 29.0588, 76.0856], ["Madhya Pradesh", 22.9734, 78.6569], ["Uttar Pradesh", 26.8467, 80.9462]],
  Gujarat: [["Rajasthan", 27.0238, 74.2179], ["Madhya Pradesh", 22.9734, 78.6569], ["Maharashtra", 19.7515, 75.7139]],
  "Uttar Pradesh": [["Uttarakhand", 30.0668, 79.0193], ["Haryana", 29.0588, 76.0856], ["Rajasthan", 27.0238, 74.2179], ["Madhya Pradesh", 22.9734, 78.6569], ["Bihar", 25.0961, 85.3131]],
  Bihar: [["Uttar Pradesh", 26.8467, 80.9462], ["Jharkhand", 23.6102, 85.2799], ["West Bengal", 22.9868, 87.855]],
  "West Bengal": [["Bihar", 25.0961, 85.3131], ["Jharkhand", 23.6102, 85.2799], ["Odisha", 20.9517, 85.0985], ["Sikkim", 27.533, 88.5122], ["Assam", 26.2006, 92.9376]],
  Assam: [["Arunachal Pradesh", 28.218, 94.7278], ["Nagaland", 26.1584, 94.5624], ["Manipur", 24.6637, 93.9063], ["Meghalaya", 25.467, 91.3662], ["West Bengal", 22.9868, 87.855]],
  Odisha: [["West Bengal", 22.9868, 87.855], ["Jharkhand", 23.6102, 85.2799], ["Chhattisgarh", 21.2787, 81.8661], ["Andhra Pradesh", 15.9129, 79.74]],
  "Madhya Pradesh": [["Rajasthan", 27.0238, 74.2179], ["Gujarat", 22.2587, 71.1924], ["Maharashtra", 19.7515, 75.7139], ["Chhattisgarh", 21.2787, 81.8661], ["Uttar Pradesh", 26.8467, 80.9462]],
  Chhattisgarh: [["Madhya Pradesh", 22.9734, 78.6569], ["Maharashtra", 19.7515, 75.7139], ["Odisha", 20.9517, 85.0985], ["Jharkhand", 23.6102, 85.2799], ["Telangana", 18.1124, 79.0193]],
  Jharkhand: [["Bihar", 25.0961, 85.3131], ["West Bengal", 22.9868, 87.855], ["Odisha", 20.9517, 85.0985], ["Chhattisgarh", 21.2787, 81.8661]],
  Karnataka: [["Goa", 15.2993, 74.124], ["Maharashtra", 19.7515, 75.7139], ["Telangana", 18.1124, 79.0193], ["Andhra Pradesh", 15.9129, 79.74], ["Tamil Nadu", 11.1271, 78.6569], ["Kerala", 10.8505, 76.2711]],
  Kerala: [["Karnataka", 15.3173, 75.7139], ["Tamil Nadu", 11.1271, 78.6569]],
  "Tamil Nadu": [["Kerala", 10.8505, 76.2711], ["Karnataka", 15.3173, 75.7139], ["Andhra Pradesh", 15.9129, 79.74]],
  Telangana: [["Maharashtra", 19.7515, 75.7139], ["Chhattisgarh", 21.2787, 81.8661], ["Karnataka", 15.3173, 75.7139], ["Andhra Pradesh", 15.9129, 79.74]],
  "Andhra Pradesh": [["Odisha", 20.9517, 85.0985], ["Chhattisgarh", 21.2787, 81.8661], ["Telangana", 18.1124, 79.0193], ["Karnataka", 15.3173, 75.7139], ["Tamil Nadu", 11.1271, 78.6569]],
  Sikkim: [["West Bengal", 22.9868, 87.855]],
  Uttarakhand: [["Himachal Pradesh", 31.1048, 77.1734], ["Uttar Pradesh", 26.8467, 80.9462]],
  "Himachal Pradesh": [["Punjab", 31.1471, 75.3412], ["Haryana", 29.0588, 76.0856], ["Uttarakhand", 30.0668, 79.0193]],
  "Arunachal Pradesh": [["Assam", 26.2006, 92.9376], ["Nagaland", 26.1584, 94.5624]],
  Punjab: [["Himachal Pradesh", 31.1048, 77.1734], ["Haryana", 29.0588, 76.0856], ["Rajasthan", 27.0238, 74.2179]],
  Haryana: [["Punjab", 31.1471, 75.3412], ["Himachal Pradesh", 31.1048, 77.1734], ["Rajasthan", 27.0238, 74.2179], ["Uttar Pradesh", 26.8467, 80.9462]],
  Goa: [["Maharashtra", 19.7515, 75.7139], ["Karnataka", 15.3173, 75.7139]],
  Meghalaya: [["Assam", 26.2006, 92.9376]],
  Nagaland: [["Assam", 26.2006, 92.9376], ["Arunachal Pradesh", 28.218, 94.7278], ["Manipur", 24.6637, 93.9063]],
  Manipur: [["Nagaland", 26.1584, 94.5624], ["Assam", 26.2006, 92.9376], ["Mizoram", 23.1645, 92.9376]],
  Mizoram: [["Assam", 26.2006, 92.9376], ["Manipur", 24.6637, 93.9063], ["Tripura", 23.9408, 91.9882]],
  Tripura: [["Assam", 26.2006, 92.9376], ["Mizoram", 23.1645, 92.9376]],
  "Jammu & Kashmir": [["Himachal Pradesh", 31.1048, 77.1734], ["Ladakh", 34.1526, 77.5771]],
  Ladakh: [["Jammu & Kashmir", 33.7782, 76.5762], ["Himachal Pradesh", 31.1048, 77.1734]],
};

const PROTECTED_ATLAS = {
  Delhi: [["Asola Bhatti WLS", 28.47, 77.24, "sanctuary"]],
  Maharashtra: [["Tadoba-Andhari TR", 20.25, 79.35, "park"], ["Sanjay Gandhi NP", 19.23, 72.91, "park"]],
  Rajasthan: [["Ranthambore NP", 26.02, 76.5, "park"], ["Keoladeo NP", 27.16, 77.52, "park"]],
  Gujarat: [["Gir NP", 21.12, 70.82, "park"], ["Wild Ass Sanctuary", 23.3, 71.3, "sanctuary"]],
  "Uttar Pradesh": [["Dudhwa NP", 28.49, 80.68, "park"], ["National Chambal Sanctuary", 26.74, 78.55, "sanctuary"]],
  Bihar: [["Valmiki NP", 27.31, 84.22, "park"], ["Vikramshila Dolphin Sanctuary", 25.31, 87.25, "sanctuary"]],
  "West Bengal": [["Sundarbans NP", 21.95, 88.88, "park"], ["Jaldapara NP", 26.69, 89.28, "park"]],
  Assam: [["Kaziranga NP", 26.58, 93.17, "park"], ["Manas NP", 26.72, 91.03, "park"]],
  Odisha: [["Similipal NP", 21.93, 86.35, "park"], ["Bhitarkanika NP", 20.72, 86.9, "park"]],
  "Madhya Pradesh": [["Kanha NP", 22.33, 80.61, "park"], ["Kuno NP", 25.53, 77.23, "park"]],
  Chhattisgarh: [["Indravati NP", 19.2, 81.02, "park"], ["Achanakmar WLS", 22.49, 81.75, "sanctuary"]],
  Jharkhand: [["Betla NP", 23.89, 84.19, "park"], ["Dalma WLS", 22.89, 86.13, "sanctuary"]],
  Karnataka: [["Bandipur NP", 11.67, 76.63, "park"], ["Nagarahole NP", 12.04, 76.12, "park"]],
  Kerala: [["Periyar NP", 9.46, 77.24, "park"], ["Eravikulam NP", 10.2, 77.07, "park"]],
  "Tamil Nadu": [["Gulf of Mannar Marine NP", 9.12, 79.12, "park"], ["Mudumalai TR", 11.58, 76.57, "park"]],
  Telangana: [["Kawal TR", 19.17, 78.98, "park"], ["Eturnagaram WLS", 18.3, 80.33, "sanctuary"]],
  "Andhra Pradesh": [["Sri Venkateswara NP", 13.68, 79.35, "park"], ["Coringa WLS", 16.8, 82.28, "sanctuary"]],
  Sikkim: [["Khangchendzonga NP", 27.7, 88.15, "park"], ["Fambong Lho WLS", 27.32, 88.59, "sanctuary"]],
  Uttarakhand: [["Jim Corbett NP", 29.53, 78.77, "park"], ["Nanda Devi NP", 30.42, 79.85, "park"]],
  "Himachal Pradesh": [["Great Himalayan NP", 31.73, 77.55, "park"], ["Kibber WLS", 32.33, 78.0, "sanctuary"]],
  "Arunachal Pradesh": [["Namdapha NP", 27.49, 96.38, "park"], ["Pakke TR", 27.04, 92.88, "park"]],
  "Andaman & Nicobar Islands": [["Mahatma Gandhi Marine NP", 11.58, 92.62, "park"], ["Campbell Bay NP", 7.0, 93.93, "park"]],
  Punjab: [["Harike WLS", 31.16, 75.01, "sanctuary"], ["Abohar WLS", 30.14, 74.22, "sanctuary"]],
  Haryana: [["Sultanpur NP", 28.46, 76.89, "park"], ["Kalesar NP", 30.38, 77.49, "park"]],
  Goa: [["Mollem NP", 15.31, 74.25, "park"], ["Bhagwan Mahavir WLS", 15.34, 74.24, "sanctuary"]],
  Meghalaya: [["Nokrek NP", 25.47, 90.32, "park"], ["Balpakram NP", 25.22, 90.86, "park"]],
  Nagaland: [["Ntangki NP", 25.57, 93.64, "park"], ["Fakim WLS", 25.82, 94.98, "sanctuary"]],
  Manipur: [["Keibul Lamjao NP", 24.5, 93.82, "park"], ["Yangoupokpi-Lokchao WLS", 24.34, 94.25, "sanctuary"]],
  Mizoram: [["Murlen NP", 23.67, 93.28, "park"], ["Phawngpui NP", 22.63, 93.03, "park"]],
  Tripura: [["Clouded Leopard NP", 23.67, 91.32, "park"], ["Sepahijala WLS", 23.67, 91.32, "sanctuary"]],
  "Jammu & Kashmir": [["Dachigam NP", 34.14, 75.03, "park"], ["Kazinag NP", 34.35, 74.15, "park"]],
  Ladakh: [["Hemis NP", 33.95, 77.6, "park"], ["Changthang WLS", 33.25, 78.5, "sanctuary"]],
  Lakshadweep: [["Pitti Bird Sanctuary", 10.78, 72.54, "sanctuary"]],
};

function normaliseLocations(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).slice(0, 4);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, 4) : [];
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 4);
  }
}

function keyFor(value = "") {
  return String(value).toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsLocation(text, location) {
  if (!text || !location) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(location)}(?=$|[^a-z0-9])`, "i").test(text);
}

function knownLocationKey(value = "") {
  const key = keyFor(value);
  const aliased = LOCATION_ALIASES[key] || key;
  if (INDIA_LOCATIONS[aliased] || WORLD_LOCATIONS[aliased]) return aliased;

  const aliasMatch = Object.keys(LOCATION_ALIASES)
    .sort((left, right) => right.length - left.length)
    .find((alias) => containsLocation(key, alias));
  if (aliasMatch) return LOCATION_ALIASES[aliasMatch];

  return [...Object.keys(INDIA_LOCATIONS), ...Object.keys(WORLD_LOCATIONS)]
    .sort((left, right) => right.length - left.length)
    .find((candidate) => containsLocation(key, candidate)) || key;
}

function inferLocations(title = "", articleText = "") {
  const selected = [];
  const seen = new Set();
  const candidates = [
    ...Object.entries(LOCATION_ALIASES).map(([term, canonical]) => ({ term, canonical })),
    ...Object.keys(INDIA_LOCATIONS).map((term) => ({ term, canonical: term })),
    ...Object.keys(WORLD_LOCATIONS).map((term) => ({ term, canonical: term })),
  ].sort((left, right) => right.term.length - left.term.length);

  const collect = (value, allowGenericIndia) => {
    const text = keyFor(value);
    for (const candidate of candidates) {
      if (selected.length >= 4) break;
      if (!allowGenericIndia && candidate.canonical === "india") continue;
      if (!containsLocation(text, candidate.term)) continue;
      const resolved = resolveLocation(candidate.canonical);
      const identity = `${resolved.mapType}:${resolved.label}`;
      if (!resolved.point || seen.has(identity)) continue;
      seen.add(identity);
      selected.push(resolved.label);
    }
  };

  collect(title, true);
  collect(articleText, false);
  return selected;
}

function articleLocations(mapLocations, title, articleText, category = "") {
  if (!isMapRelevantArticle({ title, category, text: articleText, mapLocations })) return [];
  const combinedText = `${title} ${articleText}`;
  if (/\b(?:hallaniyat|khuriya muriya|kuria muria)\b/i.test(combinedText)) return ["Hallaniyat Islands", "Dhofar", "Oman"];
  const stored = filterRelevantMapLocations({ title, category, text: articleText, mapLocations });
  const resolvedStored = stored.filter((location) => resolveLocation(location).point);
  const inferred = inferLocations(title, articleText);
  const combined = [...resolvedStored, ...inferred];
  const seen = new Set();
  return combined.filter((location) => {
    const meta = resolveLocation(location);
    const identity = `${meta.mapType}:${meta.label}`;
    if (!meta.point || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  }).slice(0, 6);
}

function geoPoint(lat, lon, bounds) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const x = ((lon - bounds.west) / (bounds.east - bounds.west)) * 100;
  const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * 100;
  if (x < 0 || x > 100 || y < 0 || y > 100) return null;
  return [x, y];
}

function resolveLocation(location = "") {
  const key = knownLocationKey(location);
  if (INDIA_LOCATIONS[key]) {
    const item = INDIA_LOCATIONS[key];
    return {
      mapType: "india",
      label: item.label || location,
      country: "India",
      state: item.state || "",
      city: item.city || "",
      point: geoPoint(item.lat, item.lon, INDIA_BOUNDS),
      lat: item.lat,
      lon: item.lon,
    };
  }
  if (WORLD_LOCATIONS[key]) {
    const item = WORLD_LOCATIONS[key];
    return {
      mapType: "world",
      label: item.label || location,
      country: item.country || item.label,
      state: "",
      city: "",
      point: geoPoint(item.lat, item.lon, WORLD_BOUNDS),
      lat: item.lat,
      lon: item.lon,
    };
  }
  return {
    mapType: "world",
    label: location,
    country: "Location",
    state: "",
    city: "",
    point: null,
    lat: null,
    lon: null,
  };
}

function Marker({ point, label, variant = "focus" }) {
  if (!point) return null;
  return (
    <span className={`geo-marker geo-marker--${variant}`} style={{ left: `${point[0]}%`, top: `${point[1]}%` }}>
      <i />
      <b>{label}</b>
    </span>
  );
}

function LocationTrail({ meta }) {
  const trail = [];
  if (meta.mapType === "india") trail.push(["Country", "India"]);
  else if (meta.country && meta.country !== "World") trail.push(["Country", meta.country]);
  if (meta.state && meta.state !== "India") trail.push(["State", meta.state]);
  if (meta.city) trail.push(["Place", meta.city]);
  else if (meta.label && !trail.some(([, value]) => value === meta.label)) trail.push(["Focus", meta.label]);

  return (
    <div className="atlas-location-trail" aria-label="Location hierarchy">
      {trail.map(([type, value], index) => (
        <span key={`${type}-${value}`}>
          <small>{type}</small>
          <strong>{value}</strong>
          {index < trail.length - 1 && <em>→</em>}
        </span>
      ))}
    </div>
  );
}

function MapPanel({ title, icon, asset, meta, physical = false, context = [], regional = false, compact = true }) {
  const isIndia = meta.mapType === "india";
  return (
    <div className={`geo-map-panel ${compact ? "geo-map-panel--compact" : ""} ${isIndia ? "geo-map-panel--india" : "geo-map-panel--world"}`}>
      <div className="geo-map-panel-head">
        <span>{icon}{title}</span>
      </div>
      <div className={`geo-map-frame ${isIndia ? "geo-map-frame--india" : "geo-map-frame--world"}`}>
        <div
          className={`geo-map-canvas ${regional ? "geo-map-canvas--regional" : ""}`}
          style={regional && meta.point ? { "--map-origin-x": `${meta.point[0]}%`, "--map-origin-y": `${meta.point[1]}%` } : undefined}
        >
          <img src={asset} alt={`${physical ? "Physical" : "Political"} locator map for ${meta.label}`} />
          {context.map((item) => <Marker key={`${item.label}-${item.variant}`} point={item.point} label={item.label} variant={item.variant} />)}
          <Marker point={meta.point} label={meta.label} />
        </div>
      </div>
    </div>
  );
}

function stateContextMarkers(state, bounds) {
  return (STATE_NEIGHBORS[state] || []).slice(0, 5).map(([label, lat, lon]) => ({
    label,
    point: geoPoint(lat, lon, bounds),
    variant: "state",
  }));
}

function protectedContextMarkers(state, bounds, focusMeta = {}) {
  const focusLat = Number(focusMeta.lat);
  const focusLon = Number(focusMeta.lon);
  return [...(PROTECTED_ATLAS[state] || [])]
    .sort((left, right) => {
      if (!Number.isFinite(focusLat) || !Number.isFinite(focusLon)) return 0;
      const leftDistance = Math.hypot(Number(left[1]) - focusLat, Number(left[2]) - focusLon);
      const rightDistance = Math.hypot(Number(right[1]) - focusLat, Number(right[2]) - focusLon);
      return leftDistance - rightDistance;
    })
    .slice(0, 4)
    .map(([label, lat, lon, type]) => ({
      label,
      point: geoPoint(lat, lon, bounds),
      variant: type || "park",
    }));
}

export default function ArticleStudyVisuals({ mapLocations, title = "", articleText = "", category = "" }) {
  const locations = useMemo(
    () => articleLocations(mapLocations, title, articleText, category),
    [articleText, category, mapLocations, title]
  );
  const [selectedLocation, setSelectedLocation] = useState(locations[0] || "");
  if (!locations.length) return null;

  // When a newly inferred location replaces a previous tab after navigation,
  // render the first valid location instead of an orphaned selection.
  const activeLocation = locations.includes(selectedLocation) ? selectedLocation : locations[0];
  const meta = resolveLocation(activeLocation);
  const politicalAsset = meta.mapType === "india"
    ? "/maps/india-location-map.svg"
    : "/maps/world-location-map.svg";
  const physicalAsset = meta.mapType === "india"
    ? "/maps/india-relief-location-map.jpg"
    : "/maps/world-physical-map.jpg";
  const regional = meta.mapType === "india" ? REGIONAL_ATLAS[meta.state] : WORLD_ATLAS[meta.country];
  const mapBounds = meta.mapType === "india" ? INDIA_BOUNDS : WORLD_BOUNDS;
  const contextMarkers = (items = [], physical = false) => items.map(([label, lat, lon, type]) => ({
    label, point: geoPoint(lat, lon, mapBounds), variant: physical ? (type || "feature") : "nearby",
  })).filter((item) => item.point);
  const locationPool = meta.mapType === "india" ? Object.values(INDIA_LOCATIONS) : Object.values(WORLD_LOCATIONS);
  const longitudeDistance = (left, right) => Math.min(Math.abs(left - right), 360 - Math.abs(left - right));
  const automaticNearby = meta.state
    ? locationPool
        .filter((item) => item.state === meta.state && item.city && item.label !== meta.label)
        .filter((item, index, all) => all.findIndex((candidate) => candidate.label === item.label) === index)
        .sort((left, right) => {
          const leftDistance = Math.hypot(left.lat - meta.lat, left.lon - meta.lon);
          const rightDistance = Math.hypot(right.lat - meta.lat, right.lon - meta.lon);
          return leftDistance - rightDistance;
        })
        .slice(0, 3)
        .map((item) => [item.label, item.lat, item.lon])
    : meta.mapType === "world" && meta.point
      ? locationPool
          .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon) && item.label !== meta.label && item.country !== "World")
          .filter((item, index, all) => all.findIndex((candidate) => candidate.label === item.label) === index)
          .sort((left, right) => {
            const leftDistance = Math.hypot(left.lat - meta.lat, longitudeDistance(left.lon, meta.lon));
            const rightDistance = Math.hypot(right.lat - meta.lat, longitudeDistance(right.lon, meta.lon));
            return leftDistance - rightDistance;
          })
          .slice(0, 4)
          .map((item) => [item.label, item.lat, item.lon])
      : [];
  const nearby = contextMarkers(regional?.nearby?.length ? regional.nearby : automaticNearby);
  const features = contextMarkers(regional?.physical, true);
  const waterFeatures = features.filter((item) => ["river", "feature"].includes(item.variant));
  const reliefFeatures = features.filter((item) => item.variant === "mountain");
  const mentionsIndia = /\bindia(?:n|'s|’s)?\b/i.test(`${title} ${articleText}`);
  const indiaWorldContext = meta.mapType === "world" && mentionsIndia && meta.country !== "India"
    ? [{ label: "India", point: geoPoint(22.8, 79.0, WORLD_BOUNDS), variant: "nearby" }]
    : [];
  const neighbourStates = meta.mapType === "india" && meta.state ? stateContextMarkers(meta.state, mapBounds).filter((item) => item.point) : [];
  const protectedAreas = meta.mapType === "india" && meta.state ? protectedContextMarkers(meta.state, mapBounds, meta).filter((item) => item.point) : [];

  const panels = meta.mapType === "india"
    ? [
        { key: "india", title: "India locator", icon: <LocateFixed size={13} />, asset: politicalAsset, context: [], regional: false },
        ...(neighbourStates.length ? [{ key: "states", title: "Nearby states", icon: <MapIcon size={13} />, asset: politicalAsset, context: neighbourStates, regional: true }] : []),
        ...(nearby.length ? [{ key: "places", title: "Regional places", icon: <MapPin size={13} />, asset: politicalAsset, context: nearby, regional: true }] : []),
        ...(features.length ? [{ key: "physical", title: "Rivers & relief", icon: <Waves size={13} />, asset: physicalAsset, context: features, regional: true, physical: true }] : []),
        ...(protectedAreas.length ? [{ key: "protected", title: "NP / WLS nearby", icon: <Trees size={13} />, asset: politicalAsset, context: protectedAreas, regional: true }] : []),
      ].slice(0, 6)
    : [
        { key: "world", title: "World locator", icon: <LocateFixed size={13} />, asset: politicalAsset, context: [], regional: false },
        ...(indiaWorldContext.length ? [{ key: "india-context", title: "India context", icon: <MapPin size={13} />, asset: politicalAsset, context: indiaWorldContext, regional: false }] : []),
        ...(nearby.length ? [{ key: "region", title: "Regional countries", icon: <MapIcon size={13} />, asset: politicalAsset, context: nearby, regional: true }] : []),
        ...(waterFeatures.length ? [{ key: "waters", title: "Seas & rivers", icon: <Waves size={13} />, asset: physicalAsset, context: waterFeatures, regional: true, physical: true }] : []),
        ...(reliefFeatures.length ? [{ key: "relief", title: "Relief / ranges", icon: <Mountain size={13} />, asset: physicalAsset, context: reliefFeatures, regional: true, physical: true }] : []),
        ...(!waterFeatures.length && !reliefFeatures.length && features.length ? [{ key: "physical", title: "Physical setting", icon: <Mountain size={13} />, asset: physicalAsset, context: features, regional: true, physical: true }] : []),
      ].slice(0, 6);

  return (
    <section id="article-map" className="atlas-locator-card atlas-locator-card--compact scroll-mt-28" aria-label="Static location maps for this article">
      <div className="atlas-locator-head atlas-locator-head--compact">
        <div>
          <span><MapPin size={14} /> Map focus</span>
          <h2>{meta.label}</h2>
        </div>
        {meta.point && <small>{meta.lat.toFixed(2)}°, {meta.lon.toFixed(2)}° · maps only where geography matters</small>}
      </div>

      <LocationTrail meta={meta} />

      <div className={`geo-map-grid geo-map-grid--atlas-${Math.min(3, panels.length)}`}>
        {panels.map((panel) => (
          <MapPanel
            key={panel.key}
            title={panel.title}
            icon={panel.icon}
            asset={panel.asset}
            meta={meta}
            context={panel.context}
            regional={panel.regional}
            physical={panel.physical}
          />
        ))}
      </div>

      {(neighbourStates.length > 0 || nearby.length > 0 || features.length > 0 || protectedAreas.length > 0) && (
        <div className="atlas-context-list atlas-context-list--compact">
          {neighbourStates.length > 0 && <span><strong>States:</strong> {neighbourStates.map((item) => item.label).join(" · ")}</span>}
          {nearby.length > 0 && <span><strong>Nearby:</strong> {nearby.map((item) => item.label).join(" · ")}</span>}
          {features.length > 0 && <span><strong>Physical:</strong> {features.map((item) => item.label).join(" · ")}</span>}
          {protectedAreas.length > 0 && <span><strong>Protected:</strong> {protectedAreas.map((item) => item.label).join(" · ")}</span>}
        </div>
      )}

      {locations.length > 1 && <div className="atlas-location-tabs" aria-label="Locations mentioned in article">
        {locations.map((location) => {
          const resolved = resolveLocation(location);
          return (
            <button
              key={location}
              type="button"
              onClick={() => setSelectedLocation(location)}
              className={resolved.label === meta.label ? "is-active" : ""}
            >
              {resolved.label}
            </button>
          );
        })}
      </div>}
    </section>
  );
}
