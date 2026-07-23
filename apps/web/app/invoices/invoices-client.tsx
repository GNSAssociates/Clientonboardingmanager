'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

export default function InvoicesClient({ serviceUrl }: { serviceUrl: string }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => {
        if (!r.ok) { router.push('/login'); return null; }
        return r.json();
      })
      .then((d) => { if (d) setUser(d); })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  const invoiceUrl = serviceUrl || null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-[1920px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors mr-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <Image src="/logos/gns.png" alt="GNS" width={28} height={28} className="object-contain" />
            <div>
              <p className="text-sm font-bold text-gray-900">Invoice Summarizer</p>
              <p className="text-[10px] text-gray-400">AI-Powered Extraction</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{user?.displayName}</span>
            <Link href="/dashboard" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      {invoiceUrl ? (
        <iframe
          ref={iframeRef}
          src={invoiceUrl}
          className="flex-1 w-full border-0"
          style={{ minHeight: 'calc(100vh - 56px)' }}
          title="Invoice Summarizer"
        />
      ) : (
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-lg text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200/50">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Invoice Summarizer</h2>
            <p className="text-gray-500 mb-6">
              The Invoice Summarizer service needs to be configured. Set the <code className="px-1.5 py-0.5 rounded bg-gray-100 text-sm font-mono">NEXT_PUBLIC_INVOICE_SERVICE_URL</code> environment variable to point to your Invoice Summarizer instance.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left">
              <p className="text-xs font-semibold text-gray-500 mb-2">Example:</p>
              <code className="text-sm text-gray-700 font-mono">
                NEXT_PUBLIC_INVOICE_SERVICE_URL=https://invoice.gnsassociates.co.uk
              </code>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </main>
      )}
    </div>
  );
}
