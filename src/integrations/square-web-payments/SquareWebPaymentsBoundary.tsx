import {
  useMemo,
  type ReactNode
} from 'react';
import { readSquareSandboxConfig } from './readSandboxConfig';
import { SquareSandboxConfigContext } from './squareWebPaymentsContext';

export function SquareWebPaymentsBoundary({
  children,
  environment = import.meta.env
}: Readonly<{
  children: ReactNode;
  environment?: Readonly<Record<string, unknown>>;
}>) {
  const config = useMemo(
    () => readSquareSandboxConfig(environment),
    [environment]
  );

  return (
    <SquareSandboxConfigContext.Provider value={config}>
      {children}
    </SquareSandboxConfigContext.Provider>
  );
}
