# Externally owned Edge Functions

These manifests declare active Edge Functions that another repository owns but
hosts in MoMi's shared development Supabase project. They make each function
required hosted inventory and bind its repository, service, caller state,
deployment workflow, source revision, adapter path, and JWT posture.
Authority expires on `valid_until`; renewal requires re-verifying owner,
lifecycle, caller state, hosting workflow/project, and source revision.

This repository may inventory these functions. It may not build, select,
deploy, probe, retire, or delete them. A missing function or mismatched hosted
attestation fails parity. Retirement manifests remain temporary authorization
for backend-owned removal and are not an external-ownership substitute.
