// ─── Let's Do Shots! — the drink orders ──────────────────────────────────────
//
// A hundred invented shots, each with the line the guest says and the four
// bottles that make it. One is drawn per stage, so a night on the game is never
// the same twice and nobody at the bar is reading the same joke as the person
// beside them.
//
// Written as tuples rather than objects on purpose: a hundred four-key objects
// is nine hundred lines nobody will ever proofread, and the whole point of this
// table is that it can be checked at a glance against the list it came from.
//
//   [ what they say before the name,  the shot's name,  the recipe ]
//
// The recipe is a space-separated list of BOTTLE_IDS, in the order it has to be
// poured — parseBottles throws at module load on a typo, so a mistake here is a
// failed build rather than a stage nobody can clear.
//
// The lettering is a 5x7 bitmap with no lowercase and no accents, so names are
// spelled for it: BEYONCE, MALORT. Anything it cannot draw is caught by the
// test in __tests__/shots.test.ts rather than shipped as "BEYONC?".

import { parseBottles, type BottleId } from "./bottles";

const RAW: [string, string, string][] = [
  ["You ever heard of a", "Bowie Moonboot", "bourbon gin tequila scotch"],
  ["Whip up one", "Cleopatra Fax Machine", "rum chartreuse amaro aperitivo"],
  ["Bartender, assemble a", "Prince Thunderpants", "liqueur malort bourbon gin"],
  ["Reckon you could pour the", "Nixon Moonwalk", "tequila scotch rum chartreuse"],
  ["Gimme that legendary", "Mozart Beefcake", "amaro aperitivo liqueur malort"],
  ["Rustle me a", "Cher Spacehelmet", "bourbon tequila rum amaro"],
  ["Perhaps prepare the", "Lincoln Discohorse", "gin scotch chartreuse aperitivo"],
  ["Sling over a", "Madonna Picklebackpack", "liqueur bourbon malort tequila"],
  ["Conjure your finest", "Sinatra Laserbeams", "scotch rum amaro gin"],
  ["Fetch us the notorious", "Napoleon Glitterbomb", "chartreuse aperitivo tequila liqueur"],
  ["Any chance you've mastered a", "Dolly Chainsaw", "malort bourbon scotch chartreuse"],
  ["Slide down one", "Einstein Partybarge", "gin rum aperitivo amaro"],
  ["Tonight demands a", "Hendrix Wafflehammer", "tequila liqueur bourbon scotch"],
  ["Kindly manufacture a", "Godzilla Taxicab", "chartreuse malort gin rum"],
  ["Hit me with the", "Elvis Karatepants", "aperitivo amaro scotch liqueur"],
  ["Surprise somebody with a", "Beethoven Hoverboard", "bourbon rum chartreuse liqueur"],
  ["Dial up the", "Jolene Meatball", "gin tequila aperitivo malort"],
  ["Tonight I'm risking a", "Gandalf Speedboat", "scotch amaro bourbon rum"],
  ["Please deploy one", "Picasso Boombox", "chartreuse liqueur gin tequila"],
  ["Launch the infamous", "Oprah Flamethrower", "aperitivo malort scotch amaro"],
  ["Mix something called", "Cobain Snackattack", "bourbon chartreuse aperitivo scotch"],
  ["I require a", "Caesar Trampoline", "gin amaro liqueur rum"],
  ["Serve forth the", "Shrek Nightcourt", "tequila malort bourbon chartreuse"],
  ["Summon a frosty", "Aretha Battlewagon", "scotch aperitivo gin amaro"],
  ["Somebody order the", "Tesla Hotdog", "rum liqueur tequila malort"],
  ["Shake together a", "Danzig Cheesecake", "bourbon amaro malort aperitivo"],
  ["I'd fancy the", "Galileo Funkbucket", "gin liqueur scotch chartreuse"],
  ["Send forth a", "Beyonce Horsefeather", "tequila bourbon rum amaro"],
  ["Knock together the", "Churchill Goblinjuice", "scotch gin aperitivo liqueur"],
  ["Pour boldly a", "Pacino Rocketpants", "rum chartreuse malort tequila"],
  ["My physician prescribed a", "Springsteen Dingdong", "bourbon aperitivo liqueur chartreuse"],
  ["Fire up your", "Rasputin Jetpack", "gin malort amaro tequila"],
  ["Toss together a", "Cyndi Meathelmet", "scotch bourbon chartreuse rum"],
  ["Apparently I need a", "Freud Danceparty", "aperitivo gin liqueur malort"],
  ["Make trouble with a", "Hulk Pancake", "amaro tequila rum scotch"],
  ["We're celebrating via", "Lemmy Butterknife", "bourbon liqueur amaro gin"],
  ["How about the", "Darwin Jukebox", "tequila chartreuse aperitivo scotch"],
  ["Tonight's special better be", "Streisand Wolfman", "rum malort bourbon liqueur"],
  ["Produce immediately a", "DaVinci Hamcannon", "chartreuse gin tequila amaro"],
  ["Courage calls for", "Macho Turnip", "aperitivo scotch rum malort"],
  ["Crank out a", "Keanu Thunderbucket", "bourbon malort gin aperitivo"],
  ["My grandmother recommends the", "Ozzy Lawnmower", "tequila amaro scotch liqueur"],
  ["Let's investigate a", "Tutankhamun Boogieboard", "rum bourbon chartreuse malort"],
  ["Prepare something dangerous:", "Minaj Cornshovel", "gin aperitivo tequila rum"],
  ["Bring forth the", "Brando Mustardwagon", "scotch liqueur amaro chartreuse"],
  ["I'll gamble upon a", "Cash Monkeybusiness", "bourbon scotch amaro tequila"],
  ["Throw down the", "Socrates Fannybag", "gin rum liqueur aperitivo"],
  ["Everyone fears the", "Rihanna Gravytrain", "chartreuse malort tequila bourbon"],
  ["Tonight we unleash", "Walken Dingbat", "amaro gin scotch rum"],
  ["Unlock a secret", "Zappa Picklehorse", "liqueur aperitivo chartreuse malort"],
  ["Brew me the forbidden", "Garfield Stinkfinger", "bourbon bourbon gin tequila"],
  ["Grandmother warned me about", "Custer Discoham", "scotch scotch rum chartreuse"],
  ["We're gonna regret the", "Bjork Noodlefoot", "amaro amaro aperitivo liqueur"],
  ["Apparently sailors drink", "Magellan Frogpants", "malort malort bourbon gin"],
  ["Slip me a", "Gaga Trashwizard", "tequila tequila scotch rum"],
  ["Somebody whispered about", "Houdini Beefwhistle", "chartreuse chartreuse amaro aperitivo"],
  ["I challenge thee to a", "Jagger Sockpuppet", "liqueur liqueur malort bourbon"],
  ["The prophecy mentions", "Confucius Meatstorm", "gin gin tequila scotch"],
  ["Order me one", "Parton Crankshaft", "rum rum chartreuse amaro"],
  ["Nobody survives the", "Dracula Bananafight", "aperitivo aperitivo liqueur malort"],
  ["Mix up that", "Ramone Potatoquake", "bourbon gin bourbon chartreuse"],
  ["The captain requests", "Marilyn Doomcanoe", "tequila scotch tequila aperitivo"],
  ["Grandma secretly loves a", "Genghis Bubblewrap", "rum amaro rum liqueur"],
  ["Tonight feels like", "Swift Mothball", "chartreuse malort chartreuse gin"],
  ["Pass over a", "Presley Chickenhammer", "amaro bourbon amaro scotch"],
  ["Spin me up the", "Archimedes Funkshoe", "aperitivo tequila aperitivo rum"],
  ["My parole officer suggested", "Garfunkel Cheesefist", "liqueur chartreuse liqueur malort"],
  ["Let's attempt the", "Swayze Gravyboat", "bourbon gin malort bourbon"],
  ["Hand over that", "Copernicus Meatwhistle", "tequila scotch gin tequila"],
  ["We came specifically for", "Lizzo Crumbbucket", "rum amaro scotch rum"],
  ["Whack together a", "Hemingway Bananjacket", "chartreuse aperitivo amaro chartreuse"],
  ["I've been training for", "Cherokee Moonpickle", "liqueur malort aperitivo liqueur"],
  ["Initiate the", "Orson Hamwallet", "bourbon tequila bourbon amaro"],
  ["Do your worst with", "Reba Chainsmoker", "gin scotch gin liqueur"],
  ["Shake vigorously the", "Voltaire Frogrocket", "rum chartreuse rum malort"],
  ["Slide across a", "Cage Thunderloaf", "aperitivo amaro aperitivo bourbon"],
  ["Bless this establishment with", "Lennon Biscuitwizard", "liqueur tequila liqueur gin"],
  ["Kickstart the", "Roosevelt Picklecopter", "scotch rum scotch chartreuse"],
  ["My horoscope demands", "Spears Meatballoon", "amaro malort amaro aperitivo"],
  ["Somebody awaken the", "Miyagi Snackdragon", "bourbon chartreuse bourbon malort"],
  ["Set loose a", "Vedder Gravywizard", "gin aperitivo gin amaro"],
  ["We'll split one", "Shakespeare Beefcanoe", "tequila liqueur tequila scotch"],
  ["Raise the alarm for", "Aniston Picklethunder", "rum malort rum chartreuse"],
  ["My accountant drinks", "Mussolini Jazzhands", "aperitivo bourbon aperitivo liqueur"],
  ["Sneak me the", "Wonder Breadwizard", "amaro gin amaro tequila"],
  ["Crank the jukebox and pour", "DeVito Hamstorm", "scotch chartreuse scotch rum"],
  ["Victory requires", "Mercury Mustardfoot", "liqueur malort liqueur bourbon"],
  ["Let's get weird with", "Plato Thunderpickle", "gin tequila gin aperitivo"],
  ["Grandma calls this", "Aguilera Beefpocket", "scotch amaro scotch liqueur"],
  ["Entertain us with", "Kubrick Wafflebomb", "rum chartreuse rum malort"],
  ["Release the ceremonial", "Dylan Sockhammer", "bourbon aperitivo bourbon tequila"],
  ["My lawyer insists upon", "Capone Glitterloaf", "gin liqueur gin chartreuse"],
  ["Wake me after a", "Pikachu Gravyhelmet", "scotch malort scotch amaro"],
  ["Risk everything on", "Sinbad Picklewagon", "rum bourbon rum aperitivo"],
  ["Pour courageously the", "Liberace Frogshovel", "chartreuse tequila chartreuse liqueur"],
  ["The regulars swear by", "Attila Biscuitcannon", "amaro gin amaro malort"],
  ["One final mistake:", "Madigan Meatparade", "aperitivo scotch aperitivo bourbon"],
  ["Nobody mention the", "Grohl Turnipmobile", "liqueur rum liqueur tequila"],
  ["Ring the bell for", "Aristotle Cheesethunder", "malort chartreuse malort gin"],
  ["Finish the evening with", "Buscemi Wafflebeast", "bourbon scotch rum malort"],
];

export interface ShotOrder {
  /** The whole line, ready for the speech bubble. */
  quip: string;
  /** Just the name, for the recipe strip and the win screen. */
  name: string;
  /** Four bottles, in the order they have to line up on the board. */
  recipe: BottleId[];
}

export const ORDERS: ShotOrder[] = RAW.map(([lead, name, spec]) => ({
  quip: `${lead} "${name}?"`,
  name,
  recipe: parseBottles(spec),
}));

/** Bottles in the recipe with duplicates removed, keeping the pour order. */
export function recipeBottles(recipe: BottleId[]): BottleId[] {
  const seen: BottleId[] = [];
  for (const b of recipe) if (!seen.includes(b)) seen.push(b);
  return seen;
}
