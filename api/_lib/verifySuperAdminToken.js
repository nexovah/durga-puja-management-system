// Verifies the super-admin JWT super_admin_login() signs in Postgres
// (see supabase/022_super_admin.sql) — same secret, same HS256
// algorithm, but carries an `is_super_admin: true` claim instead of a
// tenant_id.
import jwt from 'jsonwebtoken';

export function verifySuperAdminToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing bearer token');
  }
  const token = authHeader.slice('Bearer '.length);
  const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET, { algorithms: ['HS256'] });
  if (payload.is_super_admin !== true) {
    throw new Error('Token is not a super admin token');
  }
  return { adminId: payload.sub };
}
