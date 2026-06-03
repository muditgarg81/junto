import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, upiId, homeCurrency, photoUrl } = body;

    const user = await getCurrentUser(true);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const result = await query(
      `UPDATE users 
       SET name = $1, 
           email = $2, 
           phone = $3, 
           upi_id = $4, 
           home_currency = $5, 
           photo_url = $6
       WHERE id = $7
       RETURNING *`,
      [name, email, phone || '', upiId || '', homeCurrency || 'INR', photoUrl || '', user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Also update associated member records upi_id for any active trips!
    console.log("Syncing global profile edits to trip member records...");
    await query(
      `UPDATE members 
       SET upi_id = $1 
       WHERE user_id = $2 OR auth_id = $3`,
      [upiId || null, user.id, user.auth_id]
    );

    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error updating user profile:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
