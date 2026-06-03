'use strict';

import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { authorizeTripAccess, HttpError } from '@/lib/authz';

interface LocalInfoData {
  destination: string;
  universal: string;
  police: string;
  ambulance: string;
  hospitalName: string;
  hospitalLocation: string;
  hospitalDistance: string;
  hospitalPhone: string;
  touristHelpline: string;
}

const LOCAL_INFO_MOCKS: Record<string, LocalInfoData> = {
  goa: {
    destination: 'Goa, India',
    universal: '112',
    police: '100',
    ambulance: '108',
    hospitalName: 'Manipal Hospital',
    hospitalLocation: 'Dona Paula, Panaji',
    hospitalDistance: '4.2 km away',
    hospitalPhone: '0832 304 8800',
    touristHelpline: '1363'
  },
  venice: {
    destination: 'Venice, Italy',
    universal: '112',
    police: '113',
    ambulance: '118',
    hospitalName: 'Ospedale Civile SS. Giovanni e Paolo',
    hospitalLocation: 'Castello, Venice',
    hospitalDistance: '1.2 km away',
    hospitalPhone: '+39 041 529 4111',
    touristHelpline: '+39 041 5298711'
  },
  paris: {
    destination: 'Paris, France',
    universal: '112',
    police: '17',
    ambulance: '15',
    hospitalName: 'Hôpital Lariboisière',
    hospitalLocation: 'Rue Ambroise Paré, Paris',
    hospitalDistance: '1.8 km away',
    hospitalPhone: '+33 1 49 95 60 00',
    touristHelpline: '+33 1 49 52 42 63'
  },
  rome: {
    destination: 'Rome, Italy',
    universal: '112',
    police: '113',
    ambulance: '118',
    hospitalName: 'Ospedale Santo Spirito in Sassia',
    hospitalLocation: 'Lungotevere in Sassia, Rome',
    hospitalDistance: '2.1 km away',
    hospitalPhone: '+39 06 68351',
    touristHelpline: '+39 06 0608'
  }
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  try {
    // Gating check
    await authorizeTripAccess(tripId);
    // Query locked destination from decisions
    const destRes = await query(
      `SELECT o.label FROM decisions d
       JOIN options o ON d.resolved_option_id = o.id
       WHERE d.trip_id = $1 AND d.type = 'destination' AND d.status = 'locked'
       LIMIT 1`,
      [tripId]
    );

    let destinationName = 'Goa'; // Fallback default
    if (destRes.rows.length > 0) {
      destinationName = destRes.rows[0].label;
    } else {
      // Try to get from trip name
      const tripRes = await query('SELECT name FROM trips WHERE id = $1', [tripId]);
      if (tripRes.rows.length > 0) {
        const tripName = tripRes.rows[0].name.toLowerCase();
        if (tripName.includes('paris')) destinationName = 'Paris';
        else if (tripName.includes('venice')) destinationName = 'Venice';
        else if (tripName.includes('rome')) destinationName = 'Rome';
      }
    }

    const key = destinationName.toLowerCase().split(',')[0].trim();
    const info = LOCAL_INFO_MOCKS[key] || {
      destination: destinationName,
      universal: '112',
      police: '100',
      ambulance: '108',
      hospitalName: 'City General Hospital',
      hospitalLocation: 'Central District',
      hospitalDistance: '3.0 km away',
      hospitalPhone: '112',
      touristHelpline: '1363'
    };

    return NextResponse.json(info);
  } catch (err: any) {
    console.error('Error fetching local info:', err);
    if (err instanceof HttpError || err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
