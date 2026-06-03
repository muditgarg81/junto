'use server';

import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

/**
 * Helper to enforce that only the operator can invoke these actions.
 */
async function enforceOperator() {
  const user = await getCurrentUser();
  if (!user || user.auth_id !== 'default-mudit-garg') {
    throw new Error('Unauthorized: Operator privilege required.');
  }
  return user;
}

/**
 * Creates or updates an affiliate partner.
 */
export async function savePartnerAction(prevState: any, formData: FormData) {
  try {
    const user = await enforceOperator();

    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const category = formData.get('category') as string;
    const network = formData.get('network') as string;
    const affiliateId = formData.get('affiliateId') as string;
    const secret = formData.get('secret') as string;
    const linkTemplate = formData.get('linkTemplate') as string;
    const subParam = formData.get('subParam') as string;
    const commissionEstimate = parseFloat(formData.get('commissionEstimate') as string || '0');
    const priority = parseInt(formData.get('priority') as string || '0', 10);
    const status = formData.get('status') as string === 'active' ? 'active' : 'inactive';
    
    // Parse surface triggers from multi-select (represented as comma-separated or separate entries)
    const surfaceTriggersVal = formData.get('surfaceTriggers') as string || '';
    const surfaceTriggers = surfaceTriggersVal
      .split(',')
      .map(t => t.trim())
      .filter(t => t !== '');

    if (!name || !category || !network || !linkTemplate || !subParam) {
      return { error: 'Missing required partner fields.' };
    }

    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    if (id) {
      // 1. UPDATE existing partner
      const secretRef = secret && secret.trim() !== '' ? `vault-key-${key}` : null;
      
      const updateRes = await query(
        `UPDATE partners
         SET name = $1,
             category = $2,
             network = $3,
             status = $4,
             affiliate_id = $5,
             secret_ref = COALESCE($6, secret_ref),
             link_template = $7,
             sub_param = $8,
             commission_estimate = $9,
             priority = $10,
             surface_triggers = $11,
             updated_by = $12,
             updated_at = NOW()
         WHERE id = $13
         RETURNING *`,
        [
          name.trim(),
          category,
          network.trim(),
          status,
          affiliateId.trim(),
          secretRef,
          linkTemplate.trim(),
          subParam.trim(),
          commissionEstimate,
          priority,
          surfaceTriggers,
          user.id,
          id
        ]
      );

      if (updateRes.rowCount === 0) {
        return { error: 'Partner not found.' };
      }

      const partner = updateRes.rows[0];

      // 2. Log in Audit Log
      await query(
        `INSERT INTO audit_logs (id, user_id, action, target_type, target_id, changes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          crypto.randomUUID(),
          user.id,
          'edit_partner',
          'partner',
          id,
          JSON.stringify({ name: partner.name, category: partner.category, status: partner.status })
        ]
      );

    } else {
      // 1. INSERT new partner
      const newId = crypto.randomUUID();
      const secretRef = secret && secret.trim() !== '' ? `vault-key-${key}` : null;

      await query(
        `INSERT INTO partners (id, key, name, category, network, status, affiliate_id, secret_ref, link_template, sub_param, commission_estimate, priority, surface_triggers, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          newId,
          key,
          name.trim(),
          category,
          network.trim(),
          status,
          affiliateId.trim(),
          secretRef,
          linkTemplate.trim(),
          subParam.trim(),
          commissionEstimate,
          priority,
          surfaceTriggers,
          user.id
        ]
      );

      // 2. Log in Audit Log
      await query(
        `INSERT INTO audit_logs (id, user_id, action, target_type, target_id, changes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          crypto.randomUUID(),
          user.id,
          'create_partner',
          'partner',
          newId,
          JSON.stringify({ name, category, status })
        ]
      );
    }

    revalidatePath('/admin/affiliates');
    return { success: true };
  } catch (err: any) {
    console.error('savePartnerAction failed:', err);
    return { error: err.message || 'Server error' };
  }
}

/**
 * Toggles a partner's active status.
 */
export async function togglePartnerStatusAction(partnerId: string, status: 'active' | 'inactive') {
  try {
    const user = await enforceOperator();

    const updateRes = await query(
      `UPDATE partners 
       SET status = $1, updated_by = $2, updated_at = NOW() 
       WHERE id = $3 
       RETURNING name`,
      [status, user.id, partnerId]
    );

    if (updateRes.rowCount === 0) {
      throw new Error('Partner not found');
    }

    const partnerName = updateRes.rows[0].name;

    // Log in Audit Log
    await query(
      `INSERT INTO audit_logs (id, user_id, action, target_type, target_id, changes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        crypto.randomUUID(),
        user.id,
        status === 'active' ? 'enable_partner' : 'disable_partner',
        'partner',
        partnerId,
        JSON.stringify({ name: partnerName, status })
      ]
    );

    revalidatePath('/admin/affiliates');
    return { success: true };
  } catch (err: any) {
    console.error('togglePartnerStatusAction failed:', err);
    throw err;
  }
}

/**
 * Deletes a partner.
 */
export async function deletePartnerAction(partnerId: string) {
  try {
    const user = await enforceOperator();

    // Retrieve name before deleting for audit logging
    const checkRes = await query('SELECT name FROM partners WHERE id = $1', [partnerId]);
    if (checkRes.rows.length === 0) {
      throw new Error('Partner not found');
    }
    const partnerName = checkRes.rows[0].name;

    await query('DELETE FROM partners WHERE id = $1', [partnerId]);

    // Log in Audit Log
    await query(
      `INSERT INTO audit_logs (id, user_id, action, target_type, target_id, changes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        crypto.randomUUID(),
        user.id,
        'delete_partner',
        'partner',
        partnerId,
        JSON.stringify({ name: partnerName })
      ]
    );

    revalidatePath('/admin/affiliates');
    return { success: true };
  } catch (err: any) {
    console.error('deletePartnerAction failed:', err);
    throw err;
  }
}
