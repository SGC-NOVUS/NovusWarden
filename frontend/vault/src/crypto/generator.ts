// High-Security Password & Passphrase Generator with Cryptographic Quality
// NovusWarden Enterprise Zero-Knowledge Suite
// CSPRNG-backed (window.crypto.getRandomValues)

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
const SPECIAL = '!@#$%^&*()-_=+[]{}|;:,.<>?';
const AMBIGUOUS = 'Il1O0o';

// Curated high-entropy wordlist for passphrases (easy to memorize, hard to crack)
const EFF_WORDLIST = [
  'ability', 'absorb', 'abstract', 'academy', 'access', 'accord', 'account', 'acoustic',
  'acquire', 'across', 'action', 'active', 'actual', 'adapt', 'addition', 'address',
  'advance', 'advice', 'affair', 'affect', 'affirm', 'afford', 'agency', 'agenda',
  'agent', 'agree', 'airport', 'alarm', 'album', 'alert', 'alien', 'allied',
  'allow', 'alpha', 'alpine', 'alter', 'amazing', 'amber', 'ambient', 'amount',
  'anchor', 'ancient', 'angel', 'animal', 'anthem', 'apollo', 'apology', 'appeal',
  'apple', 'applied', 'appoint', 'apron', 'arcade', 'arctic', 'arena', 'armor',
  'arrow', 'artist', 'aspect', 'asset', 'assist', 'assume', 'astron', 'atomic',
  'attack', 'attend', 'august', 'aurora', 'author', 'avatar', 'avenue', 'average',
  'balance', 'bamboo', 'banana', 'banner', 'baron', 'barrier', 'beacon', 'beauty',
  'become', 'before', 'begin', 'behalf', 'behave', 'behind', 'belief', 'belong',
  'benefit', 'berlin', 'beyond', 'bicycle', 'binary', 'biology', 'biscuit', 'bishop',
  'bitter', 'blanket', 'blender', 'blessing', 'blossom', 'boating', 'boulder', 'boundary',
  'bracket', 'breeze', 'bridge', 'bright', 'bronze', 'brother', 'bubble', 'budget',
  'buffalo', 'builder', 'bullet', 'bundle', 'burden', 'butter', 'cabinet', 'cactus',
  'cadet', 'calcium', 'camera', 'campus', 'candle', 'canyon', 'capable', 'capital',
  'captain', 'caption', 'capture', 'carbon', 'cardiac', 'career', 'careful', 'carrier',
  'castle', 'casual', 'catalyst', 'catalog', 'cattle', 'cavern', 'celestial', 'cellular',
  'cement', 'central', 'century', 'ceramic', 'cereal', 'chamber', 'champion', 'channel',
  'chapter', 'charger', 'charity', 'charming', 'charter', 'chemistry', 'cherry', 'chestnut',
  'chicken', 'chimney', 'chronic', 'circuit', 'citizen', 'citrus', 'classic', 'climate',
  'clinic', 'clover', 'cluster', 'coastal', 'coconut', 'coffee', 'cohesion', 'collapse',
  'collect', 'college', 'colony', 'column', 'combine', 'comedy', 'comfort', 'command',
  'comment', 'compact', 'company', 'compass', 'compile', 'complex', 'compute', 'concept',
  'concert', 'conduit', 'connect', 'consent', 'console', 'constant', 'contact', 'contain',
  'context', 'control', 'convert', 'copper', 'corner', 'corona', 'corridor', 'cosmic',
  'cotton', 'counsel', 'counter', 'country', 'courage', 'covenant', 'crater', 'creative',
  'credit', 'cricket', 'crimson', 'crisis', 'criteria', 'crucial', 'crystal', 'cube',
  'culture', 'current', 'curtain', 'cushion', 'cyber', 'cylinder', 'daisy', 'damage',
  'dancer', 'danger', 'daring', 'darkness', 'daughter', 'daylight', 'decade', 'decide',
  'decimal', 'declare', 'defense', 'define', 'degree', 'deliver', 'delta', 'demand',
  'density', 'deposit', 'derive', 'desert', 'design', 'desire', 'destiny', 'detail',
  'detect', 'develop', 'device', 'diamond', 'digital', 'dilemma', 'dimension', 'dinner',
  'diploma', 'direct', 'disable', 'discard', 'discount', 'discover', 'display', 'distant',
  'diverse', 'divide', 'divine', 'doctor', 'document', 'domain', 'dolphin', 'domino',
  'dragon', 'drawing', 'dreamer', 'driver', 'dynamic', 'eager', 'earnest', 'eclipse',
  'ecology', 'economy', 'edition', 'educate', 'effective', 'elastic', 'electric', 'element',
  'elevator', 'elite', 'embrace', 'emerald', 'emission', 'emotion', 'empathy', 'emperor',
  'empire', 'enable', 'enchant', 'endless', 'endorse', 'energy', 'engine', 'enhance',
  'enigma', 'enjoy', 'enormous', 'enough', 'enroll', 'ensure', 'enterprise', 'entity',
  'entrance', 'envelope', 'epic', 'episode', 'epoch', 'equal', 'equation', 'equator',
  'era', 'erosion', 'escape', 'essay', 'essence', 'estate', 'eternal', 'ethics',
  'evidence', 'evolution', 'exact', 'examine', 'example', 'exceed', 'excel', 'exchange',
  'excite', 'execute', 'exercise', 'exhibit', 'expand', 'expect', 'expert', 'explain',
  'explore', 'express', 'extend', 'extract', 'extreme', 'fabric', 'factor', 'faculty',
  'falcon', 'fantasy', 'farmer', 'fashion', 'fatal', 'feather', 'feature', 'federal',
  'feedback', 'festival', 'fiber', 'fiction', 'fidelity', 'filter', 'finance', 'finger',
  'firewall', 'fitness', 'flavor', 'flexible', 'flight', 'floating', 'flourish', 'flow',
  'flutter', 'focus', 'folder', 'follow', 'forest', 'forever', 'formula', 'fortress',
  'fortune', 'forward', 'fossil', 'foster', 'founder', 'fraction', 'fragment', 'freedom',
  'frequency', 'friction', 'friend', 'frontier', 'frost', 'frozen', 'fuel', 'fulfill',
  'function', 'fundamental', 'furnace', 'fusion', 'future', 'galaxy', 'gallery', 'garment',
  'gateway', 'general', 'generic', 'genesis', 'genius', 'genuine', 'geology', 'geometry',
  'gesture', 'glacier', 'glamour', 'glance', 'glider', 'glimpse', 'global', 'glorious',
  'golden', 'goodness', 'governor', 'gradient', 'grammar', 'grand', 'granite', 'graphics',
  'grateful', 'gravity', 'green', 'grenade', 'ground', 'guardian', 'guidance', 'guitar',
  'habitat', 'halcyon', 'hammer', 'handbook', 'harbor', 'harmony', 'harvest', 'haven',
  'hazard', 'header', 'healing', 'healthy', 'hearing', 'heaven', 'height', 'helios',
  'helmet', 'helpful', 'heritage', 'heroic', 'hexagon', 'highway', 'historic', 'holder',
  'holiday', 'horizon', 'hospital', 'hostile', 'hourly', 'housing', 'human', 'humble',
  'humidity', 'hurricane', 'hybrid', 'hydraulic', 'hydrogen', 'hygiene', 'hyper', 'hyphen'
];

