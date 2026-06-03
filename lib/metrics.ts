'use strict';

import { query } from './db';

export interface TripMetrics {
  totalRevenue: number;
  upgradeRevenue: number;
  affiliateRevenue: number;
  totalAiCost: number;
  totalAiCalls: number;
  netMargin: number;
  offersShown: number;
  offersClicked: number;
  offersConverted: number;
  clickRatio: number;
  conversionRatio: number;
}

// Token pricing (Gemini 2.5 Flash)
// Input: $0.075 / 1M tokens ($0.000000075 / token)
// Output: $0.30 / 1M tokens ($0.000000300 / token)
// Exchange Rate: 1 USD = 83 INR
const INPUT_PRICE_INR = 0.000000075 * 83;
const OUTPUT_PRICE_INR = 0.000000300 * 83;

/**
 * Log token usage for an AI message call.
 */
export async function logAiCallMetrics(messageId: string, inputTokens: number, outputTokens: number) {
  try {
    const costInr = (inputTokens * INPUT_PRICE_INR) + (outputTokens * OUTPUT_PRICE_INR);
    
    // Fetch current message metadata
    const msgRes = await query('SELECT metadata FROM messages WHERE id = $1', [messageId]);
    if (msgRes.rows.length === 0) return;
    
    const currentMeta = msgRes.rows[0].metadata || {};
    const updatedMeta = {
      ...currentMeta,
      ai_tokens: {
        input: inputTokens,
        output: outputTokens,
        cost_inr: Math.round(costInr * 10000) / 10000 // precision
      }
    };

    await query(
      'UPDATE messages SET metadata = $1 WHERE id = $2',
      [JSON.stringify(updatedMeta), messageId]
    );

    console.log(`Metrics: Logged AI call cost for msg ${messageId}. Cost: ₹${costInr.toFixed(4)}`);
  } catch (err) {
    console.error('Failed to log AI call metrics:', err);
  }
}

/**
 * Compiles the economics of a trip.
 */
export async function getTripMetrics(tripId: string): Promise<TripMetrics> {
  try {
    // 1. Tally Upgrade Revenue (Active Upgrades)
    const upgradesRes = await query(
      "SELECT SUM(amount) as total FROM trip_upgrades WHERE trip_id = $1 AND status = 'active'",
      [tripId]
    );
    const upgradeRevenue = Number(upgradesRes.rows[0]?.total || 0);

    // 2. Tally Affiliate Commission Revenue (Conversions)
    const conversionsRes = await query(
      `SELECT SUM(c.commission) as total 
       FROM conversions c
       JOIN offers o ON c.offer_id = o.id
       WHERE o.trip_id = $1`,
      [tripId]
    );
    const affiliateRevenue = Number(conversionsRes.rows[0]?.total || 0);

    const totalRevenue = upgradeRevenue + affiliateRevenue;

    // 3. Tally AI Token Costs
    const messagesRes = await query(
      "SELECT metadata FROM messages WHERE trip_id = $1 AND is_ai = true AND metadata IS NOT NULL",
      [tripId]
    );
    
    let totalAiCost = 0;
    let totalAiCalls = 0;

    messagesRes.rows.forEach((row) => {
      const meta = row.metadata;
      if (meta && meta.ai_tokens) {
        totalAiCost += Number(meta.ai_tokens.cost_inr || 0);
        totalAiCalls++;
      }
    });

    // 4. Calculate Offers Funnel
    const shownRes = await query("SELECT COUNT(1) as total FROM offers WHERE trip_id = $1", [tripId]);
    const clickedRes = await query(
      "SELECT COUNT(1) as total FROM offers WHERE trip_id = $1 AND status IN ('clicked', 'converted')",
      [tripId]
    );
    const convertedRes = await query(
      "SELECT COUNT(1) as total FROM offers WHERE trip_id = $1 AND status = 'converted'",
      [tripId]
    );

    const offersShown = parseInt(shownRes.rows[0]?.total || '0', 10);
    const offersClicked = parseInt(clickedRes.rows[0]?.total || '0', 10);
    const offersConverted = parseInt(convertedRes.rows[0]?.total || '0', 10);

    const clickRatio = offersShown > 0 ? (offersClicked / offersShown) * 100 : 0;
    const conversionRatio = offersClicked > 0 ? (offersConverted / offersClicked) * 100 : 0;

    const netMargin = totalRevenue - totalAiCost;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      upgradeRevenue: Math.round(upgradeRevenue * 100) / 100,
      affiliateRevenue: Math.round(affiliateRevenue * 100) / 100,
      totalAiCost: Math.round(totalAiCost * 100) / 100,
      totalAiCalls,
      netMargin: Math.round(netMargin * 100) / 100,
      offersShown,
      offersClicked,
      offersConverted,
      clickRatio: Math.round(clickRatio * 10) / 10,
      conversionRatio: Math.round(conversionRatio * 10) / 10
    };

  } catch (err) {
    console.error('Failed to get trip metrics:', err);
    return {
      totalRevenue: 0,
      upgradeRevenue: 0,
      affiliateRevenue: 0,
      totalAiCost: 0,
      totalAiCalls: 0,
      netMargin: 0,
      offersShown: 0,
      offersClicked: 0,
      offersConverted: 0,
      clickRatio: 0,
      conversionRatio: 0
    };
  }
}
