// Deterministic env for tests that touch env-dependent code (JWT, cookies…).
process.env.JWT_SECRET ||= "test-secret-test-secret-test-secret-1234567890";
process.env.JWT_ISSUER ||= "framelink-test";
process.env.SESSION_COOKIE_NAME ||= "framelink_session";
process.env.GALLERY_COOKIE_PREFIX ||= "framelink_gallery_";
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "service-role-key-service-role-key";
process.env.SUPABASE_STORAGE_BUCKET ||= "event-photos";
process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/framelink_test";
process.env.NEXT_PUBLIC_APP_URL ||= "http://localhost:3000";
