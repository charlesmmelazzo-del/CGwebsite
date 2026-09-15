// ─── Let's Do Shots! — the drink orders ──────────────────────────────────────
//
// A hundred invented shots, each with the line the guest says and the four
// bottles that make it. One is drawn per stage, so a night on the game is never
// the same twice and nobody at the bar is reading the same joke as the person
// beside them.
//
// Written as tuples rather than objects on purpose: a hundred objects is
// several hundred lines nobody will ever proofread, and the whole point of this
// table is that it can be checked at a glance against the list it came from.
//
//   [ the whole line the guest says,  the recipe ]
//
// The shot's name is whatever sits inside the double quotes in the line, minus
// any punctuation tucked in before the closing quote — so "Fax Machine," names
// FAX MACHINE. A line without a quoted name throws at module load.
//
// The recipe is a space-separated list of BOTTLE_IDS, in the order it has to be
// poured — parseBottles throws at module load on a typo, so a mistake here is a
// failed build rather than a stage nobody can clear.
//
// The lettering is a 5x7 bitmap with no lowercase, no accents and no curly
// quotes or long dashes, so lines are spelled for it: BEYONCE, straight quotes,
// a plain "-". Anything it cannot draw is caught by the test in
// __tests__/shots.test.ts rather than shipped as "BEYONC?".

import { parseBottles, type BottleId } from "./bottles";

