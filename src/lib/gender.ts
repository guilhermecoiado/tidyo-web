// Guess grammatical gender from a first name, for labels like "Dono/Dona".
// 'u' means we could not tell; callers then use a neutral wording.
export type Gender = 'f' | 'm' | 'u';

const FEMALE = new Set(`
alice beatriz raquel isabel isabela carmen ruth rute ester esther liz lis ines inês irene simone michele michelle nicole caroline carol
gabrielle rachel miriam yasmin jasmin jasmine ingrid eloise heloise heloísa lourdes mercedes dolores luz pilar consuelo socorro guadalupe
karen jennifer sarah sara megan meghan ashley kimberly kim emily emilie madison allison alison hannah leah elizabeth beth mary
susan sue jane janet janice ann anne annie joan jean lauren kathleen kathryn catherine kate katie karen sharon shannon heather
amber taylor morgan brooke grace hope faith joy lily lilly rose ruby violet hazel ivy scarlett harper avery evelyn abigail
chloe zoe zoey madeline madelyn jocelyn evelyn kaylee hailey bailey riley natalie danielle gabrielle mia ava emma olivia sophia isabella amelia charlotte mila nina tracy stacy wendy cindy lucy mandy judy betty dorothy shirley beverly rebecca
doris lois agnes iris gladys frances alexis paris ines mercedes noemi noémi rocío rocio itziar raquel abril beatrix
`.split(/\s+/).filter(Boolean));

const MALE = new Set(`
gui luca lucca joshua jonah elias nicolas nicola andrea mattia sasha misha noah jesse dante isaiah jeremiah zacharia
josué josue tomas tomás matias matías barnaba ezra micah elijah josiah isaiah charlie eddie willie freddie bobbie robbie ronnie archie johnnie stevie
`.split(/\s+/).filter(Boolean));

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function guessGender(fullName: string | null | undefined): Gender {
  const raw = (fullName || '').trim().split(/\s+/)[0] || '';
  if (!raw) return 'u';
  const n = strip(raw).replace(/[^a-z]/g, '');
  if (!n) return 'u';
  if (MALE.has(n)) return 'm';
  if (FEMALE.has(n) || FEMALE.has(raw.toLowerCase())) return 'f';
  if (/a$/.test(n)) return 'f';
  if (/(elle|ette|ine|lyn|lynn|een|ie|ah)$/.test(n) && n.length > 3) return 'f';
  if (/(o|i|u|n|l|m|k|d|t|f|z|x|r|s|y|e|c|g|p|b|h|j|v|w)$/.test(n)) return 'm';
  return 'u';
}

// Pick the gendered variant of an i18n key: base key is feminine, `.m` masculine, `.u` neutral.
export const gKey = (key: string, g: Gender) => (g === 'f' ? key : `${key}.${g}`);
