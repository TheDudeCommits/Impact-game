import type { ComboKey } from '../game/combos';
import type { FighterId } from '../game/types';

/**
 * The clip each combo ender (game/combos.ts) is drawn with, per fighter, and where in it the blow lands (the share of
 * the clip at its contact frame, as contactFrames.json gives the slots' - read off the clip in clip_lab, or the
 * clip's own measured fraction where it is a slot's clip already). A fighter or an ender without a row is drawn with
 * its slot's clip, as before.
 */
export interface ComboClip {
  clip: string;
  /** Where the blow lands, as a share of what is played (the segment, where there is one). */
  contact?: number;
  /** Seconds into the clip that the move plays from and to: one blow of a longer take (a barrage's, an ultimate's). */
  from?: number; to?: number;
  /** How long the take these seconds and this contact were read off is. A body whose clip of that name is another length
   *  - a form's or an outfit's, another take under the same name - throws the slot's clip instead (Fighter's
   *  `enderClip`): the RAKSHASA's, SUNRISE's and NIGHTFALL's takes share their names with the base body's. */
  span?: number;
}
const seg = (clip: string, from: number, to: number, contact: number): ComboClip => ({ clip, from, to, contact });
/** A segment of a take whose length is known (`span`): only that take plays it (Fighter's `enderClip`). */
const v = (clip: string, from: number, to: number, contact: number, span: number): ComboClip => ({ clip, from, to, contact, span });
const whole = (clip: string, contact: number): ComboClip => ({ clip, contact });