export interface PasswordGeneratorOptions {
  length: number; // default: 16
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  special: boolean;
  minNumbers?: number;
  minSpecial?: number;
  avoidAmbiguous?: boolean;
}

export interface PassphraseGeneratorOptions {
  wordsCount: number; // default: 4
  separator: string; // default: '-'
  capitalize: boolean;
  includeNumber: boolean;
}

/**
 * Returns a cryptographically secure random integer in range [0, max)
 */
function getRandomInt(max: number): number {
  const array = new Uint32Array(1);
  const maxSafe = Math.floor(0xffffffff / max) * max;
  let randomVal = 0;
  do {
    window.crypto.getRandomValues(array);
    randomVal = array[0];
  } while (randomVal >= maxSafe);
  return randomVal % max;
}

/**
 * Cryptographically shuffles an array in place (Fisher-Yates)
 */
function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Generates high-entropy password based on options
 */
export function generatePassword(opts: Partial<PasswordGeneratorOptions> = {}): string {
  const length = Math.max(8, Math.min(128, opts.length ?? 16));
  const useUpper = opts.uppercase ?? true;
  const useLower = opts.lowercase ?? true;
  const useNums = opts.numbers ?? true;
  const useSpec = opts.special ?? true;
  const avoidAmbiguous = opts.avoidAmbiguous ?? false;

  let upperSet = UPPERCASE;
  let lowerSet = LOWERCASE;
  let numSet = NUMBERS;
  let specSet = SPECIAL;

  if (avoidAmbiguous) {
    upperSet = upperSet.split('').filter(c => !AMBIGUOUS.includes(c)).join('');
    lowerSet = lowerSet.split('').filter(c => !AMBIGUOUS.includes(c)).join('');
    numSet = numSet.split('').filter(c => !AMBIGUOUS.includes(c)).join('');
  }

  let charset = '';
  const guaranteedChars: string[] = [];

  if (useUpper && upperSet) {
    charset += upperSet;
    guaranteedChars.push(upperSet[getRandomInt(upperSet.length)]);
  }
  if (useLower && lowerSet) {
    charset += lowerSet;
    guaranteedChars.push(lowerSet[getRandomInt(lowerSet.length)]);
  }
  if (useNums && numSet) {
    charset += numSet;
    guaranteedChars.push(numSet[getRandomInt(numSet.length)]);
  }
  if (useSpec && specSet) {
    charset += specSet;
    guaranteedChars.push(specSet[getRandomInt(specSet.length)]);
  }

  // Fallback to lowercase if everything was disabled
  if (!charset) {
    charset = lowerSet;
    guaranteedChars.push(lowerSet[getRandomInt(lowerSet.length)]);
  }

  const result: string[] = [...guaranteedChars];
  while (result.length < length) {
    result.push(charset[getRandomInt(charset.length)]);
  }

  return shuffle(result).slice(0, length).join('');
}

