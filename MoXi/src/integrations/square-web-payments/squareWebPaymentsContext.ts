import { createContext, useContext } from 'react';
import type { SquareSandboxConfigResult } from './types';

const unavailableConfig: SquareSandboxConfigResult = {
  status: 'unavailable',
  reason: 'configuration_missing'
};

export const SquareSandboxConfigContext = createContext<SquareSandboxConfigResult>(
  unavailableConfig
);

export function useSquareSandboxConfig(): SquareSandboxConfigResult {
  return useContext(SquareSandboxConfigContext);
}
