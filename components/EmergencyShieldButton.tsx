'use strict';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

interface EmergencyShieldButtonProps {
  tripId: string;
}

export function EmergencyShieldButton({ tripId }: EmergencyShieldButtonProps) {
  return (
    <Link
      href={`/trip/${tripId}/local-info`}
      className="p-2 bg-secondary/10 border border-secondary/20 hover:bg-secondary/20 rounded-full transition active:scale-95 duration-200 text-secondary shrink-0"
      title="Local Emergency Info (SOS)"
    >
      <ShieldAlert className="w-5 h-5 fill-secondary/10 text-secondary animate-pulse" />
    </Link>
  );
}

export default EmergencyShieldButton;
