import type { FighterId } from './types';
import type { ComboRow } from './combos';
import { blast, smash, snare } from './combosShop';

export const VOL1_COMBOS: Partial<Record<FighterId, ComboRow>> = {
  taisei: {
    // His trademark fist, thrown with the whole body.
    lh: { name: 'Monkey King Fist', damage: 48, knockback: 9.5, lift: 4 },
    // The roundhouse that kicks them up into the air.
    llh: { name: 'Redline Rush', damage: 42, lift: 9.6, knockback: 2.6 },
    lllh: { name: 'Double Axe Handle', damage: 67, knock: 'spike', down: .85 },
    // A blinding flash: a field, no grab.
    llls: { name: 'Blackout Flash', ...snare(4, 2), damage: 56, daze: 1.2 },
    // Afterburn Chase: after the Double Axe Handle he chases them down with an aura-cloaked downward diagonal punch.
    airHeavy: { name: 'Afterburn Chase', damage: 50, lift: 6.2 },
    // Fired down from the air.
    airSpecial: { name: 'Grand Sunpalm Cannon', ...smash(4.4), damage: 76, outcome: 'launch', lift: 7.2, knockback: 6 },
  },
  ouga: {
    // A flying kick that knocks them out of the way.
    lh: { name: 'Prince Dash Kick', damage: 46, knockback: 10.5, lift: 3.6 },
    // Two fingers raised and the target goes up in an explosion.
    llh: { name: 'Coronation', ...snare(6, 1.4), damage: 40, lift: 9.2 },
    // The punch across the face that puts the opponent on the floor.
    lllh: { name: 'Throne Impact', damage: 65, knock: 'splat', knockback: 10, down: .9 },
    // The barrage of ki blasts he empties into an opponent in a rage.
    llls: { name: 'Rage Volley', ...blast(10, 34), damage: 55, daze: 1.15 },
    // The stomp from above that drives them down.
    airHeavy: { name: 'Skyfall Stomp', damage: 48, lift: 5.8 },
    // A dome of his own energy, burst round him.
    airSpecial: { name: 'Pride Burst', ...smash(4.8), damage: 79, knock: 'splat', knockback: 11, down: .95 },
  },
  konta: {
    // His light is a three-blow barrage (0.615 s), so his tempo, measured against it, clamps at 1.3 while his string's
    // stages run at the roster's pace (0.40-0.55 s): his enders are timed as a 0.96 fighter's.
    // An open-handed strike that sends the wind's force through the target.
    lh: { name: 'Gale Palm', duration: .67, contacts: [.27], damage: 41, knockback: 8, lift: 3.4 },
    // The Gale Kata blow that sends the opponent up, and the spinning kick after it.
    llh: { name: 'Gale Kata: Updraft', duration: .69, contacts: [.26], damage: 36, lift: 9.4 },
    lllh: { name: 'Great Kazeyose', duration: .83, contacts: [.35], damage: 58, knock: 'slide', knockback: 9, down: .85 },
    // A wind shuriken spun on a fingertip, thrown.
    llls: { name: 'Mini Galewheel', ...blast(9, 30), duration: .86, contacts: [.35], damage: 49, daze: 1.35 },
    // His clones somersault down and land their heels on the target's head and shoulders.
    airHeavy: { name: 'Pinwheel Drop', duration: .6, contacts: [.23], damage: 43, lift: 6 },
    // A giant Kazeyose circled by three more, driven into the floor.
    airSpecial: { name: 'Kazeyose Wreath', ...smash(4.4), duration: .77, contacts: [.21], damage: 63, knock: 'slide', knockback: 8, down: .9 },
    // Kurobi fights with his own kit (awakening.ts AWAKENED_MOVES): a fox spirit throwing a Gale Kata or a Kazeyose
    // would be a lie. Plain descriptions of what the fox does, his Great Roar, and a miniature Beast Spirit Ball.
    awakened: {
      lh: { name: 'Tail Sweep', knockback: 11 }, llh: { name: 'Foxtail Toss' }, lllh: { name: 'Azure Paw Slam', knock: 'spike' },
      llls: { name: 'Great Roar', ...snare(4, 2) }, airHeavy: { name: 'Foxfire Pounce' },
      airSpecial: { name: 'Mini Foxfire Bomb' },
    },
  },
  gummy: {
    // A giant fist, blown up before it lands.
    lh: { name: 'Maelstrom Fist', range: 3.4, damage: 47, knockback: 11.5, lift: 3.2 },
    // A spinning barrage that carries them up into the sky.
    llh: { name: 'Waterspout', damage: 38, lift: 9.8, knockback: 3.2 },
    // He pulls himself in on a stretched arm and clotheslines them.
    lllh: { name: 'Undertow Sweep', range: 3, damage: 60, knock: 'slide', knockback: 10, down: .8 },
    // The neck stretched back and snapped into a stubborn-headbutt.
    llls: { name: 'Figurehead Bash', damage: 51, daze: 1.45 },
    // A leg stretched high and brought down like a war axe.
    airHeavy: { name: 'Sinker Heel', damage: 45, lift: 6.6 },
    // A cannon of a punch and Signal Fire in one: the flaming fist.
    airSpecial: { name: 'Beacon Crash', ...smash(4.2), damage: 66, knock: 'splat', knockback: 10, down: .85 },
    // Round 4b (GUMMY): in SUNRISE the enders are SUNRISE's own, drawn with the SUNRISE body's own takes
    // (comboClips.ts COMBO_FORM_CLIPS):
    awakened: {
      // He flings himself at them like a rocket (Dawn Rocket).
      lh: { name: 'Heatwave Drive', range: 3.4 },
      // His body wound round on itself and a leg uncoiled through them like a whip (Dawn Whip): up they go.
      llh: { name: 'Corona Swing' },
      // His body - here his legs - blown up to a giant's and brought down on them.
      lllh: { name: 'Colossus Stomp' },
      // A bolt of lightning caught, made rubber and thrown like a spear: it leaves them reeling.
      llls: { name: 'Thunderhead Hurl', ...blast(9, 34) },
      // A fist driven into the floor, and the floor stretched up under them: a spike.
      airHeavy: { name: 'Groundswell' },
      // (The ground smash is the burning fist still, thrown by SUNRISE.)
    },
  },
  kosho: {
    // A leaping kick to the centre of the torso, one of his strongest.
    lh: { name: 'Braise', damage: 38, knockback: 10, lift: 3.8 },
    // From his hands underneath the opponent he springs up into both feet under the chin.
    llh: { name: 'Souffle', damage: 33, lift: 9.6 },
    // A leg hooked round the neck and the face smashed into the floor.
    lllh: { name: 'Dressage', damage: 52, knock: 'spike', down: .9 },
    // A barrage of kicks from every direction at close range.
    llls: { name: 'Mirepoix', damage: 44, daze: 1.15 },
    // Over the top of the opponent and down on one leg, spinning like a drill.
    airHeavy: { name: 'Rotisserie Drill', damage: 43, lift: 6.6 },
    // The flaming leg kicked down again and again.
    airSpecial: { name: 'Brasier: Salamandre', ...smash(3.8), damage: 57, down: .8 },
  },
  shirokane: {
    // A water dragon crashing on the target.
    lh: { name: 'Mudslide', ...blast(10, 26), damage: 43, knockback: 8.5 },
    // A poke that sends them flying up.
    llh: { name: 'Rude Awakening', damage: 38, lift: 9.6 },
    // From under the ground he drags the target down to the neck.
    lllh: { name: 'Burrow Grab', ...snare(4, 1.2), damage: 60, down: 1.1 },
    // His hounds burst out of the ground and pin the target.
    llls: { name: 'Stray Pack', ...snare(5, 1.6), damage: 51, daze: 1.6 },
    // His lightning bolt thrown as a hound: the Storm Hound.
    airHeavy: { name: 'Storm Hound', ...blast(9, 32), damage: 45 },
    // A bolt of his own make, in place of the old lightning bolt.
    airSpecial: { name: 'Thistle Sparks', ...smash(3.8), damage: 66, down: .95 },
  },
  shiden: {
    // The Storm Talon shaped into a blade that reaches.
    lh: { name: 'Talon Lunge', range: 3.6, damage: 42, knockback: 8, lift: 3.6 },
    // The Storm Talon run through his sword.
    llh: { name: 'Habakiri: Charged Edge', damage: 36, lift: 9 },
    lllh: { name: 'Hawk Flame', ...blast(9, 28), damage: 58, knock: 'splat', knockback: 9, down: .85 },
    // The Storm Talon let out of his whole body: everyone round him numbed.
    llls: { name: 'Static Shroud', ...snare(2.5, 2.2), damage: 49, daze: 1.5 },
    airHeavy: { name: 'Spark Hail', ...blast(9, 34), damage: 44, lift: 5.6 },
    // Lightning drawn down from the clouds onto where he lands.
    airSpecial: { name: 'Thunder Hawk', ...smash(4.4), damage: 64, down: 1.1 },
  },
  kenzo: {
    // A running attack with two swords held out like a bull's horns.
    lh: { name: 'Oryx Lance', lunge: 8, damage: 46, knockback: 8.5 },
    // A far stronger tornado.
    llh: { name: 'Grit Sirocco', radius: 1.3, damage: 42, lift: 9.2 },
    // A run in with a sword held out and a two-handed overhead swing.
    lllh: { name: 'Keelbreaker', damage: 64, knock: 'slide', knockback: 9, down: .85, radius: 1.2 },
    // All three blades clamped shut on the target like a crab's claw.
    llls: { name: 'Scorpion Snare', damage: 54, daze: 1.3, radius: 1.2 },
    // A leap and one sword brought down; the cut bursts into flame.
    airHeavy: { name: 'Sunstroke', damage: 48, radius: 1.2 },
    // A leap and a descending slash that throws all its will forward.
    airSpecial: { name: 'Wreckyard Plunge', ...smash(4.6), damage: 70, knock: 'slide', knockback: 9, down: .85 },
    // DUNE ONI's nine swords.
    awakened: { lh: { name: 'Dune Oni: Maneater' }, lllh: { name: 'Dune Oni: Blood Moon' } },
  },
  koko: {
    // Iron Spirit's dashing straight.
    lh: { name: 'Rivet Strike', damage: 49, knockback: 9.5, lift: 3.2 },
    // An upward barrage that sends them flying.
    llh: { name: "Lights out!", damage: 42, lift: 8.6, down: .5 },
    // Iron Spirit lifts them, spins and slams them into the floor.
    lllh: { name: 'Rock-a-bye...!', damage: 68, knock: 'spike', down: 1 },
    // Iron Spirit's inhale, pulling the opponent in helpless.
    llls: { name: 'Not a sound.', ...snare(6, 1.5), damage: 52, daze: 1.65 },
    // Iron Spirit's diving punch.
    airHeavy: { name: 'Diving Punch', damage: 51, lift: 5 },
    // The barrage of a spirit gone grave-hound, down into the floor.
    airSpecial: { name: 'Junkyard Assault', ...smash(3.8), damage: 74, knock: 'spike', down: 1 },
  },
  nigo: {
    // A sweeping slash along the floor that bounces them off the wall.
    lh: { name: 'Ring of Ash', damage: 45, knockback: 9, lift: 3.6 },
    // A jumping, rising slash that launches.
    llh: { name: 'Ash Arc', damage: 39, lift: 9.4 },
    // The assault that ends in a downward takedown slash.
    lllh: { name: 'Ember Mirror', damage: 62, down: .95 },
    // A ray fired from his mask.
    llls: { name: 'Jaw Blast', ...blast(9, 32), damage: 52, daze: 1.25 },
    // A rising slash into a downward one, in the air.
    airHeavy: { name: 'Girder Drop', damage: 47, lift: 5.6 },
    // Midnight HAIZAN raised in a whirlwind of pressure and brought down in a giant Nightfang.
    airSpecial: { name: 'Scorched Sky', ...smash(4.4), damage: 73, knock: 'slide', knockback: 9, down: .9 },
    // The NIGHTFALL's own: a warp and a slash.
    awakened: { llls: { name: 'Last Rites', style: 'melee', range: 2.6, radius: 1, lunge: 5 } },
  },
  kagari: {
    // Bullets of compressed flame from his fingertips.
    lh: { name: 'Hidama', ...blast(10, 36), damage: 42, knockback: 8 },
    // The jet-propelled punch up into the air.
    llh: { name: 'Noboribi', damage: 37, lift: 9.6, knockback: 2.4 },
    // Long lances of fire hurled.
    lllh: { name: 'Ensou', ...blast(9, 30), damage: 59, knock: 'splat', knockback: 9, down: .85 },
    // Hinoko's fireflies all sent into the target at once - his light's own follow-up.
    llls: { name: 'Tourou', ...snare(5, 1.8), damage: 50, daze: 1.35 },
    // A stream of flame fired straight down from the air.
    airHeavy: { name: 'Rakka', ...blast(8, 30), damage: 44, lift: 5.6 },
    // The fire pillar, which he can fire downwards to clear everyone round him.
    airSpecial: { name: 'Kagaribi', ...smash(4.4), damage: 64, outcome: 'launch', lift: 7.6, knockback: 5 },
  },
  ward: {
    // His one attack at range: inside ROOM the target is swapped away.
    lh: { name: 'Crossmatch', ...snare(7, 1.3), damage: 43, knockback: 7, lift: 3 },
    // The outward upward slash that launches, its reach lengthened by ROOM.
    llh: { name: 'Sternal Split', range: 3, damage: 37, lift: 8.8 },
    // LANCET through the target and a shock wave released inside it.
    lllh: { name: 'Cardiac Palm', damage: 60, down: 1.05 },
    // The heart struck out of the chest in a cube.
    llls: { name: 'Open Heart', damage: 43, daze: 1.75 },
    // LANCET reaped downward.
    airHeavy: { name: 'Long Incision', damage: 45, lift: 5.2 },
    // On top of the downed target, LANCET driven through them into the ground and a shockwave released.
    airSpecial: { name: 'Biopsy Strike', ...smash(3.4), damage: 65, down: 1.15 },
  },
  kuon: {
    // A blow that lands hard.
    lh: { name: 'Dark Spark', damage: 55, knockback: 11, lift: 4.2 },
    // A pull at maximum output: the target drawn up into it.
    llh: { name: 'Zero Gravity', ...snare(6, 1.5), damage: 38, lift: 9 },
    lllh: { name: 'Flying Kick', damage: 61, knock: 'splat', knockback: 5, down: .9 },
    // Everything that comes near him slowed to a stop.
    llls: { name: 'Event Horizon', ...snare(2.5, 2.2), damage: 51, daze: 1.75 },
    // The stomp on the head as the pull lifts them.
    airHeavy: { name: 'Crown Stomp', damage: 46, lift: 5 },
    // His opening move.
    airSpecial: { name: 'Supermassive', ...smash(4.8), damage: 66, knock: 'splat', knockback: 12, down: .95 },
  },
  oro: {
    // Fluid fired from his eyes under pressure.
    lh: { name: 'Gilded Glare', ...blast(10, 36), damage: 40, knockback: 8 },
    // SLUMBER's swinging uppercut.
    llh: { name: 'Hour Hand Uppercut', damage: 35, lift: 8.6, down: .5 },
    // SLUMBER vanishes, floats behind the target and punches it down.
    lllh: { name: 'Die!', damage: 57, knock: 'spike', down: 1 },
    // A touch that freezes the body.
    llls: { name: 'Grave-Cold Grip', damage: 48, daze: 1.6 },
    airHeavy: { name: 'Diving Kick', damage: 42, lift: 5.2 },
    // The knives thrown in stopped time closing in from every side, thrown from the air.
    airSpecial: { name: 'Checkmate', ...smash(4.2), damage: 62, knock: 'spike', down: 1 },
  },
  gaunt: {
    // The hand-cranked crossbow on his iron arm.
    lh: { name: 'Scrap Repeater', ...blast(9, 34), damage: 60, knockback: 7.5, lift: 3 },
    // The iron hand he punches with.
    llh: { name: 'Scrap-Arm Uppercut', damage: 52, lift: 8.6, down: .55, knockback: .8 },
    // The GRAVEDIGGER swung round him through a crowd.
    lllh: { name: 'Spinning Slash', damage: 82, knock: 'slide', knockback: 10, down: 1, radius: 1.3 },
    // The spiked bomb on a three-count fuse.
    llls: { name: 'Pipe Bomb', ...snare(5, 1.8), damage: 70, daze: 1.35 },
    // A leap and the GRAVEDIGGER brought down.
    airHeavy: { name: 'Leaping Gravedigger', damage: 62, outcome: 'knockdown', knock: 'spike', down: .9 },
    // The cannon fired point-blank.
    airSpecial: { name: 'Muzzle Blast', ...smash(4.8), damage: 96, knock: 'splat', knockback: 12, down: 1.05 },
  },
  // Round 4b (COMBAT): the quickest of the sixteen, quicker than the tempo clamp lets an ender be (0.85 of the roster's):
  // his six are timed at 0.78, and land light - the launch floats him the longest juggle, the stun is short.
  setsu: {
    // His 50 kg steel yo-yos.
    lh: { name: 'Steel Yo-Yo', ...blast(8, 30), damage: 34, knockback: 6.5, lift: 3.6, duration: 0.546, contacts: [0.218] },
    // SETSUNA's reflex: the body moves before he thinks.
    llh: { name: 'Flash Rise', damage: 27, lift: 9.8, down: .3, duration: 0.562, contacts: [0.211] },
    // His assassin's hand turned to claws.
    lllh: { name: "Silent Claw", damage: 48, down: .6, duration: 0.671, contacts: [0.281] },
    // The chop to the back of the neck.
    llls: { name: 'Snowfall Chop', damage: 40, daze: 1.05, duration: 0.702, contacts: [0.281] },
    airHeavy: { name: 'Diving Kick', damage: 36, lift: 6.8, duration: 0.484, contacts: [0.187] },
    // Dropping onto them as lightning.
    airSpecial: { name: 'Icefall', ...smash(3.4), damage: 52, outcome: 'dizzy', daze: 1, duration: 0.624, contacts: [0.172] },
  },
};
