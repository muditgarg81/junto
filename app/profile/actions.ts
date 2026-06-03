'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('junto_user_id');
  cookieStore.delete('junto_auth_session');
  cookieStore.delete('junto_has_profile');
  
  // Clear any dynamic trip member cookies
  const allCookies = cookieStore.getAll();
  allCookies.forEach((cookie) => {
    if (cookie.name.startsWith('junto_member_')) {
      cookieStore.delete(cookie.name);
    }
  });

  redirect('/signin');
}
