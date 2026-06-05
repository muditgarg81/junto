'use strict';

import { query } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { authorizeTripAccess, HttpError } from '@/lib/authz';
import { verifyCsrf } from '@/lib/csrf';

interface RouteParams {
  params: Promise<{ tripId: string }>;
}

// POST: Create a new checklist item
export async function POST(req: NextRequest, { params }: RouteParams) {
  if (!verifyCsrf(req)) {
    return NextResponse.json({ error: 'CSRF validation failed.' }, { status: 403 });
  }
  const { tripId } = await params;
  try {
    // 1. Authorize session member access
    const { member } = await authorizeTripAccess(tripId);

    const body = await req.json();
    const { label, category, perPerson } = body;

    if (!label) {
      return NextResponse.json({ error: 'Label is required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    
    // P0.3: Enforce assigned_to = member.id from authenticated session
    const result = await query(
      `INSERT INTO checklist_items (id, trip_id, label, category, assigned_to, per_person, done)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING *`,
      [id, tripId, label, category || 'personal', member.id, perPerson || false]
    );

    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error creating checklist item:', err);
    if (err instanceof HttpError || err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Update checklist item (toggle done, assign, rename)
export async function PUT(req: NextRequest, { params }: RouteParams) {
  if (!verifyCsrf(req)) {
    return NextResponse.json({ error: 'CSRF validation failed.' }, { status: 403 });
  }
  const { tripId } = await params;
  try {
    // 1. Authorize session member access
    const { member } = await authorizeTripAccess(tripId);

    const body = await req.json();
    const { id, label, category, perPerson, done } = body;

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    // 2. Check if the item belongs to the trip (fixes Gap C IDOR) and verify authorization
    const checkRes = await query(
      'SELECT category, assigned_to FROM checklist_items WHERE id = $1 AND trip_id = $2',
      [id, tripId]
    );
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Item not found in this trip' }, { status: 404 });
    }
    const existingItem = checkRes.rows[0];
    if (existingItem.category === 'personal' && existingItem.assigned_to !== member.id) {
      return NextResponse.json({ error: 'Unauthorized: Personal item belongs to another member' }, { status: 403 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (label !== undefined) {
      updates.push(`label = $${paramIndex++}`);
      values.push(label);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(category);
    }
    
    // Enforce that we do not let arbitrary assignment bypasses (keep or assign to session member)
    // If updating, we keep the assignment or assign to active member if requested
    if (body.assignedTo !== undefined) {
      updates.push(`assigned_to = $${paramIndex++}`);
      // Force it to assign to session member or null
      values.push(body.assignedTo ? member.id : null);
    }
    
    if (perPerson !== undefined) {
      updates.push(`per_person = $${paramIndex++}`);
      values.push(perPerson);
    }
    if (done !== undefined) {
      updates.push(`done = $${paramIndex++}`);
      values.push(done);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    const queryText = `
      UPDATE checklist_items 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(queryText, values);
    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error updating checklist item:', err);
    if (err instanceof HttpError || err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Delete checklist item
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  if (!verifyCsrf(req)) {
    return NextResponse.json({ error: 'CSRF validation failed.' }, { status: 403 });
  }
  const { tripId } = await params;
  try {
    // 1. Authorize session member access
    const { member } = await authorizeTripAccess(tripId);

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    // Check if the item belongs to the trip and verify authorization
    const checkRes = await query(
      'SELECT category, assigned_to FROM checklist_items WHERE id = $1 AND trip_id = $2',
      [id, tripId]
    );
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Item not found in this trip' }, { status: 404 });
    }
    const existingItem = checkRes.rows[0];
    if (existingItem.category === 'personal' && existingItem.assigned_to !== member.id) {
      return NextResponse.json({ error: 'Unauthorized: Personal item belongs to another member' }, { status: 403 });
    }

    const result = await query(
      'DELETE FROM checklist_items WHERE id = $1 AND trip_id = $2 RETURNING id',
      [id, tripId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Item not found in this trip' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error('Error deleting checklist item:', err);
    if (err instanceof HttpError || err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
