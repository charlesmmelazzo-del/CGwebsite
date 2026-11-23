// ─── The Giving Tree — every guest-facing word ───────────────────────────────
//
// One file, so wording can be changed without touching components or emails.
// APPROVED wording is marked; everything else is draft from the spec (or
// written for this build) and can be edited freely.

import { hoursLabel, money } from "./rules";
import type { OppType } from "./types";

export const COPY = {
  // ── Approved ──
  hangButton: "Hang my ornament", // APPROVED
  treeTitle: "Ways to give", // APPROVED
  skyTitle: "What we've given", // APPROVED

  // ── Opening (written in script, one panel at a time) ── APPROVED
  introPanels: [
    "Here’s to a light in the window, old friends at the door, and a glass raised in welcome. May you always find that kind of warmth here. Welcome to Common Good.",
    "The joy of Christmas is as much in what we give as in what we receive. Our gift to you is a collection of cocktail recipes for the friends and family you welcome through your own door. And as we gather with those we love, we hope you’ll join us in sharing some of that warmth with neighbors who could use it this year.",
    "Each ornament on our virtual Giving Tree is an invitation from one of our partner organizations to lend a hand. Tap an ornament to find a way to give, whether you make a donation, drop off gifts or supplies, or sign up to volunteer your time. Thank you for spending part of your season with us. From all of us at Common Good, happy holidays and a very merry Christmas to you and yours.",
  ],
  introSkip: "Skip",
  introContinue: "Tap to continue",

  // ── Home (after the opening) ──
  homeRecipes: "Download cocktail recipes",
  homeTree: "View the Giving Tree",
  homeGiven: "See what we've given",
  home: "Home",

  // ── Tabs along the bottom ──
  tabTree: "Giving Tree",
  tabGiven: "What we've given",

  // ── Page ──
  popupTitle: "The Giving Tree",
  intro: "Pick an ornament, promise to do it, and hang your stocking with everyone else's.",
  sampleBanner: "Sample data: these organizations and opportunities are made up for a demo and are not real.",
  sandboxNote: "Sandbox: nothing here is public.",
  recipesButton: "Christmas cocktail recipes",
  recipesTitle: "Christmas cocktails",
  recipesIntro: "Take a recipe home and mix one for the family.",
  recipesEmpty: "The recipes are still being written up. Ask your bartender in the meantime.",
  recipeDownload: "Download the recipe",
  recipeSoon: "Recipe card coming soon.",
  back: "Back",
  close: "Close",
  partnersButton: "Our Partners",
  partnersTitle: "Our Partners",
  partnersIntro: "The organizations behind every ornament. Reach out to them directly any time.",
  partnersEmpty: "Our partners will be listed here soon.",
  seeWaysToGive: (org: string) => `See ways to give with ${org}`,
  website: "Website",
  call: "Call",
  emailUs: "Email",
  directions: "Directions",
  openSky: "See what we've given",
  backToTree: "Back to the tree",
  zoneLabels: { volunteer: "Volunteer", gift: "Gifts", cash: "Funds" } as Record<OppType, string>,
  zoneListTitle: (zone: string) => `${zone}: all ornaments`,
  zoneEmpty: "Every ornament here has been claimed. Thank you!",
  filteredTo: (org: string) => `Showing ways to give with ${org}`,
  clearFilter: "Show everything",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  resetView: "Fit",

  // ── Tree full / closed ──
  treeFullTitle: "The tree is full",
  treeFullBody: "Every ornament has been claimed. Thank you, neighbors. You can still reach our partners directly.",
  closedTitle: "The Giving Tree has closed for the season",
  closedBody: "Here's everything this community gave. Thank you.",

  // ── Ornament ──
  spotsLeft: (left: number, total: number) => `${left} of ${total} left`,
  meter: (value: number, goal: number | null, label: "pledged" | "raised", asOf: string | null) =>
    `${money(value)}${goal ? ` of ${money(goal)}` : ""} ${label === "raised" && asOf ? `raised, as of ${asOf}` : label}`,
  countdown: (days: number, type: OppType) => {
    const what = type === "gift" ? "to drop this off" : type === "volunteer" ? "to sign up" : "to give";
    if (days <= 0) return `Last day ${what}`;
    return `${days} day${days === 1 ? "" : "s"} left ${what}`;
  },
  hoursFixed: (h: number) => hoursLabel(h),
  hoursChoose: (min: number, max: number) => `${min} to ${max} hours, you choose`,
  from: "From",
  flipBack: "Back to the front",

  // ── Claim form ──
  formTitle: "Hang your ornament",
  name: "Your name",
  email: "Email",
  emailHelp:
    "This isn't a marketing list. We only use your email to talk with you about your gift and to send one thank-you recap at the end of the season.",
  phone: "Phone",
  phoneHelp: "We delete phone numbers when the season ends.",
  showName: "Show my name",
  stayAnonymous: "Stay anonymous",
  displayName: "Name on your stocking",
  note: "A note (optional)",
  noteHelp: "Like a name on a brick. A line or two that everyone will see on the tree and on the wall at the bar.",
  showWhatIGave: "Show what I gave on my stocking",
  showAmount: "Show the amount on my stocking",
  hours: "How many hours?",
  amount: "Amount",
  requirements: "From the organization",
  details: "Good to know",
  volunteerConsent: (org: string) =>
    `I agree that Common Good can share my name, email and phone number with ${org} so they can contact me about volunteering.`,
  volunteerConsentAnon: "This applies even if you stay anonymous on the tree.",
  giftDropoffTitle: "Drop-off",
  giftDue: (due: string) => `Please drop it off by ${due}.`,
  giftOrgDeadline: (d: string) => `The organization's deadline is ${d}.`,
  cashExplain: (org: string) =>
    `We never handle the money. After you hang your ornament we'll send you to ${org}'s own giving page to make your gift.`,
  trustLine: "We're taking you at your word, because that's what neighbors do. If plans change, just tell us and we'll put it back on the tree for someone else.",
  confirm: "Hang my ornament",
  sending: "Hanging…",

  // ── Errors ──
  errName: "Please add your name.",
  errEmail: "Please add an email address we can reach you at.",
  errPhone: "Please add a phone number so the organization can reach you.",
  errConsent: "Please tick the box so we can pass your details on.",
  errHours: "Please pick how many hours.",
  errAmount: "Please enter an amount of at least $0.01.",
  errNote: "Notes can be up to 200 characters.",
  errTaken: "Someone just claimed the last spot on this one. Pick another ornament?",
  errClosed: "This one isn't taking pledges any more.",
  errCap: (email: string) =>
    `You already have a lot on your list. Thank you! If you'd like to do more, email ${email} and we'll sort it out.`,
  errRate: (email: string) => `That's a lot of ornaments at once. Please try again in a little while, or email ${email}.`,
  errGeneric: "Something went wrong. Please try again.",

  // ── Success ──
  successTitle: "Your stocking is hung",
  codeLabel: "Your code",
  giftCodeFirst: (code: string) =>
    `Your code is ${code}. When you drop off your gift, write this code on one of the tags next to the box and attach it, so we can get it to the right person.`,
  volunteerNext: (org: string) => `We'll pass your details to ${org} and they will reach out to you directly to coordinate.`,
  cashContinue: (org: string) => `Continue to ${org}'s giving page`,
  emailSent: "We've emailed you a copy, with a link to change your plans.",

  // ── Sky ──
  counters: {
    hours: "hours pledged",
    dollars: "dollars pledged",
    giftsPromised: "gifts promised",
    giftsReceived: "gifts received",
    neighbors: "neighbors taking part",
  },
  neighborsLine: (n: number) => `${n} ${n === 1 ? "neighbor" : "neighbors"} taking part`,
  anonymous: "Anonymous",
  givenEmpty: "Check back as people give and volunteer to see what we've done together as a community.",
  givenAll: "All",
  givenSections: { volunteer: "Volunteering", gift: "Gifts", cash: "Donations" } as Record<OppType, string>,
  givenSectionEmpty: "Nothing here yet.",
  yourStocking: "Your stocking is hung",
  done: "Done",
  gaveVolunteer: (title: string, h: number | null) => (h ? `${hoursLabel(h)}: ${title}` : title),
  gaveGift: (title: string) => `Gift: ${title}`,
  gaveCash: (title: string, amount: number | null) => (amount != null ? `${money(amount)} toward ${title}` : title),

  // ── Self-service page (6) ──
  manageTitle: "Your ornament",
  manageCantMake: "I can't make it",
  manageMoreTime: "Need a few more days",
  manageStillOnIt: "Still on it",
  manageQuestions: (email: string) => `Questions? Email ${email} and mention your code.`,
  manageNotFound: "We couldn't find that ornament. The link may be incomplete.",
  manageReleasedTitle: "Thank you for wanting to be part of it",
  manageReleasedBody:
    "It's the thought that counts, and we're glad you wanted to be part of this. We've put the ornament back on the tree for someone else, and your stocking stays hung.",
  manageExtended: (due: string) => `Done. Your new drop-off date is ${due}.`,
  manageStillOnItDone: "Thanks for letting us know. We'll keep your ornament for you.",
  manageAlreadyExtended: "You've already had extra time on this one. If you need more, email us.",
  manageConfirmRelease: "Put this ornament back on the tree for someone else?",
  manageYes: "Yes, release it",
  manageStatus: {
    pledged: "Pledged",
    received: "Received. Thank you!",
    delivered: "Delivered to the organization. Thank you!",
    released: "Released",
    not_received: "Closed",
  } as Record<string, string>,
};

// ─── Emails (8) ──────────────────────────────────────────────────────────────

export const EMAIL_COPY = {
  senderName: "Common Good",
  testPrefix: "[TEST] ",
  trust: COPY.trustLine,
  manageLink: "Change your plans",
  signoff: "Thank you,\nCommon Good",
  confirmSubject: {
    gift: (title: string) => `Your Giving Tree gift: ${title}`,
    volunteer: (title: string) => `You're signed up: ${title}`,
    cash: (title: string) => `Your Giving Tree pledge: ${title}`,
  },
  reminderSubject: (title: string) => `A reminder about your gift: ${title}`,
  reminderIntro: (due: string) => `Just a friendly reminder that your Giving Tree gift is due by ${due}. How's it going?`,
  releaseSubject: "Thank you for wanting to be part of it",
  adminReleaseSubject: (code: string) => `Giving Tree: pledge ${code} was released`,
};
