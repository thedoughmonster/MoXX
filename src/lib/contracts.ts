export interface PreorderHealthResponse {
  ok: true;
  service: 'preorder';
  version: string;
  release: string;
}

export interface PreorderContractError {
  ok: false;
  reason: string;
  status: number;
}

export type PreorderHealthEnvelope = PreorderHealthResponse | PreorderContractError;
