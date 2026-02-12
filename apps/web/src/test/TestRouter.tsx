import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

interface TestRouterProps {
  children: ReactNode;
}

export function TestRouter({ children }: TestRouterProps) {
  return (
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {children}
    </MemoryRouter>
  );
}
