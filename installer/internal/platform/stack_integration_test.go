//go:build integration

package platform

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"cloudlane.local/installer/internal/plan"
)

func freeReviewPort(t *testing.T) int {
	t.Helper()
	l, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port
}
func livePlan(t *testing.T) (plan.Verified, []byte, []byte, []byte) {
	t.Helper()
	if os.Getenv("CLOUDLANE_INSTALLER_STACK_TESTS") != "1" || os.Geteuid() == 0 {
		t.Fatal("live tests require explicit non-root disposable Docker opt-in")
	}
	b, err := os.ReadFile(os.Getenv("CLOUDLANE_TEST_PLATFORM_PLAN"))
	if err != nil {
		t.Fatal("missing prepared image plan")
	}
	var p plan.Plan
	if json.Unmarshal(b, &p) != nil {
		t.Fatal("invalid image plan")
	}
	pub, key, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	sig := ed25519.Sign(key, append([]byte(plan.Prefix), b...))
	v, err := plan.Verify(b, sig, pub, plan.Digest(pub), p.Version, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	return v, b, sig, pub
}
func cleanLive(t *testing.T, d *Docker, s State, c secrets) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	// Remove only known names after exact namespace ownership checks. Never prune.
	for _, part := range []string{"caddy", "api", "migrate", "db"} {
		var v containerInfo
		found, err := d.inspect(ctx, "container", Name(s, part), &v)
		if err != nil {
			t.Log("cleanup inspect failed")
			continue
		}
		if found {
			if !owned(v.Config.Labels, s, part) {
				t.Error("cleanup refused foreign container")
				continue
			}
			if _, err := d.call(ctx, "container", "rm", "--force", Name(s, part)); err != nil {
				t.Error("owned container cleanup failed")
			}
		}
	}
	for _, part := range []string{"caddy-data", "caddy-config", "data"} {
		found, err := d.volume(ctx, s, part)
		if err != nil {
			t.Error("cleanup refused foreign volume")
			continue
		}
		if found {
			if _, err := d.call(ctx, "volume", "rm", Name(s, part)); err != nil {
				t.Error("owned volume cleanup failed")
			}
		}
	}
	found, err := d.network(ctx, s)
	if err != nil {
		t.Error("cleanup refused foreign network")
	} else if found {
		if _, err := d.call(ctx, "network", "rm", Name(s, "control")); err != nil {
			t.Error("owned network cleanup failed")
		}
	}
}
func liveFailure(t *testing.T, d *Docker, s State, c secrets, err error) {
	t.Helper()
	if err == nil {
		return
	}
	t.Log("stage failure: " + Code(err))
	for _, part := range []string{"db", "migrate", "api", "caddy"} {
		var v containerInfo
		found, _ := d.inspect(context.Background(), "container", Name(s, part), &v)
		if !found || !owned(v.Config.Labels, s, part) {
			continue
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		cmd := exec.CommandContext(ctx, "/usr/bin/docker", "--host=unix:///var/run/docker.sock", "--config="+filepath.Join(d.directory, "docker-client"), "logs", "--tail=18", Name(s, part))
		output, _ := cmd.CombinedOutput()
		cancel()
		if len(output) > 12000 {
			output = output[len(output)-12000:]
		}
		text := string(output)
		for _, secret := range []string{c.admin, c.migrator, c.runtime} {
			text = strings.ReplaceAll(text, secret, "[redacted]")
		}
		t.Log(part + ": " + text)
	}
	t.Fatal("isolated component installation failed")
}
func getLive(t *testing.T, port int, path string) (int, []byte) {
	t.Helper()
	client := &http.Client{Timeout: 5 * time.Second, Transport: &http.Transport{Proxy: nil}, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	defer client.CloseIdleConnections()
	r, err := client.Get("http://127.0.0.1:" + strconv.Itoa(port) + path)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Body.Close()
	b, err := io.ReadAll(io.LimitReader(r.Body, 65537))
	if err != nil || len(b) > 65536 {
		t.Fatal("unbounded panel response")
	}
	return r.StatusCode, b
}

type loseDatabaseAck struct {
	*Docker
	once bool
}

func (d *loseDatabaseAck) Apply(ctx context.Context, step Step, s State, c secrets) error {
	if err := d.Docker.Apply(ctx, step, s, c); err != nil {
		return err
	}
	if step == Database && !d.once {
		d.once = true
		return errors.New("operation_interrupted")
	}
	return nil
}

func TestLiveReviewStack(t *testing.T) {
	v, data, sig, pub := livePlan(t)
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Minute)
	defer cancel()
	work := filepath.Join(t.TempDir(), "installation")
	port := freeReviewPort(t)
	d, _ := NewDocker(work, v)
	e, err := Open(work, v, "install", port, d)
	if err != nil {
		t.Fatal(err)
	}
	state := e.Snapshot()
	creds := e.credentials
	t.Cleanup(func() { e.Close(); cleanLive(t, d, state, creds) })
	// Independent fixture must survive every coordinator operation and cleanup.
	fixtureID, err := d.call(ctx, "network", "create", "--label=com.cloudlane.test.fixture="+state.Instance, "cl-unrelated-"+state.Instance)
	if err != nil {
		t.Fatal(err)
	}
	unrelated := strings.TrimSpace(string(fixtureID))
	t.Cleanup(func() { d.call(context.Background(), "network", "rm", unrelated) })
	var report Report
	t.Run("fresh_real_components_and_identity", func(t *testing.T) {
		report, err = e.Run(ctx, "install", false)
		liveFailure(t, d, e.Snapshot(), creds, err)
		state = e.Snapshot()
		if !report.InternalReady || report.ReadyToClaim || report.State != "awaiting_tls_and_claim" || !uuidRE.MatchString(state.DatabaseIdentity) {
			t.Fatal("incorrect component readiness")
		}
		status, body := getLive(t, port, "/")
		if status != 200 || !strings.Contains(string(body), "<!doctype html>") {
			t.Fatal("static HTTP dashboard was not served")
		}
	})
	if !report.InternalReady {
		return
	}
	t.Run("runtime_role_and_private_auth_boundary", func(t *testing.T) {
		for _, path := range []string{"/setup", "/login", "/recover", "/auth/security", "/api/v1/auth/session", "/api/v1/bootstrap/claim", "/api/v1/bootstrap/owner"} {
			status, _ := getLive(t, port, path)
			if status != 503 {
				t.Fatal("plaintext auth route enabled", path, status)
			}
		}
		status, body := getLive(t, port, "/api/v1/health/ready")
		if status != 503 || !strings.Contains(string(body), `"database":"ready"`) || !strings.Contains(string(body), `"authentication":"unavailable"`) {
			t.Fatal("readiness overstated")
		}
		status, _ = getLive(t, port, "/api/v1/projects")
		if status != 401 && status != 503 {
			t.Fatal("default-deny project access changed", status)
		}
		for _, part := range []string{"db", "migrate", "api", "caddy"} {
			if _, found, err := d.container(ctx, state, part, creds); err != nil || !found {
				t.Fatal("unsafe live container configuration", part, err)
			}
		}
		const probe = `(async()=>{const{Pool}=require('pg');const p=new Pool({connectionString:process.env.CLOUDLANE_DATABASE_URL});const c=await p.connect();try{for(const sql of ["CREATE TABLE cloudlane.forbidden_probe(id integer)","INSERT INTO cloudlane.schema_migrations(id,checksum) VALUES ('9999_forbidden',repeat('0',64))"]){await c.query('BEGIN');let denied=false;try{await c.query(sql)}catch(e){denied=e.code==='42501'}await c.query('ROLLBACK');if(!denied)throw Error('privilege failure')}}finally{c.release();await p.end()}})().catch(()=>process.exitCode=1);`
		if _, err := d.call(ctx, "container", "exec", "--user=10001:10001", Name(state, "api"), "node", "-e", probe); err != nil {
			t.Fatal("runtime role DDL/ledger denial failed")
		}
	})
	e.Close()
	t.Run("idempotent_resume_preserves_database_and_containers", func(t *testing.T) {
		before := map[string]string{}
		for _, part := range []string{"db", "migrate", "api", "caddy"} {
			c, _, _ := d.container(ctx, state, part, creds)
			before[part] = c.ID
		}
		next, err := Open(work, v, "resume", port, d)
		if err != nil {
			t.Fatal(err)
		}
		defer next.Close()
		r, err := next.Run(ctx, "resume", false)
		liveFailure(t, d, next.Snapshot(), creds, err)
		if !r.InternalReady || next.Snapshot().DatabaseIdentity != state.DatabaseIdentity {
			t.Fatal("database identity reset")
		}
		for part, id := range before {
			c, _, _ := d.container(ctx, state, part, creds)
			if c.ID != id {
				t.Fatal("healthy component recreated")
			}
		}
	})
	t.Run("lost_database_ack_resumes_real_state", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "interrupted")
		driver, _ := NewDocker(path, v)
		port := freeReviewPort(t)
		interrupted, err := Open(path, v, "install", port, &loseDatabaseAck{Docker: driver})
		if err != nil {
			t.Fatal(err)
		}
		s := interrupted.Snapshot()
		c := interrupted.credentials
		defer func() { interrupted.Close(); cleanLive(t, driver, s, c) }()
		if _, err := interrupted.Run(ctx, "install", false); err == nil || err.Error() != "operation_interrupted" {
			liveFailure(t, driver, s, c, err)
			t.Fatal("fault not surfaced")
		}
		db, found, err := driver.container(ctx, s, "db", c)
		if err != nil || !found {
			t.Fatal("database side effect missing")
		}
		secret, _ := os.ReadFile(filepath.Join(path, "admin.secret"))
		interrupted.Close()
		resumed, err := Open(path, v, "resume", port, driver)
		if err != nil {
			t.Fatal(err)
		}
		defer resumed.Close()
		r, err := resumed.Run(ctx, "resume", false)
		liveFailure(t, driver, resumed.Snapshot(), c, err)
		after, _, _ := driver.container(ctx, s, "db", c)
		kept, _ := os.ReadFile(filepath.Join(path, "admin.secret"))
		if !r.InternalReady || after.ID != db.ID || string(secret) != string(kept) || resumed.Snapshot().Instance != s.Instance {
			t.Fatal("lost ack reinitialized identity or database")
		}
	})
	t.Run("repair_dry_run_then_owned_restart", func(t *testing.T) {
		if _, err := d.call(ctx, "container", "stop", "--time=15", Name(state, "api")); err != nil {
			t.Fatal(err)
		}
		before, _ := os.ReadFile(filepath.Join(work, "journal.json"))
		dry, err := Open(work, v, "repair", port, d)
		if err != nil {
			t.Fatal(err)
		}
		r, err := dry.Run(ctx, "repair", false)
		dry.Close()
		after, _ := os.ReadFile(filepath.Join(work, "journal.json"))
		if err != nil || r.InternalReady || string(before) != string(after) {
			t.Fatal("dry-run changed state or hid failure")
		}
		fix, err := Open(work, v, "repair", port, d)
		if err != nil {
			t.Fatal(err)
		}
		defer fix.Close()
		r, err = fix.Run(ctx, "repair", true)
		liveFailure(t, d, fix.Snapshot(), creds, err)
		if !r.InternalReady || fix.Snapshot().DatabaseIdentity != state.DatabaseIdentity {
			t.Fatal("repair reset data identity")
		}
	})
	t.Run("actual_cli_doctor_and_offline_systemd_verification", func(t *testing.T) {
		keydir := t.TempDir()
		for name, b := range map[string][]byte{"plan.json": data, "plan.sig": sig, "test.pub": pub} {
			if err := os.WriteFile(filepath.Join(keydir, name), b, 0600); err != nil {
				t.Fatal(err)
			}
		}
		binary := os.Getenv("CLOUDLANE_TEST_INSTALLER_BINARY")
		cmd := exec.CommandContext(ctx, binary, "review", "--plan", filepath.Join(keydir, "plan.json"), "--signature", filepath.Join(keydir, "plan.sig"), "--trusted-key", filepath.Join(keydir, "test.pub"), "--key-sha256", plan.Digest(pub), "--version", v.Value().Version, "--workspace", work, "--port", strconv.Itoa(port), "--operation", "doctor")
		b, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatal("CLI doctor failed: " + string(b))
		}
		var got Report
		if json.Unmarshal(b, &got) != nil || !got.InternalReady || got.ReadyToClaim {
			t.Fatal("CLI readiness incorrect")
		}
		out := os.Getenv("CLOUDLANE_TEST_PLATFORM_REPORTS")
		if !filepath.IsAbs(out) {
			t.Fatal("missing report directory")
		}
		units := filepath.Join(out, "units")
		if err := os.MkdirAll(units, 0700); err != nil {
			t.Fatal(err)
		}
		args := []string{"verify", "--man=no"}
		for name, b := range RenderUnits(state) {
			path := filepath.Join(units, name)
			if err := os.WriteFile(path, b, 0600); err != nil {
				t.Fatal(err)
			}
			args = append(args, path)
		}
		verify := exec.CommandContext(ctx, "/usr/bin/systemd-analyze", args...)
		output, err := verify.CombinedOutput()
		os.WriteFile(filepath.Join(out, "systemd-verify.log"), output, 0600)
		if err != nil {
			t.Fatal("systemd unit verification failed: " + string(output))
		}
	})
	t.Run("foreign_network_is_preserved", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "conflict")
		driver, _ := NewDocker(path, v)
		conflict, err := Open(path, v, "install", freeReviewPort(t), driver)
		if err != nil {
			t.Fatal(err)
		}
		defer conflict.Close()
		s := conflict.Snapshot()
		id, err := driver.call(ctx, "network", "create", "--label=com.cloudlane.test.fixture="+s.Instance, Name(s, "control"))
		if err != nil {
			t.Fatal(err)
		}
		foreign := strings.TrimSpace(string(id))
		defer driver.call(context.Background(), "network", "rm", foreign)
		if _, err := conflict.Run(ctx, "install", false); err == nil || err.Error() != "resource_foreign" {
			t.Fatal("foreign resource reused")
		}
		var n networkInfo
		found, _ := driver.inspect(ctx, "network", foreign, &n)
		if !found || n.Labels["com.cloudlane.test.fixture"] != s.Instance {
			t.Fatal("foreign resource changed")
		}
	})
	t.Run("missing_initialized_data_is_not_recreated", func(t *testing.T) {
		for _, part := range []string{"caddy", "api", "migrate", "db"} {
			if _, found, err := d.container(ctx, state, part, creds); err != nil || !found {
				t.Fatal("owned fixture inspection failed", part, err)
			}
			if _, err := d.call(ctx, "container", "rm", "--force", Name(state, part)); err != nil {
				t.Fatal(err)
			}
		}
		if _, err := d.call(ctx, "volume", "rm", Name(state, "data")); err != nil {
			t.Fatal(err)
		}
		repair, err := Open(work, v, "repair", port, d)
		if err != nil {
			t.Fatal(err)
		}
		defer repair.Close()
		_, err = repair.Run(ctx, "repair", true)
		if err == nil || err.Error() != "database_data_missing" {
			t.Fatal("missing data reinitialized", err)
		}
		found, _ := d.volume(ctx, state, "data")
		if found || repair.Snapshot().DatabaseIdentity != state.DatabaseIdentity {
			t.Fatal("data identity lost")
		}
	})
	t.Run("unrelated_network_survived_all_operations", func(t *testing.T) {
		var n networkInfo
		found, err := d.inspect(ctx, "network", unrelated, &n)
		if err != nil || !found || n.Labels["com.cloudlane.test.fixture"] != state.Instance {
			t.Fatal("unrelated resource changed")
		}
	})
}
