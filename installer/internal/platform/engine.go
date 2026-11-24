package platform

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"regexp"
	"time"

	"cloudlane.local/installer/internal/journal"
	"cloudlane.local/installer/internal/plan"
	"cloudlane.local/installer/internal/preflight"
	"cloudlane.local/installer/internal/strictjson"
)

type Step string

const (
	Images     Step = "images"
	Network    Step = "network"
	Database   Step = "database"
	Migrations Step = "migrations"
	API        Step = "api"
	Caddy      Step = "caddy"
	Health     Step = "internal_health"
	Units      Step = "startup_units"
)

var Steps = []Step{Images, Network, Database, Migrations, API, Caddy, Health, Units}
var idRE = regexp.MustCompile(`^[a-f0-9]{32}$`)
var uuidRE = regexp.MustCompile(`^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$`)
var secretRE = regexp.MustCompile(`^[a-f0-9]{64}$`)

type Stage struct {
	Name         Step   `json:"name"`
	Status       string `json:"status"`
	Attempts     int    `json:"attempts"`
	UpdatedUTC   string `json:"updated_utc"`
	Diagnostic   string `json:"diagnostic"`
	EverComplete bool   `json:"ever_complete"`
}
type State struct {
	Schema           int     `json:"schema"`
	Profile          string  `json:"profile"`
	PreflightSHA256  string  `json:"preflight_sha256"`
	Instance         string  `json:"instance"`
	PlanSHA256       string  `json:"plan_sha256"`
	Version          string  `json:"version"`
	Port             int     `json:"loopback_port"`
	DatabaseIdentity string  `json:"database_identity"`
	Stages           []Stage `json:"stages"`
}
type Observation struct {
	Healthy          bool
	DatabaseIdentity string
}
type secrets struct{ admin, migrator, runtime string }

// Backend is a typed internal boundary; no user-provided command/path enters it.
type Backend interface {
	Check(context.Context, Step, State, secrets) (Observation, error)
	Apply(context.Context, Step, State, secrets) error
}
type Report struct {
	Schema        string  `json:"schema"`
	State         string  `json:"state"`
	InternalReady bool    `json:"internal_ready"`
	ReadyToClaim  bool    `json:"ready_to_claim"`
	LoopbackPort  int     `json:"loopback_port"`
	Stages        []Stage `json:"stages"`
}
type Engine struct {
	w           *journal.Workspace
	verified    plan.Verified
	state       State
	credentials secrets
	backend     Backend
	operation   string
}

func stamp() string { return time.Now().UTC().Format(time.RFC3339) }

