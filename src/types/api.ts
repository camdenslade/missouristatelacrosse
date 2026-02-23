export type Program = "men" | "women";

export type Role = "admin" | "player" | "parent" | "user" | "coach";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export interface ParentLink {
  uid?: string | null;
  email?: string | null;
}

export interface ApiUser {
  id?: string;
  uid: string;
  email?: string | null;
  displayName?: string | null;
  roles?: Partial<Record<Program, Role>>;
  programs?: Program[];
  playerId?: string | null;
}

export interface ApiPlayer {
  id: string;
  name?: string | null;
  email?: string | null;
  season?: string | null;
  number?: string | null;
  position?: string | null;
  classYear?: string | null;
  year?: string | null;
  photo?: string | null;
  balance?: number | string | null;
  profileId?: string | null;
  userUid?: string | null;
  userID?: string | null;
  parents?: ParentLink[]; 
  data?: Record<string, JsonValue>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiCoach {
  id: string;
  name?: string | null;
  title?: string | null;
  season?: string | null;
  photo?: string | null;
  data?: Record<string, JsonValue>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiGame {
  id: string;
  opponent?: string | null;
  date?: string | null;
  time?: string | null;
  location?: string | null;
  awayLogo?: string | null;
  awayLink?: string | null;
  season?: string | null;
  data?: Record<string, JsonValue>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiArticle {
  id: string;
  title?: string | null;
  author?: string | null;
  body?: string | null;
  content?: string | null;
  image?: string | null;
  published?: boolean | null;
  program?: Program | string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiTeam {
  id: string;
  name?: string | null;
  nameLower?: string | null;
  logo?: string | null;
  link?: string | null;
  season?: string | null;
  data?: Record<string, JsonValue>;
}

export interface ApiFundraiser {
  id: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  link?: string | null;
  goal?: number | null;
  raised?: number | null;
  published?: boolean | null;
  active?: boolean | null;
}

export interface ApiSponsor {
  id: string;
  name?: string | null;
  logo?: string | null;
  link?: string | null;
  displayOrder?: number | null;
}

export interface ApiGalleryFolder {
  folder: string;
  images: string[];
  createdAt?: string;
}

export interface ApiGroup {
  id: string;
  name?: string | null;
  members?: string[];
  createdBy?: string | null;
}

export interface ApiParentRecord {
  uid?: string | null;
  email?: string | null;
  linkedPlayers?: string[];
}

export interface ApiInstagramFeed {
  data?: {
    posts?: string[] | Record<string, string>;
  };
}

export interface PrintifyProductOptionValue {
  id: number | string;
  title: string;
}

export interface PrintifyProductOption {
  type: string;
  values: PrintifyProductOptionValue[];
}

export interface PrintifyProductVariant {
  id: number | string;
  options: Array<number | string>;
  our_price: number;
}

export interface PrintifyProductImage {
  src: string;
}

export interface PrintifyProduct {
  id: string | number;
  title: string;
  options: PrintifyProductOption[];
  variants: PrintifyProductVariant[];
  images?: PrintifyProductImage[];
}

export interface CartItem {
  id: string | number;
  title: string;
  variantId: string | number;
  price: number;
  quantity?: number;
  color?: string;
  size?: string;
  image?: string;
}

export interface ApiOrderLog {
  id: string;
  orderId?: string | null;
  success?: boolean | null;
  httpStatusCode?: number | null;
  shopId?: string | null;
  errorMessage?: string | null;
  requestPayload?: string | null;
  responsePayload?: string | null;
  timestamp?: string | null;
}

export type EventFieldType = "text" | "number" | "select" | "checkbox";

export interface ApiEventField {
  id: string;
  label: string;
  type: EventFieldType;
  required: boolean;
  options?: string[];
}

export interface ApiEvent {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
  mapsLink?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  description?: string | null;
  image?: string | null;
  fields: ApiEventField[];
  price?: number | null;
  teamSize: number;
  published: boolean;
  registrationCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiEventRegistration {
  id: string;
  eventId: string;
  payerName?: string | null;
  payerEmail?: string | null;
  paypalOrderId?: string | null;
  amountPaid?: number | null;
  paid: boolean;
  paidAt?: string | null;
  formData: Record<string, unknown>;
  teamId?: string | null;
  teammateEmails?: string[] | null;
  teamComplete?: boolean | null;
  createdAt?: string;
}

export interface ApiEventTeamCheck {
  found: boolean;
  teamId?: string | null;
  registrantName?: string | null;
  registrantEmail?: string | null;
}

export interface ApiRaffle {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  ticketPrice?: number | null;
  maxTicketsPerPerson?: number | null;
  allowBids: boolean;
  published: boolean;
  status: "active" | "closed" | "drawn";
  endTime?: string | null;
  winnerName?: string | null;
  winnerEmail?: string | null;
  entryCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiRaffleEntry {
  id: string;
  raffleId: string;
  payerName?: string | null;
  payerEmail?: string | null;
  payerPhone?: string | null;
  paypalOrderId?: string | null;
  amountPaid?: number | null;
  ticketCount: number;
  bidAmount?: number | null;
  paid: boolean;
  paidAt?: string | null;
  createdAt?: string;
}

export interface PublicOrderItem {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface PublicOrderDetails {
  orderId: string;
  items: PublicOrderItem[];
  shipping?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    region?: string | null;
    zip?: string | null;
    country?: string | null;
  } | null;
}
