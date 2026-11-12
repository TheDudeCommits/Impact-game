import type { FighterId } from '../../game/types';

export type BodyType = 'blade' | 'fists' | 'kicks' | 'polearm' | 'caster' | 'giant';
export type ElementKitId = 'fire' | 'blackflame' | 'explosion' | 'ice' | 'lightning' | 'beam' | 'will' | 'slash'
  | 'domain' | 'gravity' | 'summon' | 'windwater' | 'earth' | 'strings' | 'mecha' | 'strength';

export const BODY_TYPES: Readonly<Record<BodyType, { label: string; about: string }>> = {
  blade: { label: 'Blades', about: 'Swords, axes and chainsaws: draw, slash and iai clip sets, and a weapon-tip socket for trails.' },
  fists: { label: 'Fists', about: 'Strikers and brawlers: jab, straight and uppercut sets, and a palm socket for charge orbs.' },
  kicks: { label: 'Kicks', about: 'Kick-led fighters: kick strings and foot sockets.' },
  polearm: { label: 'Polearms & clubs', about: 'Clubs, glaives, staves and war fans: long-reach swing sets.' },
  caster: { label: 'Casters', about: 'Controllers whose moves are mostly the effect: gestures more than swings.' },
  giant: { label: 'Giants & mecha', about: 'Giants, mecha, monsters and armour: a heavy gait and a bigger body.' },
};

export const ELEMENT_KITS: Readonly<Record<ElementKitId, { label: string; about: string }>> = {
  fire: { label: 'Fire & magma', about: 'Flame streams, burning fists, pillars of fire, magma fists and meteors.' },
  blackflame: { label: 'Black flame', about: 'Fire that reads dark: black flame that clings, burns and spreads.' },
  explosion: { label: 'Explosions', about: 'Palm blasts, thunder spears and planet-sized bombs.' },
  ice: { label: 'Ice', about: 'Crystal fields, ice lances and frozen floors.' },
  lightning: { label: 'Lightning', about: 'Arcs, electric auras, strikes from the sky and lightning-fast steps.' },
  beam: { label: 'Beams, aura & light', about: 'Energy cannons, lasers and the charge before them.' },
  will: { label: 'Willpower', about: 'Black lightning of sheer will and an armoured coating.' },
  slash: { label: 'Slash waves', about: 'Flying slashes, iai cuts, sword trails and blade storms.' },
  domain: { label: 'Domains & hexes', about: 'Fields that take the floor over, illusions and hexed strikes.' },
  gravity: { label: 'Gravity & void', about: 'Pulls, pushes, black holes and psychic force.' },
  summon: { label: 'Summons & spirits', about: 'Guardian spirits, beasts, giant statues and shadow soldiers.' },
  windwater: { label: 'Wind & water', about: 'Air-pressure smashes, spinning wind blades, tornadoes and waves.' },
  earth: { label: 'Earth & alchemy', about: 'Transmutation, ground spikes, quakes and floor-breaking strength.' },
  strings: { label: 'Strings & petals', about: 'Threads, elastic lines, blooming hands and blade petals.' },
  mecha: { label: 'Giants & mecha', about: 'Giants, mecha, monsters and armour: the bridge to a Mecha pack.' },
  strength: { label: 'Raw strength', about: 'Fists, kicks and barrages that hit like trucks with no element at all.' },
};

const list = (ids: string) => ids.split(/\s+/).filter(Boolean) as FighterId[];

const BODY_LISTS: Readonly<Record<BodyType, readonly FighterId[]>> = {
  blade: list(`chohan yodaka nigo strix dorado sorrel wataame onigawara shidare hinomoto shiun shijima akayuri asahi akaito vesper hisame
    wuming hikui ward kenzo mizuhiki levin hawser rook shakudo sashigane lanthorn highsun gaunt kuzu tokan cardo bruin`),
  fists: list(`kagari irbis taisei ouga gohaku shanxiao banjaku ippon hagure gummy koko oro gosu kinu full-beam ampere
    pyroclast bellows sekka tempo gaku setsu bonsho madake kusushi ume oyashio rakucho imago shakugo
    jinlin minase konta shirokane shiden tobari barrow`),
  kicks: list('kosho senko basilissa suzuran mikage'),
  polearm: list('gorai buna haldor adad sorayomi akagane'),
  caster: list('tsubute aqrab kuon magatsu kubiwa torsion amagoi psyche strappado unari hakushi tancho aquilo svanhild'),
  giant: list('murex rotfalke ovid shibuichi'),
};

const ELEMENT_LISTS: Readonly<Record<ElementKitId, readonly FighterId[]>> = {
  fire: list('yodaka kagari bellows hinomoto hakushi akagane kosho asahi tancho highsun shakugo'),
  blackflame: list('shiden tobari hikui lanthorn'),
  explosion: list('tsubute pyroclast levin jinlin'),
  ice: list('tokan hisame shijima tancho'),
  lightning: list('shirokane shiden setsu adad sorayomi mikage ampere minase gorai buna'),
  beam: list('taisei ouga gohaku wuming jinlin shanxiao banjaku irbis shiun nigo ippon senko'),
  will: list('gummy sorrel dorado haldor gorai strix buna kenzo basilissa barrow oyashio'),
  slash: list(`chohan yodaka kenzo strix nigo shidare onigawara wataame akayuri mizuhiki levin hawser magatsu akaito asahi vesper gaunt rook
    kuzu dorado sorrel hisame wuming shakudo sashigane cardo bruin`),
  domain: list('kuon magatsu tempo akaito sashigane ward tobari'),
  gravity: list('amagoi barrow torsion kubiwa shiun kuon bruin'),
  summon: list('koko oro gosu kinu konta bonsho rook akagane'),
  windwater: list('aqrab oyashio hagure konta sorayomi full-beam ampere torsion suzuran asahi aquilo svanhild'),
  earth: list('aqrab shakudo shibuichi haldor kusushi ume ovid'),
  strings: list('tsubute strappado kinu unari shidare psyche ume basilissa'),
  mecha: list('murex rotfalke hawser ovid shibuichi'),
  strength: list('cardo chohan ippon hagure madake kusushi banjaku sekka bonsho gaku full-beam gummy koko tempo rakucho imago shanxiao gaunt kosho'),
};

const BODY_OF = new Map<FighterId, BodyType>();
for (const [type, ids] of Object.entries(BODY_LISTS) as [BodyType, readonly FighterId[]][]) for (const id of ids) BODY_OF.set(id, type);
const ELEMENTS_OF = new Map<FighterId, ElementKitId[]>();
for (const [kit, ids] of Object.entries(ELEMENT_LISTS) as [ElementKitId, readonly FighterId[]][]) for (const id of ids) ELEMENTS_OF.set(id, [...(ELEMENTS_OF.get(id) ?? []), kit]);

/** A fighter's body type; undefined for one the map doesn't know yet (tests/engineSpec.test.ts requires every fighter). */
export const bodyTypeOf = (id: FighterId): BodyType | undefined => BODY_OF.get(id);
/** A fighter's element kits, in the order the map lists them; empty for one it doesn't know yet. */
export const elementKitsOf = (id: FighterId): readonly ElementKitId[] => ELEMENTS_OF.get(id) ?? [];
/** Everyone in an element kit, or of a body type. */
export const membersOfKit = (kit: ElementKitId): readonly FighterId[] => ELEMENT_LISTS[kit];
export const membersOfBody = (type: BodyType): readonly FighterId[] => BODY_LISTS[type];