export const COMBO_CLIPS: Partial<Record<FighterId, Partial<Record<ComboKey, ComboClip>>>> = {
  chohan:{lh:whole("Cheap Shot",0.5238095238095238),llh:whole("Upping the Ante",0.45),lllh:whole("No Refunds",0.5238095238095238),llls:whole("Debt Collector",0.5),airHeavy:whole("Dead Drop",0.5238095238095238),airSpecial:whole("Bust",0.5)},
  aqrab:{lh:whole("Golden Pincer",.34/.76),llh:whole("Antlion Pit",.38/.84),lllh:whole("Dune Shackle",.47),llls:whole("Thirst Burst",.55/1.1),airHeavy:whole("Dune Breaker",.47),airSpecial:whole("Stinger Drop",0.5)},
  tsubute:{lh:whole("Slate",0.4305555555555556),llh:whole("Leapfrog",0.45121951219512196),lllh:whole("Geode",0.49),llls:whole("Whirligig",0.5089285714285713),airHeavy:whole("Plunk",0.5),airSpecial:whole("Scree",0.5)},
  ume:{lh:whole("Magnolia Backfist",0.46),llh:whole("Rising Magnolia",0.54),lllh:whole("Shattering Blossom",0.62),llls:whole("Budburst Drive",0.46),airHeavy:whole("Aerial Blossom",0.62),airSpecial:whole("Bloomfall",0.62)},
  lanthorn:{lh:whole("Wick Turn",0.5816326530612245),llh:whole("Rising Lamplight",0.51),lllh:whole("Tavern Cleaver",0.6),llls:whole("Lampblack Drive",0.46666666666666673),airHeavy:whole("Falling Tankard",0.6),airSpecial:whole("Snuffer Landing",0.6)},
  highsun:{lh:whole("Lordly Turn",0.53),llh:whole("Morning Ascent",0.56),lllh:whole("Noonday Divide",0.56),llls:whole("Solar Reply",0.6),airHeavy:whole("Aerial Sunbeam",0.56),airSpecial:whole("Sunset Drop",0.6)},
  torsion:{lh:whole("About-Face",0.4305555555555556),llh:whole("Hoist Up",0.5),lllh:whole("Cave-In",0.5098039215686274),llls:whole("Corkscrew",0.5089285714285713),airHeavy:whole("Air Rebuff",0.5),airSpecial:whole("Rubble Rain",0.5294117647058824)},
  kubiwa:{lh:whole("Hold",0.59),llh:whole("Beckon",0.53),lllh:whole("Diminuendo",0.5833333333333333),llls:whole("Accent",0.4521739130434783),airHeavy:whole("Descending Scale",0.59),airSpecial:whole("Pianissimo",0.5833333333333333)},
  onigawara:{lh:whole("Shoulder Reversal",0.4),llh:whole("Rising Gore",0.4489),lllh:whole("Jagged Finish",0.4),llls:whole("Battle-Joy Drive",0.51),airHeavy:whole("Falling Reaver",0.4),airSpecial:whole("Boarfall Crash",0.4479)},
  cardo:{lh:whole("Headlong Thrust",0.4),llh:whole("Rising Unspell",0.4489),lllh:whole("Thistledown Storm",0.4),llls:whole("Overgrown Drive",0.51),airHeavy:whole("Falling Plowshare",0.4),airSpecial:whole("Thornfall Crash",0.4479)},
  minase:{lh:whole("Crossing Relay",0.44),llh:whole("Rising Gale",0.5),lllh:whole("Beacon Breaker",0.52),llls:whole("Relay Rush",0.52),airHeavy:whole("Falling Knife",0.44),airSpecial:whole("Gale Descent",0.56)},
  aquilo:{lh:whole("Swallowtail Cross",0.44),llh:whole("Rising Swallow",0.5),lllh:whole("Squall Breaker",0.52),llls:whole("Darting Flock",0.52),airHeavy:whole("Falling Swallow",0.44),airSpecial:whole("Downdraft",0.56)},
  'psyche':{lh:whole("Wing Twist",0.56),llh:whole("Rising Swarm",0.52),lllh:whole("Grasping Swarm",0.56),llls:whole("Swarm Push",0.58),airHeavy:whole("Aerial Wing",0.44),airSpecial:whole("Moth Descent",0.56)},
  'ovid':{lh:whole("Glass Hook",0.5),llh:whole("Jackhammer Uppercut",0.54),lllh:whole("Sledgehammer",0.58),llls:whole("Demolition Drive",0.6),airHeavy:whole("Collapse",0.58),airSpecial:whole("Controlled Demolition",0.58)},
  // Scout Hawser's are Levin's (below), on the same takes fitted to him: the two-bladed cut, the rising blade (his `Rush 3`),
  // a turn of the spin, the reverse-quill (`Rush 1`), the end of the lunge and the gas burst.
  // (His stage clips share their names with the YUGE's, which are other takes: `span` keeps each to its own.)
  hawser:{lh:whole("Cross Lay",.4),llh:{clip:"Rush 3",contact:.2821,span:1.625},lllh:seg("Slipped Moorings",.9,1.8,.5),llls:{clip:"Rush 1",contact:.46,span:.8333},airHeavy:seg("Snap Line",1.2,2,.5),airSpecial:seg("Squib Burst",.8,1.8,.5)},
  rotfalke:{lh:whole("Cross Talon Drive",0.46),llh:whole("Rising Talon Heel",0.56),lllh:whole("Plate Splitter",0.46),llls:whole("Stoop Breach",0.58),airHeavy:whole("Red Plummet",0.56),airSpecial:whole("Feather Drop",0.46)},
  bonsho:{lh:whole("Bead Turn",0.54),llh:whole("Rising Bell Palm",0.54),lllh:whole("Bronze Breaker",0.58),llls:whole("Evening Toll",0.52),airHeavy:whole("Cloud Palm",0.54),airSpecial:whole("Bell Drop",0.52)},
  yodaka:{lh:whole("Ember Turn",23/49),llh:whole("Rising Spark",28/56),lllh:whole("Watchfire Divide",34/67),llls:whole("Night Pursuit",36/71),airHeavy:whole("Air Watchfire",26/53),airSpecial:whole("Owl's Dive",31/62)},
  murex:{lh:whole("Twisting Claw",0.43),llh:whole("Spine Breaker",0.51),lllh:whole("Core Ram",0.43),llls:whole("Leave Me Alone",0.59),airHeavy:whole("Aerial Hammer",0.51),airSpecial:whole("Mantis Drop",0.51)},
  kinu:{lh:whole("Silk Uppercut",0.52),llh:whole("Whip Stitch",0.537037037037037),lllh:whole("Jailbreak Slam",0.537037037037037),llls:whole("Thread Pursuit",0.4655172413793104),airHeavy:whole("Descending Spool",0.537037037037037),airSpecial:whole("Shackle Crash",0.537037037037037)},
  'madake':{lh:whole("Rising Shoot",0.4615384615384615),llh:whole("Flying Greeting",0.5),lllh:whole("Green Hurricane",0.5),llls:whole("Spring Crane",0.5084745762711864),airHeavy:whole("Descending Fang",0.4893617021276596),airSpecial:whole("Autumn Stag",0.5172413793103449)},
  akayuri:{lh:whole("Crossing Lilies",0.56),llh:whole("Upturned Lily",0.46),lllh:whole("Line Through",0.56),llls:whole("Quiet Pursuit",0.6),airHeavy:whole("Falling Petal",0.46),airSpecial:whole("Red Rain Descent",0.56)},
  hagure:{lh:whole("Turnaside Hand",0.5377358490566037),llh:whole("Stray Cross",0.4464285714285714),lllh:whole("Howling Break",0.49107142857142855),llls:whole("Feral Lunge",0.49107142857142855),airHeavy:whole("Falling Maul",0.5377358490566037),airSpecial:whole("Moonfall Break",0.49107142857142855)},
  hisame:{lh:whole("Sleet Cut",0.44),llh:whole("Borealis",0.49),lllh:whole("Coup de Glace",0.44),llls:whole("Hoarfrost",0.61),airHeavy:whole("Crevasse",0.49),airSpecial:whole("Chandelier",0.53)},
  svanhild:{lh:whole("Ripple Riposte",0.44),llh:whole("Reed Snare",0.49),lllh:whole("Highborn Tide",0.44),llls:whole("Lakeglass Pursuit",0.61),airHeavy:whole("Falling Plume",0.49),airSpecial:whole("Swan Dive",0.53)},
  mizuhiki:{lh:whole("Backtwist",0.5),llh:whole("Vaulting Strand",0.46),lllh:whole("Shears",0.56),llls:whole("Snapback",0.61),airHeavy:whole("Air Splice",0.56),airSpecial:whole("Plumb Drop",0.56)},
  'shibuichi':{lh:whole("Backhand Peen",0.4523809523809524),llh:whole("Raised Seam",0.5102040816326531),lllh:whole("Elbow Peen",0.5344827586206897),llls:whole("Ground Quench",0.5230769230769231),airHeavy:whole("Heel Set",0.5196078431372549),airSpecial:whole("Falling Mantle",0.5327868852459017)},
  'rakucho':{lh:whole("Ribbon Hook",0.5462962962962963),llh:whole("Silverfish Cross",0.5462962962962963),lllh:whole("Shredded Chapter",0.5),llls:whole("Hungry Lunge",0.5),airHeavy:whole("Ribbon Descent",0.5462962962962963),airSpecial:whole("Red Ink Break",0.5)},
  irbis:{lh:whole("Snow-Cat Reversal",0.43),llh:whole("Rising Barb",0.48),lllh:whole("Predator Breaker",0.43),llls:whole("Crown Pursuit",0.62),airHeavy:whole("Aerial Rake",0.48),airSpecial:whole("Snow-Cat Crash",0.52)},
  shidare:{lh:whole("Crossing Petals",0.55),llh:whole("Rising Petals",0.44),lllh:whole("Avenue Breaker",0.55),llls:whole("Petal Pursuit",0.54),airHeavy:whole("Falling Petals",0.44),airSpecial:whole("Petal Descent",0.54)},
  hinomoto:{lh:whole("Old General's Reversal",0.53),llh:whole("Rising Spark",0.55),lllh:whole("Ashen Divider",0.495),llls:whole("Cinder Reprisal",0.58),airHeavy:whole("Aerial Cleave",0.495),airSpecial:whole("Falling Ember",0.58)},
  amagoi:{lh:whole("Rod Sweep",0.57),llh:whole("Rain Rebuff",0.5446428571428571),lllh:whole("Iron Rod Judgment",0.57),llls:whole("Drawing Rain",0.4818181818181818),airHeavy:whole("Descending Rod",0.57),airSpecial:whole("Falling Sky",0.5446428571428571)},
  'shakudo':{lh:whole("Swage",0.4342105263157895),llh:whole("Upset",0.5),lllh:whole("Drop Forge",0.5188679245283019),llls:whole("Stone Breaker",0.5084745762711864),airHeavy:whole("Anvil Drop",0.5),airSpecial:whole("Slag Fall",0.5272727272727272)},
  hikui:{lh:whole("Turning Ember",0.45),llh:whole("Rising Witchfire",0.51),lllh:whole("Scorch Cross",0.58),llls:whole("Heat Haze Edge",0.59),airHeavy:whole("Falling Witchfire",0.58),airSpecial:whole("Ashfall Landing",0.58)},
  tokan:{lh:whole("Icicle Thrust",0.5116279069767442),llh:whole("Snowdrift Rise",0.3333333333333333),lllh:whole("Floe Cleave",0.25),llls:whole("Plume Follow-up",0.55),airHeavy:whole("Aerial Frostbite",0.25),airSpecial:whole("Floe Descent",0.43902439024390244)},
  strappado:{lh:whole("Marionette Reversal",0.4166666666666667),llh:whole("Wire Guillotine",0.4545454545454546),lllh:whole("Spool Burst",0.49107142857142855),llls:whole("Puppeteer's Snare",0.5),airHeavy:whole("Highwire Heel",0.4893617021276596),airSpecial:whole("Trapdoor Drop",0.5090909090909091)},
  unari:{lh:whole("Undercut",0.44),llh:whole("Liftoff",0.5),lllh:whole("Nosedive",0.5957446808510639),llls:whole("Tailspin",0.44),airHeavy:whole("Plummet",0.44),airSpecial:whole("Tripwire",0.5957446808510639)},
  barrow:{lh:whole("Pitch Backfist",0.4166666666666667),llh:whole("Tremor Uppercut",0.4534883720930233),lllh:whole("Reef Breaker",0.49107142857142855),llls:whole("Sinkhole Crash",0.49166666666666664),airHeavy:whole("Glutton Heel",0.4893617021276596),airSpecial:whole("Tarfall",0.5090909090909091)},
  sashigane:{lh:whole("Cross Section",0.53),llh:whole("Rising Section",0.55),lllh:whole("Critical Load",0.56),llls:whole("Load Failure",0.59),airHeavy:whole("Aerial Section",0.56),airSpecial:whole("Dead Load Drop",0.59)},
  gosu:{lh:whole("Porcelain Hook",0.5217391304347826),llh:whole("Rising Seam",0.52),lllh:whole("Ruin Breaker",0.5217391304347826),llls:whole("Kin Drive",0.42),airHeavy:whole("Descending Shard",0.5217391304347826),airSpecial:whole("Mending Crash",0.5217391304347826)},
  kusushi:{lh:whole("Rib Breaker",0.46),llh:whole("Rising Thrust",0.54),lllh:whole("Crushing Heel",0.6),llls:whole("Pressure-Point Rupture",0.55),airHeavy:whole("Falling Heel",0.6),airSpecial:whole("Ring Splitter",0.55)},
  hakushi:{lh:whole("Lion Backhand",0.5),llh:whole("Mountain Palm",0.5),lllh:whole("Pearl Drive",0.58),llls:whole("Flame Palm",0.6),airHeavy:whole("Falling Lion Palm",0.5),airSpecial:whole("Old Lion Landing",0.58)},
  suzuran:{lh:whole("Backswing",0.54), llh:whole("Handstroke",0.52), lllh:whole("Full Peal",0.54), llls:whole("Overtone",0.56), airHeavy:whole("Bell Drop",0.54), airSpecial:whole("Sunken Bell",0.55)},
  wataame:{lh:whole("Shrug",0.4444444444444444), llh:whole("Stretch",0.52), lllh:whole("Go Dutch",0.6021505376344086), llls:whole("Sweet Tooth",0.5322580645161291), airHeavy:whole("Dozing Off",0.6021505376344086), airSpecial:whole("Flop",0.6021505376344086)},
  bruin:{lh:whole("Back-Blade Thump",0.4444444444444444), llh:whole("Back-Blade Sweep",0.52), lllh:whole("Deep Woods Cut",0.6021505376344086), llls:whole("Prowl Frenzy",0.5322580645161291), airHeavy:whole("Falling Bearpaw",0.6021505376344086), airSpecial:whole("Den Drop",0.6021505376344086)},
  senko:{lh:whole("Prism Roundhouse",0.5517241379310345),llh:whole("Rising Beam",0.5666666666666667),lllh:whole("Glare Heel Drop",0.5465116279069767),llls:whole("Beacon Kick",0.453125),airHeavy:whole("Aerial Halo Wheel",0.5517241379310345),airSpecial:whole("Noonfall",0.5465116279069767)},
  buna:{lh:whole("Snowbreak",0.4305555555555556),llh:whole("Uproot",0.45121951219512196),lllh:whole("Chopping Block",0.49),llls:whole("Touch Iron",0.5089285714285713),airHeavy:whole("Splitting Wedge",0.5),airSpecial:whole("Heave",0.5)},
  oyashio:{lh:whole('Swell Uppercut',0.3), llh:whole('Finback Rise',0.32142857142857145), lllh:whole('Breaker Hammer',0.41025641025641024), llls:whole('Brine Pulse',0.4727272727272727), airHeavy:whole('Aerial Breakwater',0.41025641025641024), airSpecial:whole('Whale Fall',0.5892857142857143)},
  adad:{lh:whole('Staff Reverse Quill',0.42), llh:whole('Ascending Spire',0.4), lllh:whole('Bolt Downstroke',0.58), llls:whole('Arc Spear',0.57), airHeavy:whole('Aerial Lightning Rod',0.58), airSpecial:whole('Heavensdrop',0.54)},
  akaito:{lh:whole("Return Cut",0.48),llh:whole("Rising Thread",0.48),lllh:whole("Falling Veil",0.56),llls:whole("Echoed Vow",0.55),airHeavy:whole("Air Knot Cut",0.56),airSpecial:whole("Air Vow",0.55)},
  shijima:{lh:whole("Turning Descant",0.5),llh:whole("Rising Descant",0.54255),lllh:whole("Falling Hush",0.5),llls:whole("Shirafune",0.57143),airHeavy:whole("Falling Frostnote",0.5),airSpecial:whole("Graveside Snowfall",0.54255)},
  tempo:{lh:whole('Body Shot',0.48),llh:whole('Rising Beat',0.52),lllh:whole('Elbow Drop',0.55),llls:whole('Push-Off Palm',0.58),airHeavy:whole('Dunk',0.55),airSpecial:whole('Red Crash',0.58)},
  tancho: { lh: whole('Rime Backhand',0.49), llh: whole('Icicle Beak',0.55), lllh: whole('Ember Talon',0.57), llls: whole('Kindling Palm',0.54), airHeavy: whole('Falling Scarlet Wing',0.57), airSpecial: whole('Snowfield Landing',0.56) },
  bellows: { lh: whole('Clinker Backfist',0.46), llh: whole('Chimney Uppercut',0.53), lllh: whole('Steam Hammer',0.54), llls: whole('Slag Lance Burst',0.55), airHeavy: whole('Falling Smelt',0.54), airSpecial: whole('Cast-Iron Landing',0.54) },
  mikage: { lh: whole('Velvet Elbow',0.48), llh: whole('Rising Pounce',0.52), lllh: whole('Tailwhip Heel',0.54), llls: whole('Static Palm',0.55), airHeavy: whole('Aerial Pounce Heel',0.54), airSpecial: whole('Cat\'s Landing',0.54) },

  // Strix's own retained native cuts. Rush2 is the isolated rising half of
  // combo_c; the descending half is retained as its own clip by the builder.
  'full-beam': { lh: whole('Keeper\'s Backfist',.48), llh: whole('Keeper\'s Uppercut',.52), lllh: whole('Anchor Hammer',.54), llls: whole('Pressure Front',.56), airHeavy: whole('Aerial Hammer',.54), airSpecial: whole('Meteor Landing',.54) },
  pyroclast: { lh: whole('Spitfire Cross',.46), llh: whole('Rising Vent',.54), lllh: whole('Magma Cannon',.52), llls: whole('Vent Burst',.57), airHeavy: whole('Airburst',.52), airSpecial: whole('Lava Flow Landing',.52) },
  ampere: { lh: whole('Live Line Cross',.46), llh: whole('Spark Uppercut',.51), lllh: whole('Good Hope Drop',.53), llls: whole('Finisterre Burst',.55), airHeavy: whole('Lineman\'s Kick',.53), airSpecial: whole('Landfall',.55) },
  shanxiao: { lh: whole('Mauler Backfist',.48), llh: whole('Rising Colossus',.52), lllh: whole('Colossus Hammer',.54), llls: whole('Jade Cannon',.56), airHeavy: whole('Aerial Hammer',.54), airSpecial: whole('Meteor Landing',.54) },
  kuzu: { lh: whole('Saw Reverse Quill',0.478), llh: whole('Saw Rising Reap',0.55), lllh: whole('Saw Downstroke',0.553), llls: whole('Saw Drive',0.609), airHeavy: whole('Saw Air Strike',0.553), airSpecial: whole('Saw Landing',0.609) },
  shakugo: { lh: whole('Cinder Backfist',0.34782608695652173), llh: whole('Fissure Uppercut',0.4), lllh: whole('Gavel Hammer',0.3333333333333333), llls: whole('Muzzle Burst',0.2549019607843137), airHeavy: whole('Slag Descent',0.3333333333333333), airSpecial: whole('Gavel Drop',0.16666666666666666) },
  'basilissa': { lh: whole('Thorn Sweep',0.5), llh: whole('Serpent Rising Heel',0.5652173913043478), lllh: whole('Crown Heel Drop',0.3333333333333333), llls: whole('Sandrose Barrage',0.3333333333333333), airHeavy: whole('Petal Air Kick',0.48), airSpecial: whole('Coiled Landing',0.3333333333333333) },
  sorayomi: { lh: whole('Staff Reverse Quill',9/17), llh: whole('Staff Rising Reap',11/18), lllh: whole('Staff Downstroke',11/18), llls: whole('Staff Thrust',12/20), airHeavy: whole('Staff Air Strike',11/18), airSpecial: whole('Groundstrike',14/23) },
  strix: { lh: whole('Vigil Backcut', 7.5/18), llh: whole('Vigil Rising Reap', .5),
    lllh: whole('Gravefall', 11/18), llls: whole('Vigil Diagonal Finisher', 16/38),
    airHeavy: whole('Vigil Air Cleave', 11/18), airSpecial: whole('Vigil Landing Cut', 15/47) },
  gorai: { lh: seg('Rivet Ram', .94, 2.08, .4), llh: seg('Quake Stamp', .59, 1.76, .38), lllh: seg('Thunderclap Spar', .58, 1.98, .42),
    llls: seg('Great Roar', 0, 1.3, .35), airHeavy: seg('Drunken Skyfall', 1.45, 2.5, .52), airSpecial: seg('Cloudbank Dive', .5, 1.8, .28) },
  haldor: { lh: seg('Ivory Sweep', .4, 1.53, .4), llh: seg('Glaive Gale', .86, 2.03, .38), lllh: seg('Aftershock', .52, 1.91, .42),
    llls: seg('Crown Cracker', 1.15, 2.85, .5), airHeavy: seg('Leaping Glaive Chop', 2.11, 3.12, .39), airSpecial: seg('Tremor Stomp', .54, 1.84, .28) },
  sorrel: { lh: seg('Horizon Splitting Clash', .45, 1.32, .4), llh: seg('Maelstrom Edge', .49, 1.39, .38), lllh: seg('Crimson Lightning Chop', .52, 1.59, .42),
    llls: seg('Dead Calm Glare', .98, 2.1, .4), airHeavy: seg('Falling Wake', .73, 1.5, .39), airSpecial: seg('Red Tide Ambush', .2, 1.5, .15) },
  dorado: { lh: seg('Squall Cut', .43, 1.35, .4), llh: seg('Sunburst Blow', .72, 1.66, .37), lllh: seg('Bonfire Crown', .85, 2.25, .54),
    llls: seg('Sovereign Clash', .06, 1.23, .4), airHeavy: seg('Diving Gilded Cut', .52, 1.33, .38), airSpecial: seg('Horizon Slam', .48, 1.53, .28) },
  shiun: { lh: seg('Wing Blades', .4, 1, .45), llh: seg('BLACK CONFESSIONAL', .2, 1.2, .7), lllh: seg('False Encore', .2, 1.1, .55), llls: seg('awaken-pale-gem', .3, 1.38, .5),
    airHeavy: whole('Hymn Palm', .3409), airSpecial: seg('BLACK CONFESSIONAL', 1.6, 2.5, .4) },
  magatsu: { lh: seg('Calamity Pyre', .6, 1.4, .55), llh: seg('Hachi', .6, 1.25, .45), lllh: seg('Kai', .6, 1.4, .35), llls: seg('awaken-shrine', 1.6, 2.8, .5),
    airHeavy: seg('Hex Claw', .3, .9, .45), airSpecial: seg('Kai', .7, 1.63, .2) },
  // Vesper's (7 October 2026, scripts/fanim/vesper.py): each ender on the blow his take lays - Reverse Quill's backhand
  // at its pinned 0.4625, Updraft's rising cut at 0.4833, Raven's Drop's chop at the heavy's 0.4479 (they were
  // drawn on the library's: Reverse Quill at 0.65, past its cut).
  vesper: { lh: seg('Reverse Quill', .1, .6, .4167), llh: whole('Updraft', .4833), lllh: seg('The Offering', 1.9, 2.6, .55), llls: seg('Hawks Talon', .1, .6, .5092),
    airHeavy: seg('The Offering', 1.2, 2.4, .75), airSpecial: whole('Raven Dive', .535) },
  imago: { lh: seg('Kings Decree', 0, .7, .4), llh: seg('Mantis Hook', .3, .9, .236), lllh: seg('Stinger Lash', .3, 1.17, .2), llls: whole('Rising Barb', .5263),
    airHeavy: seg('Kings Decree', 2, 2.9, .8), airSpecial: whole('Stinger Storm', .8) },
  'wuming': { lh: seg('Lightless Cannon', 1, 1.75, .5), llh: whole('Dusk Rush 4', .5), lllh: seg('Petalfall Blade', .5, 1.13, .6), llls: seg('awaken-rose', 0, 1, .5),
    airHeavy: seg('Heaven\'s Harvest', 0, .5, .25), airSpecial: seg('Heaven\'s Harvest', .9, 1.38, .3) },
  jirenga: { lh: seg('Mountain-Felling Fist', 0, .6, .7), llh: whole('Uprooting Fist', .471), lllh: seg('Mountain-Felling Fist', .9, 1.6, .55), llls: seg('Vermilion Seal', .9, 1.8, .6),
    airHeavy: seg('Mountain-Felling Fist', .7, 1.4, .6), airSpecial: whole('awaken-wrathful-guardian', .3) },
  'jinlin': { lh: whole('Jinlin Rush 5', .5), llh: seg('Drowned Sun', .4, 1.2, .45), lllh: seg('Pearl Rain', .2, 1.2, .6), llls: seg('awaken-golden', .2, 1.5, .5),
    airHeavy: whole('Jinlin Rush 3', .5), airSpecial: seg('Pearl Rain', 1.2, 2.38, .2) },
  'gohaku': { lh: seg('Beast Rush 4', .3, .75, .4), llh: seg('Beast Rush 3', .05, .4, .5), lllh: seg('Rising Kick', .4, 1.08, .45), llls: whole('Beast Rush 2', .5333),
    airHeavy: seg('Star-Shifting Beam', .2, 1.2, .65), airSpecial: seg('awaken-beast', .9, 2, .4) },
  // Ippon's All-Nighter Headbutt and All-Nighter Shuffle are takes of their own (9 October 2026, scripts/fanim/slj.py), not his
  // Clock-In Punch and Clock-In Hook; his All-Nighter Desk Flip is Serious Uppercut's take, laid again as the flip.
  ippon: { lh: whole('All-Nighter Headbutt', .42), llh: whole('Serious Uppercut', .5), lllh: seg('Double Shift', .2, 1, .5), llls: whole('All-Nighter Shuffle', .4),
    airHeavy: seg('Clean Slate', 1.5, 2.29, .3), airSpecial: seg('Clock-In Kick', .15, .58, .35) },
  sekka: { lh: whole('Sleet Kick', .5), llh: whole('Icefall Hammer', .3), lllh: seg('awaken-high-moon', .6, 1.71, .45), llls: whole('Compass Needle', .89),
    airHeavy: whole('Shatter Jab', .5), airSpecial: seg('Shatter Art: Black Blizzard', .4, 1.33, .35) },
  // Tobari's L-L-H plays Rookwing Rise's turn, the part of it the light string never shows: it ends (0.87 s, its blow where
  // it was, 0.55 s) before the take begins him from Shadow Kick's pose (0.88 s, scripts/fanim/lights.py ROOKWING_RISE).
  tobari: { lh: seg('awaken-guardian', .1, .9, .6), llh: seg('Rookwing Rise', .2, .87, .5224), lllh: seg('Murder of Crows', .4, 1.13, .5), llls: seg('Black Pyre', 0, 1, .6),
    airHeavy: whole('Kunai Slash', .25), airSpecial: seg('awaken-guardian', 1.2, 2.4, .6) },
  akagane: { lh: whole('War Fan Sweep', .715), llh: whole('Warlord Rise', .3043), lllh: whole('awaken-guardian', .5), llls: seg('Majestic Flame', .2, 1.4, .7),
    airHeavy: seg('War Fan Sweep', .5, 1.21, .513), airSpecial: seg('Majestic Flame', 1.4, 3.04, .3) },
  asahi: { lh: seg('Lantern Rite: First Light', 2.3, 3.04, .4), llh: whole('Rising Slash', .3103), lllh: seg('Lantern Rite: First Light', .8, 2, .75), llls: seg('awaken-sun', 1.4, 2.3, .5),
    airHeavy: whole('Water Wheel', .554), airSpecial: seg('Ashfall Waltz', 1.6, 2.6, .3) },
  levin: { lh: whole('Crosshatch', .4), llh: whole('Lift Off', .2821), lllh: seg('SOJI: Clean Sweep', .9, 1.8, .5), llls: whole('Nick', .46),
    airHeavy: seg('Zipline', 1.2, 2, .5), airSpecial: seg('awaken-captain', .8, 1.8, .5) },
  'rook': { lh: seg('Crossed Talons', .5, 1.5, .6), llh: whole('Raven Rise', .4417), lllh: whole('Shadow Kick', .65), llls: seg('awaken-rookery', .8, 2.2, .5),
    airHeavy: whole('Talon Cut', .6818), airSpecial: seg('Rook\'S Grip', 1.1, 2.08, .35) },
  gaku: { lh: seg('Riot Palm', .9, 1.88, .35), llh: whole('Rising Paw', .776), lllh: seg('Landslide', .8, 2, .45), llls: whole('Scav Kick', .5),
    airHeavy: whole('Chain Jab', .6), airSpecial: seg('awaken-adult', 0, 1.4, .6) },
  // The main game's sixteen (5 October 2026; game/combosVol1.ts), each ender the part of a take that moves as the move
  // is named: chosen off fixed-camera filmstrips with the fighter's own root caps and a trace of where each hand and
  // foot strikes and the body leaves and meets the floor (scripts/combos/ender_sheet.html). Where a fighter's set had
  // no such motion it was made for him alone: Meshy text-to-motion takes, two blows to a take - a launcher and the air
  // strike after it, a slam down and the leap and smash into the floor, a straight and a second blow - moved onto his
  // own rig into an animation-only file of his (scripts/combos/vol1_enders.py, <id>-enders1.glb). Each segment opens in
  // the stance its take starts from or a wind-up, so the stage before it blends straight in; its contact share is the
  // traced blow, or for a ground smash the frame the take meets the floor (the simulation strikes on landing). Every
  // seg names its take's length (`span`): a form or an outfit with another take under the name throws the slot's clip.
  // Round 4b (COMBAT): the Blackout Flash and the Double Axe Handle are a take of their own (taisei-enders2.glb): the flash
  // with both hands at the brow, and the clasped fists brought down without a leap - the critic found the Blackout Flash a
  // palm thrust off the Monkey King Fist's take and the knockdown and the smash two halves of one leap-and-slam. The Super
  // Sunpalm Cannon is his special's own Sunpalm Cannon (03-SUNPALM-CANNON), drawn back at the hip as he drops and fired at the floor.
  taisei: { lh: v('Straight Palm', 0.7, 1.7, 0.4, 5.542), llh: v('Rising Axe', 0.95, 1.9, 0.47, 6.042), lllh: v('Flare Hammer', 2.6, 4.3, 0.57, 5.542), llls: v('Flare Hammer', 0.35, 2.35, 0.45, 5.542), airHeavy: v('Afterburn Chase', 0.75, 2.2, 0.3476, 4.042), airSpecial: v('03-SUNPALM-CANNON', 5.9, 7.3, 0.5, 10) },
  ouga: { lh: v('Rising Kick', 0.05, 0.95, 0.33, 6.042), llh: v('Elbow Palm', 1.85, 2.75, 0.39, 5.542), lllh: v('Axe Dive', 0.55, 1.5, 0.47, 6.542), llls: v('Elbow Palm', 0.4, 1.5, 0.41, 5.542), airHeavy: v('Rising Kick', 2.35, 3.3, 0.53, 6.042), airSpecial: v('Axe Dive', 3.3, 4.6, 0.32, 6.542) },
  konta: { lh: v('Senpugan Attack', 1.75, 2.75, 0.42, 3.333), llh: v('Punch 01', 0.15, 1.05, 0.4, 4.167), lllh: v('Punch 01', 1.95, 3, 0.38, 4.167), llls: v('Senpugan Attack', 0.35, 1.6, 0.55, 3.333), airHeavy: v('Kick 02', 0.55, 1.35, 0.54, 2.333), airSpecial: v('Senpugan Dive', 0.75, 2.2, 0.28, 3.542) },
  // Round 4b (COMBAT): the Undertow Sweep is a take of its own (gummy-enders2.glb), the arm flung out wide and swept round
  // at neck height; the slam it used to borrow is his air string's.
  gummy: { lh: v('Grand Tide Fist', 0.9, 1.6, 0.2, 1.875), llh: v('Rising Axe', 2, 2.95, 0.42, 6.042), lllh: v('Sickle Sweep', 0.6, 2.6, 0.67, 5.042), llls: v('Slam Stubborn Headbutt', 3.35, 4.35, 0.6, 6.042), airHeavy: v('Rising Axe', 2.95, 3.75, 0.46, 6.042), airSpecial: v('Signal Fire', 2.9, 3.46, 0.36, 3.458) },
  kosho: { lh: v('Back Flurry', 0.2, 1.25, 0.33, 6.042), llh: v('Rising Heel', 0.15, 1, 0.35, 6.042), lllh: v('Banquet Infernal', 0.55, 1.6, 0.71, 1.708), llls: v('Back Flurry', 3.2, 4.6, 0.36, 6.042), airHeavy: v('Rising Heel', 2.75, 3.6, 0.53, 6.042), airSpecial: v('Brasier: Coup de Feu', 2.15, 2.95, 0.375, 3.292) },
  shirokane: { lh: v('Void Eye: Sickle Bolt', 1.55, 2.4, 0.47, 3.667), llh: v('Rising Slash', 0.15, 1.1, 0.37, 6.042), lllh: v('Heel Dive', 0.9, 2.1, 0.5, 6.542), llls: v('Static Scarecrow', 0, 1, 0.35, 2.292), airHeavy: v('Rising Slash', 2.3, 3.2, 0.56, 6.042), airSpecial: v('Heel Dive', 3.7, 4.9, 0.42, 6.542) },
  shiden: { lh: v('Slash Palm', 1.5, 2.6, 0.45, 5.542), llh: v('Rising Slash', 1, 2, 0.5, 6.042), lllh: v('Black Pyre', 0.4, 1.6, 0.55, 4.167), llls: v('Cut Plunge', 0.95, 2, 0.33, 6.542), airHeavy: v('Rising Slash', 2, 2.95, 0.53, 6.042), airSpecial: v('Cut Plunge', 2.5, 3.9, 0.46, 6.542) },
  // Round 4b (COMBAT): Keelbreaker is the overhead two-sword cut of his own air take (kenzo-enders2.glb), not the first half
  // of the ground smash's - that take's overhead cut is now his air string's.
  kenzo: { lh: v('Dust Sea Sundered', 0.9, 2, 0.39, 2.458), llh: v('Rising Cross', 0.6, 1.7, 0.5, 6.042), lllh: v('Kenzo Air', 1, 2, 0.6, 5.042), llls: v('thousand mile eagle', 1.05, 1.95, 0.36, 2.625), airHeavy: v('Rising Cross', 1.75, 2.7, 0.47, 6.042), airSpecial: v('Cut Plunge', 2.75, 4, 0.44, 6.542) },
  // Round 4b (COMBAT): Junkyard Assault is Iron Spirit's barrage (his special's Gan Gan Barrage) driven into the floor,
  // not the second half of the knockdown's take - its diving straight is his air string's.
  koko: { lh: v('Straight Body', 0.7, 1.75, 0.48, 5.542), llh: v('Upper Dive', 0.9, 1.9, 0.45, 6.042), lllh: v('Hammer Dive', 0.55, 1.45, 0.5, 6.542), llls: v('Straight Body', 2.6, 3.8, 0.5, 5.542), airHeavy: v('Upper Dive', 2.2, 3.3, 0.55, 6.042), airSpecial: v('Gan Gan Barrage', 0.3, 1.8, 0.45, 3.083) },
  nigo: { lh: v('skill_3_4_1', 0, 1.04, 0.3, 1.042), llh: v('Punch 02', 0.1, 0.9, 0.34, 1.833), lllh: v('skill_1_3_1', 1.75, 2.4, 0.35, 4.458), llls: v('strike_1_1', 0, 0.66, 0.3, 0.667), airHeavy: v('Punch 01', 0.75, 1.6, 0.52, 1.667), airSpecial: v('Scorched Earth', 0.6, 1.9, 0.4, 2.833) },
  // Round 4b (COMBAT): Kagaribi is his TAIMATSU (Taimatsu) thrown into the floor, not the second half of the stun's take.
  kagari: { llh: v('Upper Dive', 1.15, 2.1, 0.53, 6.042), lllh: v('Taiyou-Dama', 1.2, 2.3, 0.46, 2.458), llls: v('Body Dive', 0.85, 1.75, 0.47, 6.542), airHeavy: v('Upper Dive', 2.2, 3.2, 0.5, 6.042), airSpecial: v('Taimatsu', 0.3, 1.25, 0.63, 1.25) },
  // Round 4b (COMBAT): Biopsy Strike is the Cautery Blade's thrust carried through to the floor (the stun keeps its opening).
  ward: { llh: v('Rising Slash', 0.5, 1.5, 0.55, 6.042), llls: v('Cautery Blade', 0, 0.95, 0.25, 1.333), airHeavy: v('Rising Slash', 2.7, 3.5, 0.56, 6.042), airSpecial: v('Cautery Blade', 0.45, 1.333, 0.62, 1.333) },
  // Round 4b (COMBAT): the Crown Stomp and Infinity are a take of their own (kuon-enders2.glb) - the stomp, and the open
  // hand held out that everything in front of stops at; the 200% Singularity is his Singularity's own. The critic found
  // the stomp the Dark Spark's punch and the knockdown and the smash two halves of one take.
  kuon: { lh: v('Punch 01', 0.3, 1, 0.36, 1.000), llh: v('PLANETARIUM', 1.9, 2.9, 0.5, 4.292), lllh: v('Axe Dive', 0.9, 1.75, 0.59, 6.542), llls: v('Stomp Palm', 1.4, 2.6, 0.25, 5.542), airHeavy: v('Stomp Palm', 0.6, 1.6, 0.7, 5.542), airSpecial: v('Singularity', 0.8, 2.4, 0.7, 2.750) },
  // Round 4b (COMBAT): Checkmate is a take of its own (oro-enders2.glb): the leap, the knives flung down from both hands,
  // the landing - not the second half of the knockdown's take.
  oro: { lh: v('MIDNIGHT', 0.15, 1.15, 0.52, 4.792), llh: v('Rising Stomp', 0.25, 1.15, 0.39, 6.042), lllh: v('Hammer Dive', 0.85, 1.75, 0.5, 6.542), llls: v('Straight Spear', 3.1, 4.3, 0.5, 5.542), airHeavy: v('Rising Stomp', 2.4, 3.4, 0.6, 6.042), airSpecial: v('Checkmate Fan', 2.45, 3.45, 0.8, 5.042) },
  // Round 4b (COMBAT): all six are takes of his own (gaunt-enders2.glb, three Meshy takes) - the critic found five of his
  // enders and air moves cut from his ultimate's Hound Rampage, and the sixth his special's Scrap Cannon Arm: the arm raised
  // and the crossbow fired; the rising swing (the first of his air take's - the uppercut half of the crossbow's take
  // ends where his feet are planted half a metre off, and the next stance pops them); the GRAVEDIGGER swung round him;
  // the bomb lit and tossed; the leap and the chop; the leap and the cannon fired down at the floor.
  gaunt: { lh: v('Crossbow Uppercut', 0.5, 2.1, 0.5, 6.042), llh: v('Gaunt Air', 0.3, 1, 0.5, 5.042), lllh: v('Spin Bomb', 1, 3.1, 0.7, 6.542), llls: v('Spin Bomb', 3.1, 4.9, 0.33, 6.542), airHeavy: v('Leap Cannon', 0.6, 1.6, 0.5, 6.542), airSpecial: v('Leap Cannon', 2.5, 4.8, 0.75, 6.542) },
  setsu: { lh: v('Snow Claw', 0.15, 0.79, 0.31, 0.792), llh: v('Rising Claw', 0.05, 0.95, 0.39, 6.042), lllh: v('Rising Claw', 2, 3, 0.5, 6.042), llls: v('Whirlwind', 1.5, 2.6, 0.45, 3.667), airHeavy: v('Heel Dive', 1, 1.9, 0.5, 6.542), airSpecial: v('Heel Dive', 2.6, 3.9, 0.46, 6.542) },
};

