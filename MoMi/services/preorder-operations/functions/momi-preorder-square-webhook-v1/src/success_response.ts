export function successResponse(disposition: string): Response {
  return Response.json({ ok: true, disposition })
}
