import { Suspense } from 'react';
import AuthorizationContent from './_AuthorizationContent';

export const dynamic = 'force-dynamic';

export default function AuthorizationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">
        Loading Authorization Letter...
      </div>
    }>
      <AuthorizationContent />
    </Suspense>
  );
}