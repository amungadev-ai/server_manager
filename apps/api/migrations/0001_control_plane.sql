-- Append-only release migration. Do not edit after it has been applied.
-- No demo data, default owner, plaintext credential or public registration.

CREATE TABLE cloudlane.installations (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  state text NOT NULL DEFAULT 'unclaimed'
    CHECK (state IN ('unclaimed', 'setup_pending', 'active', 'maintenance')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (singleton, id)
);
INSERT INTO cloudlane.installations (singleton) VALUES (true);

CREATE TABLE cloudlane.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid NOT NULL REFERENCES cloudlane.installations(id) ON DELETE RESTRICT,
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254 AND email = btrim(email)),
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80),
  password_hash text NOT NULL CHECK (char_length(password_hash) BETWEEN 32 AND 1024),
  role text NOT NULL DEFAULT 'owner' CHECK (role = 'owner'),
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (installation_id, id),
  UNIQUE (installation_id, role)
);
CREATE UNIQUE INDEX users_email_normalized ON cloudlane.users (lower(email));

CREATE TABLE cloudlane.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid NOT NULL REFERENCES cloudlane.installations(id) ON DELETE RESTRICT,
  owner_user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (installation_id, owner_user_id)
    REFERENCES cloudlane.users(installation_id, id) ON DELETE RESTRICT,
  UNIQUE (installation_id, id),
  UNIQUE (id, owner_user_id)
);

CREATE TABLE cloudlane.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  idle_expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  FOREIGN KEY (workspace_id, user_id)
    REFERENCES cloudlane.workspaces(id, owner_user_id) ON DELETE CASCADE,
  CHECK (created_at <= last_seen_at AND last_seen_at < idle_expires_at),
  CHECK (idle_expires_at <= absolute_expires_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE INDEX sessions_user_active ON cloudlane.sessions (user_id, absolute_expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX sessions_expiry ON cloudlane.sessions (absolute_expires_at);

CREATE TABLE cloudlane.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES cloudlane.workspaces(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  slug text NOT NULL CHECK (char_length(slug) BETWEEN 1 AND 63
    AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 240),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (workspace_id, slug),
  UNIQUE (workspace_id, id)
);

CREATE TABLE cloudlane.environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'production' CHECK (name = 'production'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (workspace_id, project_id)
    REFERENCES cloudlane.projects(workspace_id, id) ON DELETE RESTRICT,
  UNIQUE (project_id, name)
);

REVOKE ALL ON SCHEMA cloudlane FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA cloudlane FROM PUBLIC;
