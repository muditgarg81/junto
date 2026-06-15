// Domain Types for Junto Travel Companion

export interface Trip {
  id: string;
  name: string;
  status: 'planning' | 'active' | 'done';
  base_currency: string;
  invite_token: string;
  created_at: string;
}

export interface User {
  id: string;
  auth_id: string;
  name: string;
  email: string;
  photo_url?: string | null;
  phone?: string | null;
  home_currency?: string | null;
  upi_id?: string | null;
  chat_prefs?: any;
  created_at: string;
}

export interface Member {
  id: string;
  trip_id: string;
  name?: string | null;
  status: 'invited' | 'confirmed' | 'maybe' | 'out';
  roles: string[];
  auth_id?: string | null;
  upi_id?: string | null;
  user_id?: string | null;
  avatar_url?: string | null;
  photo_url?: string | null;
  email?: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  trip_id: string;
  author_id: string | null;
  is_ai: boolean;
  body: string;
  metadata?: any;
  created_at: string;
}

export interface Decision {
  id: string;
  trip_id: string;
  type: 'dates' | 'destination' | 'hotel' | 'budget' | 'logistics' | 'custom';
  title: string;
  status: 'open' | 'locked' | 'rejected';
  resolved_option_id?: string | null;
  created_from_message_id?: string | null;
  created_at: string;
}

export interface Option {
  id: string;
  decision_id: string;
  label: string;
  payload: any; // jsonb payload
  proposed_by: string | null;
  created_at: string;
}

export interface Vote {
  id: string;
  decision_id: string;
  option_id: string;
  member_id: string;
  value: 'yes' | 'no' | 'abstain';
  created_at: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  paid_by: string;
  amount: number;
  currency: string;
  fx_rate: number;
  description: string;
  category: string;
  date: string;
  split_type: 'equal' | 'shares' | 'exact';
  source: 'manual' | 'ai-draft';
  created_at: string;
}

export interface Split {
  id: string;
  expense_id: string;
  member_id: string;
  weight?: number | null;
  exact_amount?: number | null;
  created_at: string;
}

export interface VaultItem {
  id: string;
  trip_id: string;
  kind: 'flight' | 'stay' | 'activity' | 'contact' | 'other' | 'itinerary';
  doc_type?: 'pdf' | 'image' | null;
  source_file_url?: string | null;
  fields: any; // jsonb fields
  created_at: string;
}

export interface ItineraryItem {
  id: string;
  trip_id: string;
  date: string;          // YYYY-MM-DD (legacy; prefer starts_at)
  time?: string | null;  // HH:MM:SS   (legacy; prefer starts_at)
  starts_at?: string | null; // ISO 8601 with tz — use for all time math
  ends_at?: string | null;   // ISO 8601 with tz — enables interval-intersection overlap detection
  tz?: string | null;        // IANA timezone, e.g. 'Asia/Kolkata'
  type: string; // 'flight' | 'stay' | 'activity' | 'other'
  title: string;
  location?: string | null;
  source_vault_item_id?: string | null;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  trip_id: string;
  label: string;
  category: 'personal' | 'shared';
  assigned_to?: string | null;
  per_person: boolean;
  done: boolean;
  source?: 'manual' | 'ai_chat' | 'imported';
  imported_from_trip_id?: string | null;
  created_at: string;
}

export interface Offer {
  id: string;
  trip_id: string;
  category: 'hotel' | 'activity' | 'insurance' | 'esim' | 'forex' | 'transport';
  partner: string;
  title: string;
  price: number;
  currency: string;
  deep_link: string;
  commission_estimate: number;
  surfaced_by: string;
  status: 'shown' | 'clicked' | 'converted' | 'dismissed';
  created_at: string;
}

export interface OfferClick {
  id: string;
  offer_id: string;
  member_id?: string | null;
  sub_id: string;
  clicked_at: string;
}

export interface Conversion {
  id: string;
  offer_id?: string | null;
  sub_id: string;
  gross_amount: number;
  commission: number;
  confirmed_at: string;
}

export interface TripUpgrade {
  id: string;
  trip_id: string;
  tier: 'boost';
  paid_by?: string | null;
  provider: 'razorpay' | 'stripe';
  provider_ref?: string | null;
  amount: number;
  status: 'pending' | 'active' | 'failed';
  created_at: string;
}

// Helper types for assembled UI states
export interface TripState {
  trip: Trip;
  members: Member[];
  messages: Message[];
  decisions: (Decision & { options: Option[]; votes: Vote[] })[];
  expenses: (Expense & { splits: Split[] })[];
  vaultItems: VaultItem[];
  itineraryItems: ItineraryItem[];
  checklistItems: ChecklistItem[];
  offers: Offer[];
  isBoosted: boolean;
}
