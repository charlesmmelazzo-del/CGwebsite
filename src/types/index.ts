import type { ThemeName } from "@/lib/themes";

// ─── Business Info ───────────────────────────────────────────────────────────
export interface BusinessHours {
  label: string;    // e.g. "COFFEE" or "COCKTAILS"
  lines: string[];  // e.g. ["Mon - Sat | 7am - 12pm"]
}

export interface SiteSettings {
  phone: string;
  email: string;
  address: string;
  addressLine2: string;
  hours: BusinessHours[];
  socialLinks?: { label: string; url: string }[];
}

// ─── Carousel ────────────────────────────────────────────────────────────────
export type CarouselItemType = "text" | "image" | "form" | "instagram";

export interface CarouselItemBase {
  id: string;
  type: CarouselItemType;
  order: number;
  active: boolean;
  startDate?: string;  // ISO datetime — slide hidden before this
  endDate?: string;    // ISO datetime — slide hidden after this
}

export interface CarouselTextItem extends CarouselItemBase {
  type: "text";
  text: string;
  textColor?: string;
  fontFamily?: string;       // CSS value e.g. "var(--font-display)"
  fontSize?: number;         // px
  letterSpacing?: string;    // e.g. "0.15em"
  alignment?: "left" | "center" | "right";
}

export interface CarouselImageItem extends CarouselItemBase {
  type: "image";
  imageUrl: string;
  expandedImageUrl?: string;
  altText?: string;
  linkLabel?: string;        // optional CTA button below the image
  linkUrl?: string;
  linkNewTab?: boolean;
}

export interface CarouselFormItem extends CarouselItemBase {
  type: "form";
  formId: string;
  title: string;
  description: string;
  headerImageUrl?: string;   // optional image shown above the form instead of title/description
  fields: FormField[];
  submitLabel: string;
  // Title typography
  titleFontFamily?: string;
  titleFontSize?: number;
  titleColor?: string;
  titleAlignment?: "left" | "center" | "right";
  // Description typography
  descriptionFontSize?: number;
  descriptionColor?: string;
}

export interface CarouselInstagramItem extends CarouselItemBase {
  type: "instagram";
  instagramUrl: string;
  captionOverride?: string;
  textColor?: string;
  linkLabel?: string;        // optional CTA button below the slide
  linkUrl?: string;
  linkNewTab?: boolean;
  // Cached on save / refresh — public site reads these, never hits Instagram directly
  cachedImageUrl?: string;
  cachedCaption?: string;
  fetchedAt?: string;
  lastFetchFailed?: boolean;
}

export type CarouselItem = CarouselTextItem | CarouselImageItem | CarouselFormItem | CarouselInstagramItem;

// ─── Forms ───────────────────────────────────────────────────────────────────
export interface FormField {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "textarea" | "select";
  required: boolean;
  options?: string[]; // for select type
}

export interface FormSchema {
  id: string;
  name: string;        // e.g. "Home Capture Form", "Events Inquiry"
  title: string;
  description: string;
  fields: FormField[];
  submitLabel: string;
  createdAt: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  formName: string;
  data: Record<string, string>;
  submittedAt: string;
}

// ─── Content Sections (About, Club, Shop, etc.) ──────────────────────────────
export interface ContentSection {
  id: string;
  order: number;
  title?: string;
  body?: string;
  imageUrl?: string;
  imageAlt?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  buttonNewTab?: boolean;
  // Optional per-field color overrides (hex strings)
  titleColor?: string;
  bodyColor?: string;
  buttonLabelColor?: string;
}

export interface PageContent {
  pageId: string;
  sections: ContentSection[];
  theme?: ThemeName;
}

// ─── Events ──────────────────────────────────────────────────────────────────
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;      // ISO date string
  end?: string;
  allDay?: boolean;
  description?: string;
  imageUrl?: string;
  location?: string;
  visibleFrom?: string;   // ISO date — event hidden before this date
  visibleUntil?: string;  // ISO date — event hidden after this date
  // Optional CTA link (ticket purchase, RSVP, etc.)
  linkUrl?: string;
  linkLabel?: string;     // defaults to "More Info" when linkUrl is set
  linkNewTab?: boolean;   // default true
}

// ─── Menu / Coffee ───────────────────────────────────────────────────────────
export interface MenuTab {
  id: string;
  label: string;
  order: number;
  active: boolean;
}

export interface MenuItem {
  id: string;
  tabId: string;
  title: string;
  description?: string;
  carouselImageUrl?: string;  // cocktail photo shown on flip card front
  menuPageImageUrl?: string;  // kept for backward compat, not shown in flip design
  /** @deprecated use carouselImageUrl */
  imageUrl?: string;
  alt?: string;               // image alt text
  price?: string;
  order: number;
  active: boolean;
  // Back-of-card fields (shown when card is flipped)
  tagLine?: string;
  ingredients?: string;
  tastingNotes?: string;
  notableNotes?: string;
  // Optional per-field color overrides (hex strings)
  titleColor?: string;
  descriptionColor?: string;
  priceColor?: string;
}

