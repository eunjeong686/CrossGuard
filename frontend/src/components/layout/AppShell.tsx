import type { ReactNode } from 'react';

type AppShellProps = {
  children: ReactNode;
  largeText: boolean;
};

export function AppShell({ children, largeText }: AppShellProps) {
  return <div className={`app-shell${largeText ? ' large-text' : ''}`}>{children}</div>;
}
