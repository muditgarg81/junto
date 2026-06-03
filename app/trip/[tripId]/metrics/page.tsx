import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

interface PageProps {
  params: Promise<{ tripId: string }>;
}

export default async function MetricsPage({ params }: PageProps) {
  const { tripId } = await params;

  // Gate check: Only app operator (default-mudit-garg) can access economics
  const user = await getCurrentUser();
  if (!user || user.auth_id !== 'default-mudit-garg') {
    notFound();
  }

  redirect(`/admin/economics?tripId=${tripId}`);
}
