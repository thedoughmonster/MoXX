import { useEffect, useState } from 'react';
import { queryPreorderHealth } from './lib/api';
import { releaseIdentity, runningStage, preorderApiVersion, apiOrigin } from './lib/config';
import { type PreorderHealthResponse } from './lib/contracts';
import { captureError } from './lib/sentry';

type HealthState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; payload: PreorderHealthResponse }
  | { status: 'error'; message: string };

export function App() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });

  useEffect(() => {
    void queryPreorderHealth()
      .then((payload) => setHealth({ status: 'ready', payload }))
      .catch((error) => {
        setHealth({
          status: 'error',
          message: error instanceof Error ? error.message : 'unknown'
        });
        void captureError(error, { level: 'error', source: 'health-check' });
      });
  }, []);

  return (
    <main className="app">
      <header className="card">
        <h1>Preorder foundation</h1>
        <p>Release: {releaseIdentity}</p>
        <p>Stage: {runningStage}</p>
        <p>Function version: {preorderApiVersion}</p>
        <p>API origin: {apiOrigin}</p>
      </header>

      <section className="card">
        <h2>Edge function smoke</h2>
        {health.status === 'loading' && <p>Checking edge health...</p>}
        {health.status === 'ready' && (
          <pre>{JSON.stringify(health.payload, null, 2)}</pre>
        )}
        {health.status === 'error' && (
          <p role="alert">Health check failed: {health.message}</p>
        )}
      </section>
    </main>
  );
}