const RAW: [string, string][] = [
  [`You ever heard of a "Bowie Moonboot"? Can you make me one?`, "bourbon gin tequila scotch"],
  [`Whip me up a "Cleopatra Fax Machine," would you?`, "rum chartreuse amaro aperitivo"],
  [`I'll have a "Prince Thunderpants." Yeah, that's really what it's called.`, "liqueur malort bourbon gin"],
  [`Got everything you need to make a "Nixon Moonwalk"?`, "tequila scotch rum chartreuse"],
  [`Let me try one of those "Mozart Beefcake" shots.`, "amaro aperitivo liqueur malort"],
  [`Think you could make me a "Cher Spacehelmet"?`, "bourbon tequila rum amaro"],
  [`I'd like a "Lincoln Discohorse," please.`, "gin scotch chartreuse aperitivo"],
  [`Can you hook me up with a "Madonna Picklebackpack"?`, "liqueur bourbon malort tequila"],
  [`Make mine a "Sinatra Laserbeams."`, "scotch rum amaro gin"],
  [`Can I get a round of "Napoleon Glitterbomb" shots?`, "chartreuse aperitivo tequila liqueur"],
  [`Have you ever made anyone a "Dolly Chainsaw"?`, "malort bourbon scotch chartreuse"],
  [`I'll take an "Einstein Partybarge" whenever you get a chance.`, "gin rum aperitivo amaro"],
  [`It's been a long day. Make me a "Hendrix Wafflehammer."`, "tequila liqueur bourbon scotch"],
  [`Do you know how to make a "Godzilla Taxicab"?`, "chartreuse malort gin rum"],
  [`Hit me with an "Elvis Karatepants."`, "aperitivo amaro scotch liqueur"],
  [`Could you make a "Beethoven Hoverboard" for my friend here?`, "bourbon rum chartreuse liqueur"],
  [`How about a "Jolene Meatball" to get things started?`, "gin tequila aperitivo malort"],
  [`I'll try a "Gandalf Speedboat." What's the worst that could happen?`, "scotch amaro bourbon rum"],
  [`Can you mix me up a "Picasso Boombox"?`, "chartreuse liqueur gin tequila"],
  [`Let's do a round of "Oprah Flamethrower" shots.`, "aperitivo malort scotch amaro"],
  [`Someone told me to try a "Cobain Snackattack." Can you make one?`, "bourbon chartreuse aperitivo scotch"],
  [`I'll have a "Caesar Trampoline," please.`, "gin amaro liqueur rum"],
  [`You wouldn't happen to know how to make a "Shrek Nightcourt," would you?`, "tequila malort bourbon chartreuse"],
  [`Any chance I could get an "Aretha Battlewagon"?`, "scotch aperitivo gin amaro"],
  [`Do you guys make a shot called the "Tesla Hotdog"?`, "rum liqueur tequila malort"],
  [`Mix me up a "Danzig Cheesecake," would you?`, "bourbon amaro malort aperitivo"],
  [`I'm in the mood for a "Galileo Funkbucket."`, "gin liqueur scotch chartreuse"],
  [`Could I get a "Beyonce Horsefeather," please?`, "tequila bourbon rum amaro"],
  [`Got the stuff to make a "Churchill Goblinjuice"?`, "scotch gin aperitivo liqueur"],
  [`Pour me a "Pacino Rocketpants." I like the sound of it.`, "rum chartreuse malort tequila"],
  [`I'll take a "Springsteen Dingdong." Don't make me say it twice.`, "bourbon aperitivo liqueur chartreuse"],
  [`Can you do a couple of "Rasputin Jetpack" shots for us?`, "gin malort amaro tequila"],
  [`How about you make me a "Cyndi Meathelmet"?`, "scotch bourbon chartreuse rum"],
  [`I think I need a "Freud Danceparty." You know that one?`, "aperitivo gin liqueur malort"],
  [`Whip me up a shot of "Hulk Pancake."`, "amaro tequila rum scotch"],
  [`We're celebrating! Can we get a round of "Lemmy Butterknife" shots?`, "bourbon liqueur amaro gin"],
  [`Have you made a "Darwin Jukebox" before?`, "tequila chartreuse aperitivo scotch"],
  [`I'll try the "Streisand Wolfman." Mostly because of the name.`, "rum malort bourbon liqueur"],
  [`One "DaVinci Hamcannon," please. I practiced saying it.`, "chartreuse gin tequila amaro"],
  [`Can I get a "Macho Turnip" to start?`, "aperitivo scotch rum malort"],
  [`Could you fix me a "Keanu Thunderbucket"?`, "bourbon malort gin aperitivo"],
  [`My grandma swears by the "Ozzy Lawnmower." Can you make me one?`, "tequila amaro scotch liqueur"],
  [`I'd like to try a "Tutankhamun Boogieboard" if you know how to make it.`, "rum bourbon chartreuse malort"],
  [`You got everything for a "Minaj Cornshovel"?`, "gin aperitivo tequila rum"],
  [`I'll have a "Brando Mustardwagon." My usual sounds boring now.`, "scotch liqueur amaro chartreuse"],
  [`I'll take my chances with a "Cash Monkeybusiness."`, "bourbon scotch amaro tequila"],
  [`Can you make us a couple of "Socrates Fannybag" shots?`, "gin rum liqueur aperitivo"],
  [`My friend dared me to order a "Rihanna Gravytrain." You make those?`, "chartreuse malort tequila bourbon"],
  [`Let's go with a "Walken Dingbat."`, "amaro gin scotch rum"],
  [`I hear there's a shot called the "Zappa Picklehorse." Can I get one?`, "liqueur aperitivo chartreuse malort"],
  [`Can I get a "Garfield Stinkfinger"? Please don't announce it.`, "bourbon bourbon gin tequila"],
  [`Do you happen to know a shot called the "Custer Discoham"?`, "scotch scotch rum chartreuse"],
  [`Let's get a round of "Bjork Noodlefoot" shots. This ought to be interesting.`, "amaro amaro aperitivo liqueur"],
  [`Ever had anyone ask you for a "Magellan Frogpants"?`, "malort malort bourbon gin"],
  [`Make me a "Gaga Trashwizard," please. It's that kind of night.`, "tequila tequila scotch rum"],
  [`Somebody recommended a "Houdini Beefwhistle." Think you could make one?`, "chartreuse chartreuse amaro aperitivo"],
  [`You up for making me a "Jagger Sockpuppet"?`, "liqueur liqueur malort bourbon"],
  [`I'd like a "Confucius Meatstorm." I promise I didn't just make that up.`, "gin gin tequila scotch"],
  [`Could you pour me a "Parton Crankshaft"?`, "rum rum chartreuse amaro"],
  [`I'll try a "Dracula Bananafight." Should I be worried?`, "aperitivo aperitivo liqueur malort"],
  [`Mix me up one of those "Ramone Potatoquake" shots.`, "bourbon gin bourbon chartreuse"],
  [`Can you make a "Marilyn Doomcanoe" for my buddy over there?`, "tequila scotch tequila aperitivo"],
  [`My grandma loves a "Genghis Bubblewrap." I'll have what she's having.`, "rum amaro rum liqueur"],
  [`I'm thinking a "Swift Mothball." Can you do that?`, "chartreuse malort chartreuse gin"],
  [`I'll take a "Presley Chickenhammer," please.`, "amaro bourbon amaro scotch"],
  [`Have you ever mixed up an "Archimedes Funkshoe"?`, "aperitivo tequila aperitivo rum"],
  [`My parole officer mentioned a "Garfunkel Cheesefist." Know how to make one?`, "liqueur chartreuse liqueur malort"],
  [`Think you could whip up a "Swayze Gravyboat" for me?`, "bourbon gin malort bourbon"],
  [`Could I get a shot called the "Copernicus Meatwhistle"?`, "tequila scotch gin tequila"],
  [`I came here to try a "Lizzo Crumbbucket." Can you help me out?`, "rum amaro scotch rum"],
  [`Can you put together a "Hemingway Bananjacket" for me?`, "chartreuse aperitivo amaro chartreuse"],
  [`I've been meaning to try a "Cherokee Moonpickle." You make those?`, "liqueur malort aperitivo liqueur"],
  [`One "Orson Hamwallet," please. Let's not overthink it.`, "bourbon tequila bourbon amaro"],
  [`I'll have a "Reba Chainsmoker." My friend says it's good.`, "gin scotch gin liqueur"],
  [`Got what you need to make a "Voltaire Frogrocket"?`, "rum chartreuse rum malort"],
  [`How about a "Cage Thunderloaf" for me?`, "aperitivo amaro aperitivo bourbon"],
  [`Can we get a round of "Lennon Biscuitwizard" shots over here?`, "liqueur tequila liqueur gin"],
  [`I'd love a "Roosevelt Picklecopter" if you can make one.`, "scotch rum scotch chartreuse"],
  [`I'll try the "Spears Meatballoon." My horoscope said to try something new.`, "amaro malort amaro aperitivo"],
  [`You know that shot called the "Miyagi Snackdragon"? I'll have one.`, "bourbon chartreuse bourbon malort"],
  [`Any chance you could mix me a "Vedder Gravywizard"?`, "gin aperitivo gin amaro"],
  [`Can you make two "Shakespeare Beefcanoe" shots? One for each of us.`, "tequila liqueur tequila scotch"],
  [`Could you whip me up an "Aniston Picklethunder"?`, "rum malort rum chartreuse"],
  [`My accountant drinks a "Mussolini Jazzhands." Can you make me one?`, "aperitivo bourbon aperitivo liqueur"],
  [`I'd like to order a "Wonder Breadwizard," please.`, "amaro gin amaro tequila"],
  [`Put on something good and pour me a "DeVito Hamstorm."`, "scotch chartreuse scotch rum"],
  [`We're celebrating a win. Make us some "Mercury Mustardfoot" shots!`, "liqueur malort liqueur bourbon"],
  [`Let's get weird. Can you make me a "Plato Thunderpickle"?`, "gin tequila gin aperitivo"],
  [`Can you do an "Aguilera Beefpocket"? My grandma used to make them.`, "scotch amaro scotch liqueur"],
  [`Surprise me. Actually, no - make me a "Kubrick Wafflebomb."`, "rum chartreuse rum malort"],
  [`I'll take a "Dylan Sockhammer." Been wanting to try that one.`, "bourbon aperitivo bourbon tequila"],
  [`My lawyer recommended a "Capone Glitterloaf." Can I get one?`, "gin liqueur gin chartreuse"],
  [`Can I get a "Pikachu Gravyhelmet"? Yes, I am an adult.`, "scotch malort scotch amaro"],
  [`Let's try a round of "Sinbad Picklewagon" shots.`, "rum bourbon rum aperitivo"],
  [`Would you mind making me a "Liberace Frogshovel"?`, "chartreuse tequila chartreuse liqueur"],
  [`I hear the regulars like the "Attila Biscuitcannon." I'll try one.`, "amaro gin amaro malort"],
  [`One last shot for me. Make it a "Madigan Meatparade."`, "aperitivo scotch aperitivo bourbon"],
  [`Can you make a "Grohl Turnipmobile"? Let's keep the name between us.`, "liqueur rum liqueur tequila"],
  [`Do you have the stuff to make an "Aristotle Cheesethunder"?`, "malort chartreuse malort gin"],
  [`I'll finish with a "Buscemi Wafflebeast," please.`, "bourbon scotch rum malort"],
];

export interface ShotOrder {
  /** The whole line, ready for the speech bubble. */
  quip: string;
  /** Just the name, for the recipe strip and the win screen. */
  name: string;
  /** Four bottles, in the order they have to line up on the board. */
  recipe: BottleId[];
}

/** The quoted name in a line, without punctuation tucked inside the quotes. */
function nameIn(quip: string): string {
  const m = quip.match(/"([^"]+)"/);
  if (!m) throw new Error(`No quoted shot name in: ${quip}`);
  return m[1].replace(/[.,!?]+$/, "");
}

export const ORDERS: ShotOrder[] = RAW.map(([quip, spec]) => ({
  quip,
  name: nameIn(quip),
  recipe: parseBottles(spec),
}));

/** Bottles in the recipe with duplicates removed, keeping the pour order. */
export function recipeBottles(recipe: BottleId[]): BottleId[] {
  const seen: BottleId[] = [];
  for (const b of recipe) if (!seen.includes(b)) seen.push(b);
  return seen;
}