/** A form's own clips for its enders, where its body has takes of its own that move like them (the base body's row
 *  stands for the rest, where the form's body has the same take: the Guardian, the HOUND ARMOR). */
export const COMBO_FORM_CLIPS: Partial<Record<FighterId, Partial<Record<ComboKey, ComboClip>>>> = {
  // The YUGE's enders, each a take of its own body's (the fists that were adult Hawser's).
  hawser:{lh:whole("Defiant Hook",0.5),llh:whole("Rebel Uppercut",0.54),lllh:whole("Freedom Hammer",0.58),llls:whole("Unbroken Advance",0.58),airHeavy:whole("Aerial Rebellion",0.58),airSpecial:whole("Falling Veil",0.58)},
  gummy: { lh: v('Dawn Rocket', 2.3, 3.2, .78, 4.958), llh: v('Dawn Rocket End', 0, .9, .5, 1.458), lllh: v('Giant Stomp', .1, 1.35, .4, 1.625),
    llls: v('Sunrise Leap', .45, 1.35, .73, 2.125), airHeavy: v('Sunrise Tide', 1.62, 2.3, .41, 2.458), airSpecial: v('Sunrise Leap', 1, 1.95, .74, 2.125) },
  // The NIGHTFALL's Last Rites: his afterimage cut, the warp and the slash.
  nigo: { llls: v('skill_3_fenshen', 0, .958, .6, .958) },
};

export function comboClip(fighter: FighterId, key: ComboKey): ComboClip | undefined { return COMBO_CLIPS[fighter]?.[key]; }
export function comboFormClip(fighter: FighterId, key: ComboKey): ComboClip | undefined { return COMBO_FORM_CLIPS[fighter]?.[key]; }