/**
 * Generates an easy-to-remember, high-entropy passphrase
 */
export function generatePassphrase(opts: Partial<PassphraseGeneratorOptions> = {}): string {
  const wordsCount = Math.max(3, Math.min(20, opts.wordsCount ?? 4));
  const separator = opts.separator ?? '-';
  const capitalize = opts.capitalize ?? true;
  const includeNumber = opts.includeNumber ?? true;

  const words: string[] = [];
  for (let i = 0; i < wordsCount; i++) {
    let word = EFF_WORDLIST[getRandomInt(EFF_WORDLIST.length)];
    if (capitalize) {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }
    words.push(word);
  }

  if (includeNumber) {
    const num = getRandomInt(100);
    const pos = getRandomInt(words.length);
    words[pos] = words[pos] + num;
  }

  return words.join(separator);
}

export interface PasswordScore {
  score: 0 | 1 | 2 | 3 | 4; // 0=Very Weak, 1=Weak, 2=Fair, 3=Strong, 4=Very Strong
  label: string;
  color: string;
  entropy: number;
  estimatedCrackTime: string;
}

/**
 * Computes entropy and password health score
 */
export function evaluatePasswordStrength(password: string): PasswordScore {
  if (!password) {
    return {
      score: 0,
      label: 'Пусто',
      color: '#ef4444',
      entropy: 0,
      estimatedCrackTime: '0 сек',
    };
  }

  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 33;

  if (poolSize === 0) poolSize = 10;

  // Shannon Entropy = len * log2(poolSize)
  const entropy = Math.round(password.length * Math.log2(poolSize));

  let score: 0 | 1 | 2 | 3 | 4 = 0;
  let label = 'Очень слабый';
  let color = '#ef4444';
  let estimatedCrackTime = 'Мгновенно';

  if (entropy < 28 || password.length < 8) {
    score = 0;
    label = 'Критически слабый';
    color = '#ef4444';
    estimatedCrackTime = '< 1 сек';
  } else if (entropy < 45 || password.length < 10) {
    score = 1;
    label = 'Слабый';
    color = '#f97316';
    estimatedCrackTime = 'Несколько минут';
  } else if (entropy < 60 || password.length < 12) {
    score = 2;
    label = 'Средний';
    color = '#eab308';
    estimatedCrackTime = 'Несколько месяцев';
  } else if (entropy < 80 || password.length < 16) {
    score = 3;
    label = 'Надёжный';
    color = '#10b981';
    estimatedCrackTime = 'Тысячи лет';
  } else {
    score = 4;
    label = 'Абсолютная защита';
    color = '#06b6d4';
    estimatedCrackTime = 'Миллиарды лет';
  }

  return {
    score,
    label,
    color,
    entropy,
    estimatedCrackTime,
  };
}

