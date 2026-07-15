# Toast Data Acquisition

## ELI5

MoMi keeps a list of approved Toast questions. This service takes one saved
question, asks Toast for one page, files the complete answer, and either marks
the question done or leaves a safe bookmark for the next page.

## Purpose

This service is the generic, allowlisted Toast hydration boundary. It acquires
configured resources for durable jobs, preserves request history and raw source
responses, and records immutable resource versions plus observations.

## Owned Function

`toast-data-acquisition-v1` claims one `toast_acquisition.jobs` row. It never
acts as a caller-directed proxy: method, host, path, and accepted parameters are
loaded from the enabled acquisition registry.

## Contracts

The service provides `toast.data.acquisition.v1`. A POST contains only a job ID
and its capability token. Identical source content reuses its immutable version
while each retrieval creates a new observation.

## Authority

The service may authenticate with the configured Toast source and issue the
registered GET. It may write acquisition state and `toast_raw` archive records;
it may not project data, make decisions, or call another service.

## Verification

Run `npm run check -- --service toast-data-acquisition` with Node.js 24.
