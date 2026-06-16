'use client';

import React, { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

export default function GlobalErrorBoundary({ error, unstable_retry }: ErrorProps) {
  useEffect(() => {
    console.error('Captured by global error boundary:', error);
  }, [error]);

  return (
    <html>
      <body className="bg-[#fffbeb] text-[#92400e] min-h-screen p-6 flex flex-col justify-between max-w-md mx-auto border-x border-[#f59e0b]/20 shadow-sm font-sans">
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold font-display text-[#991b1b]">Global Application Error</h2>
            <p className="text-sm text-[#78350f]">
              A critical layout or system error occurred. Below are the details to share with the developer:
            </p>
          </div>

          <div className="bg-white border border-[#f59e0b]/30 rounded-xl p-4 space-y-3 shadow-xs">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#78350f]/60">Error Message</span>
              <span className="text-sm font-mono break-words">{error.message || 'No message provided'}</span>
            </div>

            {error.digest && (
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#78350f]/60">Error Digest</span>
                <span className="text-xs font-mono break-words">{error.digest}</span>
              </div>
            )}

            {error.stack && (
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#78350f]/60">Stack Trace</span>
                <pre className="text-[11px] font-mono whitespace-pre-wrap overflow-x-auto max-h-40 bg-[#fbfbfb] p-2 rounded border border-[#000]/5 mt-1">
                  {error.stack}
                </pre>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 pt-6">
          <button
            onClick={() => unstable_retry()}
            className="w-full bg-[#1f4d3f] hover:bg-[#15342a] text-[#fff] font-semibold py-3 px-6 rounded-xl transition duration-200"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full border border-[#1f4d3f]/30 text-[#1f4d3f] hover:bg-[#1f4d3f]/5 font-semibold py-3 px-6 rounded-xl transition duration-200"
          >
            Go to Landing Page
          </button>
        </div>
      </body>
    </html>
  );
}
