CREATE TABLE cloudlane.mfa_factors (
  user_id uuid PRIMARY KEY REFERENCES cloudlane.users(id) ON DELETE RESTRICT,
  installation_id uuid NOT NULL REFERENCES cloudlane.installations(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'enrollment_required' CHECK (state IN ('enrollment_required', 'pending_ack', 'active')),
  encrypted_seed bytea,
  seed_nonce bytea CHECK (seed_nonce IS NULL OR octet_length(seed_nonce) = 12),
  seed_tag bytea CHECK (seed_tag IS NULL OR octet_length(seed_tag) = 16),
  pending_challenge_id uuid,
  pending_expires_at timestamptz,
  last_used_step bigint NOT NULL DEFAULT -1,
  auth_epoch bigint NOT NULL DEFAULT 1 CHECK (auth_epoch > 0),
  recovery_generation bigint NOT NULL DEFAULT 0 CHECK (recovery_generation >= 0),
  acknowledged_at timestamptz,
  CHECK ((encrypted_seed IS NULL AND seed_nonce IS NULL AND seed_tag IS NULL) OR
    (encrypted_seed IS NOT NULL AND octet_length(encrypted_seed) = 20 AND seed_nonce IS NOT NULL AND seed_tag IS NOT NULL)),
  FOREIGN KEY (installation_id, user_id) REFERENCES cloudlane.users(installation_id, id) ON DELETE RESTRICT
);
CREATE TABLE cloudlane.auth_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES cloudlane.mfa_factors(user_id) ON DELETE RESTRICT,
  workspace_id uuid NOT NULL,
  verifier_hash bytea NOT NULL UNIQUE CHECK (octet_length(verifier_hash) = 32),
  csrf_token bytea NOT NULL CHECK (octet_length(csrf_token) = 32),
  password_fingerprint bytea NOT NULL CHECK (octet_length(password_fingerprint) = 32),
  prior_session_hash bytea,
  factor_epoch bigint NOT NULL,
  stage text NOT NULL CHECK (stage IN ('mfa_setup_required', 'mfa_required', 'recovery_codes_required')),
  recovery_generation bigint,
  proof_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp() + interval '5 minutes',
  consumed_at timestamptz,
  revoked_at timestamptz,
  FOREIGN KEY (workspace_id, user_id) REFERENCES cloudlane.workspaces(id, owner_user_id) ON DELETE RESTRICT,
  CHECK (expires_at > created_at)
);
CREATE INDEX auth_challenges_user ON cloudlane.auth_challenges (user_id, created_at);
CREATE TABLE cloudlane.mfa_recovery_codes (
  user_id uuid NOT NULL REFERENCES cloudlane.mfa_factors(user_id) ON DELETE RESTRICT,
  generation bigint NOT NULL,
  verifier_hash bytea NOT NULL CHECK (octet_length(verifier_hash) = 32),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  consumed_at timestamptz,
  PRIMARY KEY (user_id, generation, verifier_hash)
);
ALTER TABLE cloudlane.sessions
  ADD COLUMN mfa_epoch bigint,
  ADD COLUMN mfa_verified_at timestamptz,
  ADD COLUMN authentication_method text CHECK (authentication_method IN ('totp', 'recovery'));
ALTER TABLE cloudlane.auth_audit DROP CONSTRAINT auth_audit_action_check;
ALTER TABLE cloudlane.auth_audit ADD CONSTRAINT auth_audit_action_check CHECK
  (action IN ('claim','owner','login','rotate','logout','mfa_enroll','mfa_verify','recovery_use','recovery_ack','recovery_regenerate'));
ALTER TABLE cloudlane.auth_rate_limits DROP CONSTRAINT auth_rate_limits_purpose_check;
ALTER TABLE cloudlane.auth_rate_limits ADD CONSTRAINT auth_rate_limits_purpose_check CHECK (purpose IN ('claim','owner','login','rotate','mfa','recovery'));
REVOKE ALL ON ALL TABLES IN SCHEMA cloudlane FROM PUBLIC;
