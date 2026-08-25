const contract = "momi.communications.explicit-log/v2"
const contractSha256 = "8e96452d206293ccc4382812ddeb2cbc14f78768d22c4e1c736a6b50d71b5b3e"

export function logReleaseResponse(): Response {
  const deploymentId = Deno.env.get("DENO_DEPLOYMENT_ID")?.trim()
  if (!deploymentId || deploymentId.length > 256 ||
    !/^[A-Za-z0-9._:-]+$/u.test(deploymentId)) {
    return new Response(null, { status: 503 })
  }
  return new Response(null, { status: 204, headers: {
    "X-MoMi-Logging-Contract": contract,
    "X-MoMi-Logging-Contract-Sha256": contractSha256,
    "X-MoMi-Backend-Deployment": deploymentId,
  } })
}
