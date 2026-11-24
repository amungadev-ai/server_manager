package platform

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"cloudlane.local/installer/internal/plan"
)

func verifiedFixture(t *testing.T) plan.Verified {
	t.Helper()
	pub, key, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	p := plan.Plan{Schema: 1, Product: "cloudlane-platform-review", Version: "0.1.0", Platform: "linux-amd64", DatabaseImage: "sha256:" + strings.Repeat("1", 64), APIImage: "sha256:" + strings.Repeat("2", 64), CaddyImage: "sha256:" + strings.Repeat("3", 64), SchemaSHA256: plan.Digest(pub), IssuedAt: now.Add(-time.Hour).Format(time.RFC3339), ExpiresAt: now.Add(time.Hour).Format(time.RFC3339)}
	b, _ := json.Marshal(p)
	v, err := plan.Verify(b, ed25519.Sign(key, append([]byte(plan.Prefix), b...)), pub, plan.Digest(pub), p.Version, now)
	if err != nil {
		t.Fatal(err)
	}
	return v
}

type fakeBackend struct {
	healthy  map[Step]bool
	applied  []Step
	identity string
	loseAck  Step
	badCheck Step
	badApply Step
}

func backend() *fakeBackend {
	return &fakeBackend{healthy: map[Step]bool{}, identity: "00000000-0000-0000-0000-000000000001"}
}
func (f *fakeBackend) Check(_ context.Context, s Step, _ State, _ secrets) (Observation, error) {
	if f.badCheck == s {
		return Observation{}, errors.New("PASSWORD=never-log-this")
	}
	o := Observation{Healthy: f.healthy[s]}
	if s == Migrations && o.Healthy {
		o.DatabaseIdentity = f.identity
	}
	return o, nil
}
func (f *fakeBackend) Apply(_ context.Context, s Step, _ State, _ secrets) error {
	f.applied = append(f.applied, s)
	if f.badApply == s {
		return errors.New("PASSWORD=never-log-this")
	}
	f.healthy[s] = true
	if f.loseAck == s {
		f.loseAck = ""
		return errors.New("operation_interrupted")
	}
	return nil
}
func openTest(t *testing.T, path string, p plan.Verified, op string, f Backend) *Engine {
	t.Helper()
	e, err := Open(path, p, op, 18080, f)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(e.Close)
	return e
}
func mustRun(t *testing.T, e *Engine, operation string, apply bool) Report {
	t.Helper()
	r, err := e.Run(context.Background(), operation, apply)
	if err != nil {
		t.Fatal(err)
	}
	return r
}
func TestInstallCompletesOnlyObservedStagesAndNeverClaimsReadiness(t *testing.T) {
	f := backend()
	path := filepath.Join(t.TempDir(), "review")
	e := openTest(t, path, verifiedFixture(t), "install", f)
	r := mustRun(t, e, "install", false)
	if !r.InternalReady || r.ReadyToClaim || r.State != "awaiting_tls_and_claim" || len(f.applied) != 7 {
		t.Fatal(r)
	}
	if e.Snapshot().DatabaseIdentity != f.identity {
		t.Fatal("database identity not persisted")
	}
	for _, s := range r.Stages {
		if s.Status != "complete" {
			t.Fatal("unchecked stage")
		}
	}
	if _, err := Open(path, e.verified, "install", 18080, f); err == nil {
		t.Fatal("fresh reinstall reset identity")
	}
}
func TestLostAcknowledgementResumesWithoutRepeatedActionOrSecretReset(t *testing.T) {
	f := backend()
	f.loseAck = Database
	path := filepath.Join(t.TempDir(), "review")
	p := verifiedFixture(t)
	e := openTest(t, path, p, "install", f)
	if _, err := e.Run(context.Background(), "install", false); err == nil {
		t.Fatal("fault not surfaced")
	}
	before := e.Snapshot()
	secret, _ := os.ReadFile(filepath.Join(path, "admin.secret"))
	e.Close()
	next := openTest(t, path, p, "resume", f)
	r := mustRun(t, next, "resume", false)
	if !r.InternalReady || next.Snapshot().Instance != before.Instance {
		t.Fatal("identity changed")
	}
	after, _ := os.ReadFile(filepath.Join(path, "admin.secret"))
	if string(after) != string(secret) {
		t.Fatal("secret reset")
	}
	count := 0
	for _, s := range f.applied {
		if s == Database {
			count++
		}
	}
	if count != 1 {
		t.Fatal("lost ack repeated an already healthy action")
	}
}
func TestResumeRefusesDriftAndRepairDryRunDoesNotWriteOrApply(t *testing.T) {
	f := backend()
	p := verifiedFixture(t)
	path := filepath.Join(t.TempDir(), "review")
	e := openTest(t, path, p, "install", f)
	mustRun(t, e, "install", false)
	e.Close()
	f.healthy[API] = false
	resume := openTest(t, path, p, "resume", f)
	_, err := resume.Run(context.Background(), "resume", false)
	if err == nil || err.Error() != "repair_required" {
		t.Fatal(err)
	}
	resume.Close()
	before, _ := os.ReadFile(filepath.Join(path, "journal.json"))
	calls := len(f.applied)
	dry := openTest(t, path, p, "repair", f)
	r := mustRun(t, dry, "repair", false)
	dry.Close()
	after, _ := os.ReadFile(filepath.Join(path, "journal.json"))
	if r.InternalReady || len(f.applied) != calls || string(before) != string(after) {
		t.Fatal("dry-run mutated state")
	}
	apply := openTest(t, path, p, "repair", f)
	r = mustRun(t, apply, "repair", true)
	if !r.InternalReady || len(f.applied) != calls+1 {
		t.Fatal("owned repair failed")
	}
}
func TestDatabaseIdentityChangeAndMissingSecretsFailClosed(t *testing.T) {
	f := backend()
	p := verifiedFixture(t)
	path := filepath.Join(t.TempDir(), "review")
	e := openTest(t, path, p, "install", f)
	mustRun(t, e, "install", false)
	id := e.Snapshot().DatabaseIdentity
	e.Close()
	f.identity = "00000000-0000-0000-0000-000000000002"
	next := openTest(t, path, p, "repair", f)
	_, err := next.Run(context.Background(), "repair", true)
	if err == nil || err.Error() != "database_identity_changed" || next.Snapshot().DatabaseIdentity != id {
		t.Fatal("identity drift accepted", err)
	}
	next.Close()
	if err := os.Remove(filepath.Join(path, "runtime.secret")); err != nil {
		t.Fatal(err)
	}
	if _, err := Open(path, p, "resume", 18080, f); err == nil {
		t.Fatal("missing secret regenerated")
	}
}
func TestJournalPlanPortCorruptionAndConcurrentClaimRejected(t *testing.T) {
	f := backend()
	p := verifiedFixture(t)
	path := filepath.Join(t.TempDir(), "review")
	e := openTest(t, path, p, "install", f)
	if _, err := Open(path, p, "resume", 18080, f); err == nil {
		t.Fatal("concurrent writer")
	}
	e.Close()
	for _, tc := range []struct {
		name string
		p    plan.Verified
		port int
	}{{"plan", verifiedFixture(t), 18080}, {"port", p, 18081}} {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := Open(path, tc.p, "resume", tc.port, f); err == nil {
				t.Fatal("binding ignored")
			}
		})
	}
	b, _ := os.ReadFile(filepath.Join(path, "journal.json"))
	b = []byte(strings.Replace(string(b), `"schema":1`, `"schema":1,"schema":1`, 1))
	os.WriteFile(filepath.Join(path, "journal.json"), b, 0600)
	if _, err := Open(path, p, "resume", 18080, f); err == nil {
		t.Fatal("ambiguous journal accepted")
	}
}
func TestNoUnverifiedPlanOrOperationBypass(t *testing.T) {
	path := filepath.Join(t.TempDir(), "review")
	if _, err := Open(path, plan.Verified{}, "install", 18080, backend()); err == nil {
		t.Fatal("unverified plan accepted")
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("unverified plan wrote files")
	}
	e := openTest(t, path, verifiedFixture(t), "install", backend())
	if _, err := e.Run(context.Background(), "doctor", true); err == nil {
		t.Fatal("operation changed after open")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := e.Run(ctx, "install", false); err == nil {
		t.Fatal("cancellation ignored")
	}
}
func TestDiagnosticsNeverContainBackendOutputOrCredentials(t *testing.T) {
	f := backend()
	f.badApply = Network
	path := filepath.Join(t.TempDir(), "review")
	e := openTest(t, path, verifiedFixture(t), "install", f)
	_, err := e.Run(context.Background(), "install", false)
	if err == nil || strings.Contains(err.Error(), "PASSWORD") {
		t.Fatal("error leaked")
	}
	b, _ := os.ReadFile(filepath.Join(path, "journal.json"))
	if strings.Contains(string(b), "never-log") || strings.Contains(string(b), e.credentials.admin) {
		t.Fatal("journal leaked credentials/output")
	}
}
func TestSystemdDefinitionsAreFixedOrderedAndSecretFree(t *testing.T) {
	s := State{Instance: strings.Repeat("1", 32)}
	files := RenderUnits(s)
	if len(files) != 4 {
		t.Fatal("missing units")
	}
	for name, b := range files {
		v := string(b)
		if !strings.HasPrefix(name, "cl-") || !strings.Contains(v, "NoNewPrivileges=yes") || !strings.Contains(v, "--host=unix:///var/run/docker.sock") || strings.Contains(v, "PASSWORD") || strings.Contains(v, "/bin/sh") {
			t.Fatal("unsafe unit")
		}
	}
	if !strings.Contains(string(files[Name(s, "api")+".service"]), "After=docker.service "+Name(s, "migrate")+".service") {
		t.Fatal("migration ordering absent")
	}
}

func TestNativePreflightSnapshotIsBoundAndDoesNotAuthorizeHostInstallation(t *testing.T) {
	f := backend()
	p := verifiedFixture(t)
	path := filepath.Join(t.TempDir(), "review")
	e := openTest(t, path, p, "install", f)
	s := e.Snapshot()
	e.Close()
	b, err := os.ReadFile(filepath.Join(path, "preflight.json"))
	if err != nil {
		t.Fatal(err)
	}
	if s.Profile != "isolated-loopback-review" || s.PreflightSHA256 != plan.Digest(b) || !strings.Contains(string(b), `"ready_to_install":false`) {
		t.Fatal("native preflight authority confused with review profile")
	}
	if err := os.WriteFile(filepath.Join(path, "preflight.json"), append(b, ' '), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := Open(path, p, "resume", 18080, f); err == nil {
		t.Fatal("preflight binding ignored")
	}
}
