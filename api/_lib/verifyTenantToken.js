// Verifies the same per-tenant JWT login() signs in Postgres (see
// supabase/020_multi_tenant.sql's jwt_sign()) — same secret, same HS256
// algorithm — so a serverless route can trust the tenant_id it reads off
// the token instead of a client-supplied value that could be spoofed.
import jwt from 'jsonwebtoken';

export function verifyTenantToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing bearer token');
  }
  const token = authHeader.slice('Bearer '.length);
  const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET, { algorithms: ['HS256'] });
  if (!payload.tenant_id) {
    throw new Error('Token has no tenant_id claim');
  }
  return { tenantId: payload.tenant_id, userId: payload.sub };
}