func Open(path string, p plan.Verified, operation string, port int, backend Backend) (*Engine, error) {
	if !p.Valid() || backend == nil || port < 1024 || port > 65535 {
		return nil, errors.New("review_options")
	}
	if operation != "install" && operation != "resume" && operation != "repair" && operation != "doctor" {
		return nil, errors.New("review_options")
	}
	w, err := journal.Open(path, operation == "install")
	if err != nil {
		return nil, err
	}
	e := &Engine{w: w, verified: p, backend: backend, operation: operation}
	fail := func(err error) (*Engine, error) { e.Close(); return nil, err }
	if operation == "install" {
		id, err := journal.ID()
		if err != nil {
			return fail(err)
		}
		snapshot, _ := json.Marshal(preflight.Collect())
		e.state = State{Schema: 1, Profile: "isolated-loopback-review", PreflightSHA256: plan.Digest(snapshot), Instance: id, PlanSHA256: p.Hash(), Version: p.Value().Version, Port: port, Stages: make([]Stage, len(Steps))}
		for i, s := range Steps {
			e.state.Stages[i] = Stage{Name: s, Status: "pending", UpdatedUTC: stamp()}
		}
		if err := e.save(); err != nil {
			return fail(err)
		}
		if err := w.Exclusive("preflight.json", snapshot); err != nil {
			return fail(errors.New("journal_write_failed"))
		}
	} else {
		b, err := w.Read("journal.json", 131072)
		if err != nil {
			return fail(errors.New("journal_unavailable"))
		}
		if err := strictjson.Decode(b, &e.state, 131072); err != nil {
			return fail(errors.New("journal_invalid"))
		}
		if !validState(e.state, p, port) {
			return fail(errors.New("journal_binding"))
		}
		snapshot, err := w.Read("preflight.json", 32768)
		if err != nil || plan.Digest(snapshot) != e.state.PreflightSHA256 {
			return fail(errors.New("preflight_binding"))
		}
	}
	for _, item := range []struct {
		name   string
		target *string
	}{{"admin.secret", &e.credentials.admin}, {"migrator.secret", &e.credentials.migrator}, {"runtime.secret", &e.credentials.runtime}} {
		b, err := w.Read(item.name, 64)
		if errors.Is(err, os.ErrNotExist) && operation == "install" {
			value := make([]byte, 32)
			if _, err := rand.Read(value); err != nil {
				return fail(errors.New("entropy_unavailable"))
			}
			b = []byte(hex.EncodeToString(value))
			if err := w.Exclusive(item.name, b); err != nil {
				return fail(errors.New("secret_write_failed"))
			}
		} else if err != nil {
			return fail(errors.New("secret_unavailable"))
		}
		if !secretRE.Match(b) {
			return fail(errors.New("secret_invalid"))
		}
		*item.target = string(b)
	}
	for name, want := range environments(e.credentials) {
		if operation == "install" {
			if err := w.Exclusive(name, []byte(want)); err != nil {
				return fail(errors.New("secret_write_failed"))
			}
		} else {
			got, err := w.Read(name, 2048)
			if err != nil || string(got) != want {
				return fail(errors.New("secret_invalid"))
			}
		}
	}
	if err := w.EmptyDirectory("docker-client", operation == "install"); err != nil {
		return fail(err)
	}
	return e, nil
}
func environments(c secrets) map[string]string {
	return map[string]string{
		"admin.env":    "POSTGRES_USER=cloudlane_admin\nPOSTGRES_DB=cloudlane_platform\nPOSTGRES_PASSWORD=" + c.admin + "\nPOSTGRES_INITDB_ARGS=--auth-host=scram-sha-256\n",
		"migrator.env": "CLOUDLANE_DATABASE_URL=postgresql://cloudlane_migrator:" + c.migrator + "@127.0.0.1:5432/cloudlane_platform\nNODE_ENV=production\n",
		"runtime.env":  "CLOUDLANE_DATABASE_URL=postgresql://cloudlane_runtime:" + c.runtime + "@127.0.0.1:5432/cloudlane_platform\nNODE_ENV=production\n",
	}
}
func validState(s State, p plan.Verified, port int) bool {
	if s.Schema != 1 || s.Profile != "isolated-loopback-review" || !secretRE.MatchString(s.PreflightSHA256) || !idRE.MatchString(s.Instance) || s.PlanSHA256 != p.Hash() || s.Version != p.Value().Version || s.Port != port || len(s.Stages) != len(Steps) || (s.DatabaseIdentity != "" && !uuidRE.MatchString(s.DatabaseIdentity)) {
		return false
	}
	for i, x := range s.Stages {
		if x.Name == Migrations && x.EverComplete && s.DatabaseIdentity == "" {
			return false
		}
		if x.Name != Steps[i] || x.Attempts < 0 || x.Attempts > 128 || len(x.Diagnostic) > 48 {
			return false
		}
		if (x.Diagnostic != "" && Code(errors.New(x.Diagnostic)) != x.Diagnostic) || (x.Status == "complete" && !x.EverComplete) || (x.Status == "pending" && x.EverComplete) {
			return false
		}
		if x.Status != "pending" && x.Status != "running" && x.Status != "complete" && x.Status != "failed" {
			return false
		}
		t, err := time.Parse(time.RFC3339, x.UpdatedUTC)
		if err != nil || t.UTC().Format(time.RFC3339) != x.UpdatedUTC {
			return false
		}
	}
	return true
}
func (e *Engine) Close() {
	if e.w != nil {
		e.w.Close()
		e.w = nil
	}
}
func (e *Engine) Snapshot() State {
	b, _ := json.Marshal(e.state)
	var s State
	json.Unmarshal(b, &s)
	return s
}
func (e *Engine) save() error {
	b, err := json.Marshal(e.state)
	if err != nil {
		return errors.New("journal_write_failed")
	}
	if err := e.w.Atomic("journal.json", append(b, '\n')); err != nil {
		return errors.New("journal_write_failed")
	}
	return nil
}
func (e *Engine) observe(ctx context.Context, step Step) (Observation, error) {
	if step == Units {
		ok, err := e.w.UnitsMatch(RenderUnits(e.state))
		return Observation{Healthy: ok}, err
	}
	o, err := e.backend.Check(ctx, step, e.state, e.credentials)
	if err == nil && o.DatabaseIdentity != "" {
		if !uuidRE.MatchString(o.DatabaseIdentity) || (e.state.DatabaseIdentity != "" && o.DatabaseIdentity != e.state.DatabaseIdentity) {
			return Observation{}, errors.New("database_identity_changed")
		}
	}
	return o, err
}
func (e *Engine) Run(ctx context.Context, operation string, apply bool) (Report, error) {
	if operation != e.operation || (apply && operation != "repair") {
		return Report{}, errors.New("review_options")
	}
	readonly := operation == "doctor" || (operation == "repair" && !apply)
	r := Report{Schema: "cloudlane.install-review.v1", State: "incomplete", LoopbackPort: e.state.Port}
	for i, step := range Steps {
		if ctx.Err() != nil {
			return r, errors.New("operation_interrupted")
		}
		stage := &e.state.Stages[i]
		o, err := e.observe(ctx, step)
		if err != nil {
			if !readonly {
				stage.Status = "failed"
				stage.UpdatedUTC = stamp()
				stage.Diagnostic = Code(err)
				if persist := e.save(); persist != nil {
					return r, persist
				}
			}
			return r, errors.New(Code(err))
		}
		if readonly {
			copy := *stage
			if o.Healthy {
				copy.Status = "complete"
			} else {
				copy.Status = "pending"
			}
			r.Stages = append(r.Stages, copy)
			continue
		}
		if stage.EverComplete && !o.Healthy && operation == "resume" {
			stage.Status = "failed"
			stage.UpdatedUTC = stamp()
			stage.Diagnostic = "repair_required"
			if err := e.save(); err != nil {
				return r, err
			}
			return r, errors.New("repair_required")
		}
		if !o.Healthy {
			if stage.Attempts >= 128 {
				return r, errors.New("attempt_limit")
			}
			stage.Status = "running"
			stage.Attempts++
			stage.UpdatedUTC = stamp()
			stage.Diagnostic = ""
			if err := e.save(); err != nil {
				return r, err
			}
			if step == Units {
				err = e.w.Units(RenderUnits(e.state))
			} else {
				err = e.backend.Apply(ctx, step, e.state, e.credentials)
			}
			if err == nil {
				o, err = e.observe(ctx, step)
				if err == nil && !o.Healthy {
					err = errors.New("postcondition_failed")
				}
			}
			if err != nil {
				stage.Status = "failed"
				stage.UpdatedUTC = stamp()
				stage.Diagnostic = Code(err)
				if persist := e.save(); persist != nil {
					return r, persist
				}
				return r, errors.New(Code(err))
			}
		}
		if o.DatabaseIdentity != "" {
			e.state.DatabaseIdentity = o.DatabaseIdentity
		}
		stage.Status = "complete"
		stage.EverComplete = true
		stage.UpdatedUTC = stamp()
		stage.Diagnostic = ""
		if err := e.save(); err != nil {
			return r, err
		}
		r.Stages = append(r.Stages, *stage)
	}
	r.InternalReady = true
	for _, s := range r.Stages {
		if s.Status != "complete" {
			r.InternalReady = false
		}
	}
	if r.InternalReady {
		r.State = "awaiting_tls_and_claim"
	}
	return r, nil
}

// Code is the only error text allowed in journal/CLI output.
func Code(err error) string {
	if err == nil {
		return ""
	}
	switch err.Error() {
	case "installation_locked", "workspace_unsafe", "fresh_workspace_required", "journal_unavailable", "journal_invalid", "journal_binding", "preflight_binding", "journal_write_failed", "secret_unavailable", "secret_invalid", "secret_write_failed", "entropy_unavailable", "review_options", "repair_required", "attempt_limit", "postcondition_failed", "database_identity_changed", "database_data_missing", "schema_drift", "resource_foreign", "resource_drift", "daemon_unavailable", "daemon_unsupported", "publication_unavailable", "image_unavailable", "dependency_unhealthy", "operation_interrupted", "docker_failed", "unit_files_unsafe":
		return err.Error()
	}
	return "operation_failed"
}
