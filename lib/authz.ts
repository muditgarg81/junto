import { getCurrentUser } from './auth';
import { query } from './db';
import { User, Member } from './types';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

export async function authorizeTripAccess(
  tripId: string,
  opts?: { role?: 'organizer' }
): Promise<{ user: User; member: Member }> {
  const user = await getCurrentUser();
  if (!user) {
    throw new HttpError(401, 'Unauthorized: Access token signature required.');
  }

  // Look up membership in PostgreSQL database
  const memberRes = await query(
    'SELECT * FROM members WHERE trip_id = $1 AND user_id = $2',
    [tripId, user.id]
  );

  if (memberRes.rows.length === 0) {
    throw new HttpError(404, 'Not Found: You are not a member of this trip.');
  }

  const member: Member = memberRes.rows[0];

  // Verify Organizer status if requested
  if (opts?.role) {
    const roles = member.roles || [];
    if (!roles.includes(opts.role)) {
      throw new HttpError(403, 'Forbidden: Organizer privileges required.');
    }
  }

  return { user, member };
}
