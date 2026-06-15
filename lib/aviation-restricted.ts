'use strict';

/**
 * Aviation-restricted items checker.
 * Rules sourced from DGCA (India) and IATA guidelines.
 *
 * Each rule has:
 *  - keywords: substrings to match against the checklist label (case-insensitive)
 *  - severity: 'banned' | 'cabin_only' | 'checked_only' | 'limited'
 *  - message: one-line human-readable restriction
 */

export type RestrictionSeverity = 'banned' | 'cabin_only' | 'checked_only' | 'limited';

export interface AviationRestriction {
  severity: RestrictionSeverity;
  message: string;
}

interface Rule {
  keywords: string[];
  severity: RestrictionSeverity;
  message: string;
}

const RULES: Rule[] = [
  // ── Absolutely banned ────────────────────────────────────────────────────
  {
    keywords: ['firecracker', 'firework', 'explosive', 'dynamite', 'flare'],
    severity: 'banned',
    message: 'Explosives & fireworks are banned on all flights — leave these behind.',
  },
  {
    keywords: ['firearm', 'gun', 'pistol', 'revolver', 'rifle', 'ammunition', 'bullet', 'cartridge'],
    severity: 'banned',
    message: 'Firearms & ammunition require prior airline approval and special declaration — not allowed as regular baggage.',
  },
  {
    keywords: ['radioactive', 'toxic', 'poison', 'cyanide'],
    severity: 'banned',
    message: 'Radioactive and toxic substances are banned from passenger flights.',
  },

  // ── Cabin only (not in checked bag) ──────────────────────────────────────
  {
    keywords: ['power bank', 'powerbank', 'portable charger', 'portable battery'],
    severity: 'cabin_only',
    message: 'Power banks must travel in cabin carry-on — not allowed in checked baggage (fire risk).',
  },
  {
    keywords: ['e-cigarette', 'e cigarette', 'vape', 'vaping', 'electronic cigarette'],
    severity: 'cabin_only',
    message: 'E-cigarettes / vapes must be in cabin carry-on; vaping on board is prohibited.',
  },
  {
    keywords: ['spare battery', 'loose battery', 'lithium battery', 'li-ion battery', 'li ion battery'],
    severity: 'cabin_only',
    message: 'Spare/loose lithium batteries must be in cabin carry-on, not in checked luggage.',
  },
  {
    keywords: ['laptop', 'macbook', 'notebook computer'],
    severity: 'cabin_only',
    message: 'Laptops should be in cabin carry-on; some airlines ban lithium devices in checked bags.',
  },

  // ── Checked baggage only (not in cabin) ───────────────────────────────────
  {
    keywords: ['knife', 'blade', 'dagger', 'machete', 'swiss army knife', 'penknife', 'pocket knife', 'utility knife'],
    severity: 'checked_only',
    message: 'Knives and blades are not allowed in cabin — must go in checked baggage.',
  },
  {
    keywords: ['scissors', 'shears'],
    severity: 'checked_only',
    message: 'Scissors with blades >6 cm must be in checked baggage; small nail scissors are fine in cabin.',
  },
  {
    keywords: ['razor blade', 'box cutter', 'stanley knife', 'craft knife'],
    severity: 'checked_only',
    message: 'Razor blades and box cutters are not allowed in cabin — checked baggage only.',
  },
  {
    keywords: ['golf club', 'cricket bat', 'baseball bat', 'hockey stick', 'ski pole', 'martial arts'],
    severity: 'checked_only',
    message: 'Sports equipment must be checked — not allowed in cabin.',
  },
  {
    keywords: ['lighter fluid', 'fuels', 'petrol', 'kerosene', 'turpentine'],
    severity: 'checked_only',
    message: 'Flammable liquids are banned from both cabin and checked baggage.',
  },
  {
    keywords: ['pepper spray', 'mace spray', 'tear gas'],
    severity: 'checked_only',
    message: 'Pepper spray / mace is not allowed in cabin; max 100ml allowed in checked bag.',
  },

  // ── Limited / special rules ───────────────────────────────────────────────
  {
    keywords: ['lighter', 'match', 'matchbox', 'zippo'],
    severity: 'limited',
    message: 'One lighter is allowed in your pocket (not in cabin bag or checked bag). Matches: 1 pack in cabin.',
  },
  {
    keywords: ['aerosol', 'deodorant spray', 'hair spray', 'insect repellent spray', 'body spray'],
    severity: 'limited',
    message: 'Aerosols for personal use: max 100 ml per container, max 500 ml total, in checked bag only (unless ≤100 ml and in liquids bag for cabin).',
  },
  {
    keywords: ['perfume', 'cologne', 'aftershave', 'eau de toilette', 'eau de parfum'],
    severity: 'limited',
    message: 'Liquids in cabin carry-on must be ≤100 ml per bottle in a 1-litre clear zip-lock bag.',
  },
  {
    keywords: ['shampoo', 'conditioner', 'face wash', 'body wash', 'shower gel', 'lotion', 'moisturiser', 'moisturizer', 'sunscreen', 'sunblock', 'hair gel', 'hair cream', 'toothpaste'],
    severity: 'limited',
    message: 'Liquids/gels in cabin carry-on must be ≤100 ml per bottle in a 1-litre clear zip-lock bag.',
  },
  {
    keywords: ['alcohol', 'whisky', 'whiskey', 'rum', 'vodka', 'gin', 'brandy', 'liquor', 'wine bottle'],
    severity: 'limited',
    message: 'Alcohol >70% ABV is banned. 24–70% ABV: max 5 litres in checked bag, sealed retail packaging.',
  },
  {
    keywords: ['battery bank', 'battery pack'],
    severity: 'cabin_only',
    message: 'Battery packs must travel in cabin carry-on — not allowed in checked baggage.',
  },
  {
    keywords: ['gel', 'hair wax', 'pomade'],
    severity: 'limited',
    message: 'Gels in cabin carry-on must be ≤100 ml in a 1-litre clear zip-lock bag.',
  },
  {
    keywords: ['medicine', 'medication', 'prescription', 'insulin', 'syringe'],
    severity: 'limited',
    message: 'Carry prescription medicines in cabin with a doctor\'s letter; syringes need a medical certificate.',
  },
  {
    keywords: ['drone', 'quadcopter', 'uav'],
    severity: 'limited',
    message: 'Drone batteries (LiPo) must be in cabin carry-on. Drones themselves may need airline approval.',
  },
];

/**
 * Check a checklist item label against aviation restriction rules.
 * Returns the first matching restriction, or null if the item is unrestricted.
 */
export function getAviationRestriction(label: string): AviationRestriction | null {
  const lower = label.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return { severity: rule.severity, message: rule.message };
    }
  }
  return null;
}

export const SEVERITY_LABEL: Record<RestrictionSeverity, string> = {
  banned: '✈️ Banned',
  cabin_only: '✈️ Cabin only',
  checked_only: '✈️ Checked bag only',
  limited: '✈️ Airline rules apply',
};

export const SEVERITY_COLOR: Record<RestrictionSeverity, string> = {
  banned: 'text-[#ba1a1a] bg-[#ffdad6]/60 border-[#ba1a1a]/30',
  cabin_only: 'text-[#7c4b00] bg-[#ffedcc]/60 border-[#7c4b00]/30',
  checked_only: 'text-[#7c4b00] bg-[#ffedcc]/60 border-[#7c4b00]/30',
  limited: 'text-[#1f4d3f] bg-[#e6f3ef]/60 border-[#1f4d3f]/30',
};
