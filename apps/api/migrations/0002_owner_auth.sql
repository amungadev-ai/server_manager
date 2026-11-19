-- Isolated owner-auth review profile. No credential or default owner is seeded.
CREATE TABLE cloudlane.bootstrap_claims (
  installation_id uuid PRIMARY KEY REFERENCES cloudlane.installations(id) ON DELETE RESTRICT,
  generation bigint NOT NULL CHECK (generation > 0),
  verifier_hash bytea NOT NULL UNIQUE CHECK (octet_length(verifier_hash) = 32),
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  CHECK (expires_at > issued_at)
);
CREATE TABLE cloudlane.bootstrap_setups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid NOT NULL REFERENCES cloudlane.installations(id) ON DELETE RESTRICT,
  generation bigint NOT NULL CHECK (generation > 0),
  verifier_hash bytea NOT NULL UNIQUE CHECK (octet_length(verifier_hash) = 32),
  csrf_token bytea NOT NULL CHECK (octet_length(csrf_token) = 32),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX bootstrap_setups_install ON cloudlane.bootstrap_setups (installation_id);
CREATE TABLE cloudlane.session_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz,
  FOREIGN KEY (workspace_id, user_id) REFERENCES cloudlane.workspaces(id, owner_user_id) ON DELETE CASCADE,
  UNIQUE (id, user_id, workspace_id)
);
ALTER TABLE cloudlane.sessions
  ADD COLUMN family_id uuid,
  ADD COLUMN csrf_token bytea CHECK (csrf_token IS NULL OR octet_length(csrf_token) = 32),
  ADD COLUMN revocation_reason text CHECK (revocation_reason IN ('rotated', 'logout', 'login', 'limit')),
  ADD FOREIGN KEY (family_id, user_id, workspace_id)
    REFERENCES cloudlane.session_families(id, user_id, workspace_id) ON DELETE CASCADE;
CREATE INDEX sessions_family ON cloudlane.sessions (family_id);
CREATE TABLE cloudlane.auth_rate_limits (
  purpose text NOT NULL CHECK (purpose IN ('claim', 'owner', 'login', 'rotate')),
  key_hash bytea NOT NULL CHECK (octet_length(key_hash) = 32),
  attempts integer NOT NULL CHECK (attempts > 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (purpose, key_hash)
);
CREATE INDEX auth_rate_expiry ON cloudlane.auth_rate_limits (expires_at);
CREATE TABLE cloudlane.auth_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid NOT NULL REFERENCES cloudlane.installations(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES cloudlane.users(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('claim', 'owner', 'login', 'rotate', 'logout')),
  outcome text NOT NULL CHECK (outcome IN ('allowed', 'denied')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON ALL TABLES IN SCHEMA cloudlane FROM PUBLIC;
