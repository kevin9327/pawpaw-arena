const NAMES = ['초코', '마루', '꿀꿀이', '나비', '보리', '콩이', '두부', '모찌', '까미', '해피',
  'Mochi', 'Biscuit', 'Waffle', 'Peanut', 'Nugget', 'Pudding', 'Choco', 'Bean', 'Tofu', 'Latte'];
export function pickBotName(rng) {
  return NAMES[Math.floor(rng() * NAMES.length)];
}
