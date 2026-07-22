import { Suspense } from 'react';

export const metadata = {
  title: 'Sign in — GNS Compliance Manager',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>;
}
