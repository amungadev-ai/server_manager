-- Project metadata only. No job, service or infrastructure provisioning.
CREATE TABLE cloudlane.project_create_requests (
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  retry_key uuid NOT NULL,
  request_hash bytea NOT NULL CHECK (octet_length(request_hash) = 32),
  project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (workspace_id, user_id, retry_key),
  FOREIGN KEY (workspace_id, user_id) REFERENCES cloudlane.workspaces(id, owner_user_id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, project_id) REFERENCES cloudlane.projects(workspace_id, id) ON DELETE RESTRICT
);
CREATE TABLE cloudlane.project_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  request_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('created','replayed')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (workspace_id, user_id) REFERENCES cloudlane.workspaces(id, owner_user_id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, project_id) REFERENCES cloudlane.projects(workspace_id, id) ON DELETE RESTRICT
);
CREATE INDEX projects_workspace_page ON cloudlane.projects (workspace_id, created_at, id);
REVOKE ALL ON ALL TABLES IN SCHEMA cloudlane FROM PUBLIC;