// ─── Home Page ───────────────────────────────────────────────────────────────
export interface HomeSettings {
  backgroundImageUrl?: string;
  backgroundTheme: ThemeName;
  carouselItems: CarouselItem[];
  autoAdvance?: boolean;         // default true
  autoAdvanceInterval?: number;  // seconds, default 6
}

// ─── Page Builder — Section types ────────────────────────────────────────────
export interface PageSectionBase {
  id: string;
  order: number;
  visible: boolean;
}

export interface TextSection extends PageSectionBase {
  type: "text";
  title?: string;
  titleColor?: string;
  titleSize?: number;       // px, default 32
  body?: string;
  bodyColor?: string;
  bodySize?: number;        // px, default 16
  alignment?: "left" | "center" | "right";
  buttonLabel?: string;
  buttonUrl?: string;
  buttonNewTab?: boolean;
  buttonColor?: string;
  buttonSize?: number;      // px, default 11
  paddingY?: number;        // px, default 48
  paddingX?: number;        // px, default 64
}

export interface ImageSection extends PageSectionBase {
  type: "image";
  imageUrl: string;
  altText?: string;
  caption?: string;
  layout?: "full" | "contained" | "left" | "right";
  aspectRatio?: "16:9" | "4:3" | "1:1" | "3:2";
  maxWidth?: number;        // %, default 100
  captionSize?: number;     // px, default 12
}

export interface CarouselSection extends PageSectionBase {
  type: "carousel";
  slides: CarouselItem[];
  autoplay?: boolean;
  autoplayInterval?: number;
}

export interface EventsSection extends PageSectionBase {
  type: "events";
  title?: string;
  maxItems?: number;
  showPastEvents?: boolean;
  titleSize?: number;       // px, default 32
  itemSize?: number;        // px, default 15
  paddingY?: number;        // px, default 48
  paddingX?: number;        // px, default 64
}

export interface CtaSection extends PageSectionBase {
  type: "cta";
  heading: string;
  subheading?: string;
  buttonLabel: string;
  buttonUrl: string;
  buttonNewTab?: boolean;
  bgColor?: string;
  textColor?: string;
  buttonColor?: string;
  headingSize?: number;     // px, default 40
  subheadingSize?: number;  // px, default 16
  buttonSize?: number;      // px, default 11
  paddingY?: number;        // px, default 64
  paddingX?: number;        // px, default 64
}

export interface SpacerSection extends PageSectionBase {
  type: "spacer";
  height: number;
}

export type PageSection =
  | TextSection
  | ImageSection
  | CarouselSection
  | EventsSection
  | CtaSection
  | SpacerSection;

export interface PageDocument {
  pageId: string;
  label: string;
  slug: string;
  theme?: ThemeName;
  customBg?: string;
  customText?: string;
  customMuted?: string;
  sections: PageSection[];
  updatedAt: string;
}

export interface PagesData {
  pages: PageDocument[];
}

// ─── Page Headers ────────────────────────────────────────────────────────────
export interface PageHeaderTab {
  id: string;
  label: string;
}

/** A section on the Events "Host Your Event" tab */
export interface HostSection {
  id: string;
  order: number;
  type: "text" | "pdf";
  // text
  title?: string;
  body?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  buttonNewTab?: boolean;
  // pdf
  pdfUrl?: string;
  pdfTitle?: string;
  pdfDownloadLabel?: string;  // button label, default "Download PDF"
}

export interface PageHeaderData {
  title: string;
  titleSize: number;       // px, default 72
  subtitle?: string;
  subtitleSize?: number;   // px, default 13
  bgImageUrl?: string;     // custom background image URL (overrides theme bg color)
  tabs?: PageHeaderTab[];  // nav tabs within the page (events, shop)
  hostSections?: HostSection[];  // events page "Host Your Event" tab content
  theme?: ThemeName;       // page color palette; falls back to per-page default
  // Custom color overrides — take priority over named theme if all three are set
  customBg?: string;       // hex e.g. "#1A1F17"
  customText?: string;     // hex e.g. "#8A9A78"
  customMuted?: string;    // hex e.g. "#5a6a4a"
}

// ─── Site Config (Header / Footer) ───────────────────────────────────────────
export interface NavLink {
  id: string;
  label: string;
  href: string;
  visible: boolean;
  order: number;
  openInNewTab?: boolean;
}

export interface HeaderConfig {
  logoUrl?: string;             // Supabase Storage URL for the uploaded logo
  logoSize: number;
  mobileLogoSize: number;
  headerHeight: number;         // px, default 72
  mobileHeaderHeight: number;   // px, default 52
  bgColor: string;
  textColor: string;
  activeColor: string;
  borderColor: string;
  navFontSize: number;
  navLetterSpacing: string;
  navPaddingX: number;          // px per link, default 20
  navLinks: NavLink[];
}

export interface FooterConfig {
  bgColor: string;
  textColor: string;
  mutedColor: string;
  showHours: boolean;
  showContact: boolean;
  showSocialLinks: boolean;
  copyrightText?: string;
}

export interface SiteConfig {
  header: HeaderConfig;
  footer: FooterConfig;
  updatedAt: string;
}
