import React from 'react';
import SignInForm from './SignInForm';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SignInPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const redirectPath = (resolvedSearchParams.redirect as string) || '/home';

  return (
    <SignInForm redirectPath={redirectPath} />
  );
}
