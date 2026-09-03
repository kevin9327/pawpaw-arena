const NAMES_KO = ['초코', '마루', '꿀꿀이', '나비', '보리', '콩이', '두부', '모찌', '까미', '해피'];
const NAMES_EN = ['Mochi', 'Biscuit', 'Waffle', 'Peanut', 'Nugget', 'Pudding', 'Choco', 'Bean', 'Tofu', 'Latte'];
const NAMES = NAMES_KO.concat(NAMES_EN);
// locale: 'ko' | 'en' | undefined. 서버(온라인 방)는 다국적이라 미지정→혼합, 클라 봇 모드는 로케일 일치.
export function pickBotName(rng, locale) {
  const pool = locale === 'ko' ? NAMES_KO : locale === 'en' ? NAMES_EN : NAMES;
  return pool[Math.floor(rng() * pool.length)];
}
