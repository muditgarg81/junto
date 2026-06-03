'use strict';

import React from 'react';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import AffiliatesClient from './AffiliatesClient';

export default async function AdminAffiliatesPage() {
  // Gate check: Only app operator (default-mudit-garg) can access affiliates management
  const user = await getCurrentUser();
  if (!user || user.auth_id !== 'default-mudit-garg') {
    notFound();
  }

  // 1. Fetch all partners
  const partnersRes = await query('SELECT * FROM partners ORDER BY category ASC, priority ASC, name ASC');
  const partners = partnersRes.rows;

  // 2. Fetch recent audit logs
  const auditLogsRes = await query(
    `SELECT al.*, u.name as operator_name 
     FROM audit_logs al 
     LEFT JOIN users u ON al.user_id = u.id 
     ORDER BY al.created_at DESC 
     LIMIT 20`
  );
  const auditLogs = auditLogsRes.rows;

  // 3. Fetch performance metrics grouped by partner name
  const metricsRes = await query(`
    SELECT 
      o.partner as partner_name,
      COUNT(DISTINCT oc.id) as clicks,
      COUNT(DISTINCT c.id) as conversions,
      COALESCE(SUM(c.commission), 0) as revenue
    FROM offers o
    LEFT JOIN offer_clicks oc ON o.id = oc.offer_id
    LEFT JOIN conversions c ON o.id = c.offer_id
    GROUP BY o.partner
  `);
  const metrics = metricsRes.rows;

  // Build a map of partner name -> metrics for fast lookup
  const metricsMap: Record<string, { clicks: number; conversions: number; revenue: number }> = {};
  metrics.forEach((row: any) => {
    metricsMap[row.partner_name] = {
      clicks: parseInt(row.clicks || '0', 10),
      conversions: parseInt(row.conversions || '0', 10),
      revenue: parseFloat(row.revenue || '0')
    };
  });

  return (
    <AffiliatesClient
      initialPartners={partners}
      auditLogs={auditLogs}
      metrics={metricsMap}
    />
  );
}
