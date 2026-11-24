package platform

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"time"

	"cloudlane.local/installer/internal/plan"
)

type commandRunner interface {
	run(context.Context, []string, []byte) ([]byte, error)
}
type dockerCLI struct{ config string }
type boundedBuffer struct{ bytes.Buffer }

func (b *boundedBuffer) Write(p []byte) (int, error) {
	if b.Len()+len(p) > 1<<20 {
		return 0, errors.New("output_limit")
	}
	return b.Buffer.Write(p)
}
func (d dockerCLI) run(ctx context.Context, args []string, input []byte) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 180*time.Second)
	defer cancel()
	prefix := []string{"--host=unix:///var/run/docker.sock", "--config=" + d.config}
	cmd := exec.CommandContext(ctx, "/usr/bin/docker", append(prefix, args...)...)
	cmd.Env = []string{"PATH=/usr/bin:/bin", "LANG=C.UTF-8"}
	cmd.Stdin = bytes.NewReader(input)
	var out boundedBuffer
	cmd.Stdout = &out
	cmd.Stderr = io.Discard
	if err := cmd.Run(); err != nil {
		if ctx.Err() != nil {
			return nil, errors.New("operation_interrupted")
		}
		return nil, errors.New("docker_failed")
	}
	return out.Bytes(), nil
}

type Docker struct {
	runner    commandRunner
	directory string
	release   plan.Plan
}

func NewDocker(directory string, p plan.Verified) (*Docker, error) {
	if !p.Valid() || !filepath.IsAbs(directory) {
		return nil, errors.New("review_options")
	}
	return &Docker{runner: dockerCLI{filepath.Join(directory, "docker-client")}, directory: directory, release: p.Value()}, nil
}
func (d *Docker) call(ctx context.Context, args ...string) ([]byte, error) {
	return d.runner.run(ctx, args, nil)
}
func (d *Docker) inspect(ctx context.Context, kind, name string, out any) (bool, error) {
	data, err := d.call(ctx, kind, "inspect", name)
	if err != nil {
		if ctx.Err() != nil {
			return false, err
		}
		return false, nil
	}
	var values []json.RawMessage
	if json.Unmarshal(data, &values) != nil || len(values) != 1 || json.Unmarshal(values[0], out) != nil {
		return false, errors.New("resource_drift")
	}
	return true, nil
}

type imageInfo struct {
	ID           string `json:"Id"`
	OS           string `json:"Os"`
	Architecture string
	RepoDigests  []string
	Config       struct{ Entrypoint, Cmd []string }
}

func normalizedImage(ref string) string {
	parts := strings.Split(ref, "@")
	if len(parts) != 2 {
		return ref
	}
	name := parts[0]
	if i := strings.LastIndex(name, ":"); i > strings.LastIndex(name, "/") {
		name = name[:i]
	}
	name = strings.TrimPrefix(strings.TrimPrefix(name, "docker.io/"), "library/")
	return name + "@" + parts[1]
}
func (d *Docker) image(ctx context.Context, ref string) (imageInfo, bool, error) {
	var image imageInfo
	found, err := d.inspect(ctx, "image", ref, &image)
	if err != nil || !found {
		return image, false, err
	}
	if image.OS != "linux" || image.Architecture != "amd64" || (!strings.HasPrefix(image.ID, "sha256:") || !secretRE.MatchString(strings.TrimPrefix(image.ID, "sha256:"))) {
		return image, false, errors.New("image_unavailable")
	}
	valid := ref == image.ID
	for _, digest := range image.RepoDigests {
		if normalizedImage(ref) == normalizedImage(digest) {
			valid = true
		}
	}
	if !valid {
		return image, false, errors.New("image_unavailable")
	}
	return image, true, nil
}

type networkInfo struct {
	Internal bool
	Driver   string
	Labels   map[string]string
	Options  map[string]string
}
type volumeInfo struct {
	Driver  string
	Labels  map[string]string
	Options map[string]string
}
type mountInfo struct {
	Type, Name, Destination string
	RW                      bool
}
type portBinding struct {
	HostIP   string `json:"HostIp"`
	HostPort string
}
type containerInfo struct {
	ID     string `json:"Id"`
	Image  string
	Config struct {
		User            string
		Env             []string
		Labels          map[string]string
		Entrypoint, Cmd []string
	}
	HostConfig struct {
		NetworkMode, PidMode         string
		Privileged, ReadonlyRootfs   bool
		CapDrop, CapAdd, Binds       []string
		SecurityOpt                  []string
		Devices                      []json.RawMessage
		PortBindings                 map[string][]portBinding
		Memory, MemorySwap, NanoCPUs int64
		PidsLimit                    int64
		RestartPolicy                struct{ Name string }
		LogConfig                    struct {
			Type   string
			Config map[string]string
		}
	}
	Mounts []mountInfo
	State  struct {
		Running  bool
		ExitCode int
	}
	NetworkSettings struct{ Networks map[string]json.RawMessage }
}

func labels(s State, component string) map[string]string {
	return map[string]string{"com.cloudlane.review.instance": s.Instance, "com.cloudlane.review.plan": s.PlanSHA256, "com.cloudlane.review.component": component}
}
func labelArgs(s State, component string) []string {
	return []string{"--label=com.cloudlane.review.instance=" + s.Instance, "--label=com.cloudlane.review.plan=" + s.PlanSHA256, "--label=com.cloudlane.review.component=" + component}
}
func owned(got map[string]string, s State, component string) bool {
	for k, v := range labels(s, component) {
		if got[k] != v {
			return false
		}
	}
	return true
}
func (d *Docker) network(ctx context.Context, s State) (bool, error) {
	var n networkInfo
	found, err := d.inspect(ctx, "network", Name(s, "control"), &n)
	if err != nil || !found {
		return false, err
	}
	if !owned(n.Labels, s, "control") {
		return false, errors.New("resource_foreign")
	}
	if !n.Internal || n.Driver != "bridge" || len(n.Options) != 0 {
		return false, errors.New("resource_drift")
	}
	return true, nil
}
func (d *Docker) volume(ctx context.Context, s State, component string) (bool, error) {
	var v volumeInfo
	found, err := d.inspect(ctx, "volume", Name(s, component), &v)
	if err != nil || !found {
		return false, err
	}
	if !owned(v.Labels, s, component) {
		return false, errors.New("resource_foreign")
	}
	if v.Driver != "local" || len(v.Options) != 0 {
		return false, errors.New("resource_drift")
	}
	return true, nil
}
func (d *Docker) ensureVolume(ctx context.Context, s State, component string) error {
	found, err := d.volume(ctx, s, component)
	if err != nil || found {
		return err
	}
	if component == "data" && s.DatabaseIdentity != "" {
		return errors.New("database_data_missing")
	}
	args := append([]string{"volume", "create", "--driver=local"}, labelArgs(s, component)...)
	args = append(args, Name(s, component))
	_, err = d.call(ctx, args...)
	return err
}
func (d *Docker) ref(component string) string {
	switch component {
	case "db":
		return d.release.DatabaseImage
	case "caddy":
		return d.release.CaddyImage
	default:
		return d.release.APIImage
	}
}
func (d *Docker) container(ctx context.Context, s State, component string, c secrets) (containerInfo, bool, error) {
	var v containerInfo
	found, err := d.inspect(ctx, "container", Name(s, component), &v)
	if err != nil || !found {
		return v, false, err
	}
	if !owned(v.Config.Labels, s, component) {
		return v, false, errors.New("resource_foreign")
	}
	image, exists, err := d.image(ctx, d.ref(component))
	if err != nil || !exists {
		return v, false, errors.New("image_unavailable")
	}
	mode := Name(s, "control")
	user := "10001:10001"
	memory := int64(384 << 20)
	cpus := int64(1e9)
	pids := int64(128)
	if component == "db" {
		user = "999:999"
	} else {
		var db containerInfo
		exists, err := d.inspect(ctx, "container", Name(s, "db"), &db)
		if err != nil || !exists || !owned(db.Config.Labels, s, "db") {
			return v, false, errors.New("resource_drift")
		}
		mode = "container:" + db.ID
	}
	if component == "caddy" {
		memory = 128 << 20
		cpus = 5e8
		pids = 64
	}
	h := v.HostConfig
	nnp := len(h.SecurityOpt) == 1 && (h.SecurityOpt[0] == "no-new-privileges" || h.SecurityOpt[0] == "no-new-privileges:true" || h.SecurityOpt[0] == "no-new-privileges=true")
	if v.Image != image.ID || v.Config.User != user || h.NetworkMode != mode || h.Privileged || !h.ReadonlyRootfs || h.PidMode != "" || len(h.CapDrop) != 1 || !strings.EqualFold(h.CapDrop[0], "ALL") || len(h.CapAdd) != 0 || !nnp || len(h.Binds) != 0 || len(h.Devices) != 0 || h.Memory != memory || h.MemorySwap != memory || h.NanoCPUs != cpus || h.PidsLimit != pids || h.RestartPolicy.Name != "no" || h.LogConfig.Type != "local" || h.LogConfig.Config["max-size"] != "5m" || h.LogConfig.Config["max-file"] != "2" {
		return v, false, errors.New("resource_drift")
	}
	if component == "db" {
		bindings := h.PortBindings["8080/tcp"]
		if len(h.PortBindings) != 1 || len(bindings) != 1 || bindings[0].HostIP != "127.0.0.1" || bindings[0].HostPort != strconv.Itoa(s.Port) {
			return v, false, errors.New("resource_drift")
		}
		if len(v.NetworkSettings.Networks) != 1 || v.NetworkSettings.Networks[mode] == nil {
			return v, false, errors.New("resource_drift")
		}
	} else if len(h.PortBindings) != 0 {
		return v, false, errors.New("resource_drift")
	}
	entry, cmd := image.Config.Entrypoint, image.Config.Cmd
	if component == "db" {
		cmd = []string{"postgres", "-c", "listen_addresses=127.0.0.1", "-c", "log_statement=none", "-c", "log_min_error_statement=panic"}
	}
	if component == "migrate" {
		entry = []string{"node"}
		cmd = []string{"--max-old-space-size=192", "apps/api/dist/database/migrate-cli.js"}
	}
	if !reflect.DeepEqual(v.Config.Entrypoint, entry) || !reflect.DeepEqual(v.Config.Cmd, cmd) {
		return v, false, errors.New("resource_drift")
	}
	wantMounts := map[string]string{}
	if component == "db" {
		wantMounts["/var/lib/postgresql"] = Name(s, "data")
	}
	if component == "caddy" {
		wantMounts["/data"] = Name(s, "caddy-data")
		wantMounts["/config"] = Name(s, "caddy-config")
	}
	if len(v.Mounts) != len(wantMounts) {
		return v, false, errors.New("resource_drift")
	}
	for _, m := range v.Mounts {
		if m.Type != "volume" || !m.RW || wantMounts[m.Destination] != m.Name {
			return v, false, errors.New("resource_drift")
		}
		role := strings.TrimPrefix(m.Name, "cl-"+s.Instance+"-")
		found, err := d.volume(ctx, s, role)
		if err != nil || !found {
			return v, false, errors.New("resource_foreign")
		}
	}
	if component != "caddy" {
		file := "runtime.env"
		if component == "db" {
			file = "admin.env"
		}
		if component == "migrate" {
			file = "migrator.env"
		}
		set := map[string]string{}
		for _, value := range v.Config.Env {
			key, _, _ := strings.Cut(value, "=")
			if _, exists := set[key]; exists {
				return v, false, errors.New("resource_drift")
			}
			set[key] = value
		}
		for _, want := range strings.Split(strings.TrimSpace(environments(c)[file]), "\n") {
			key, _, _ := strings.Cut(want, "=")
			if set[key] != want {
				return v, false, errors.New("resource_drift")
			}
		}
	}
	return v, true, nil
}
func (d *Docker) create(ctx context.Context, s State, component string, c secrets) error {
	_, exists, err := d.container(ctx, s, component, c)
	if err != nil || exists {
		return err
	}
	mode := Name(s, "control")
	user := "10001:10001"
	memory := 384 << 20
	cpus := "1"
	pids := "128"
	if component == "db" {
		user = "999:999"
	} else {
		var db containerInfo
		exists, err := d.inspect(ctx, "container", Name(s, "db"), &db)
		if err != nil || !exists || !owned(db.Config.Labels, s, "db") {
			return errors.New("dependency_unhealthy")
		}
		mode = "container:" + db.ID
	}
	if component == "caddy" {
		memory = 128 << 20
		cpus = "0.5"
		pids = "64"
	}
	args := []string{"container", "create", "--name=" + Name(s, component), "--network=" + mode, "--user=" + user, "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges", "--pids-limit=" + pids, "--memory=" + strconv.Itoa(memory), "--memory-swap=" + strconv.Itoa(memory), "--cpus=" + cpus, "--restart=no", "--log-driver=local", "--log-opt=max-size=5m", "--log-opt=max-file=2", "--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=16777216,mode=1777"}
	args = append(args, labelArgs(s, component)...)
	if component == "db" {
		args = append(args, "--publish=127.0.0.1:"+strconv.Itoa(s.Port)+":8080/tcp", "--mount=type=volume,src="+Name(s, "data")+",dst=/var/lib/postgresql", "--tmpfs=/var/run/postgresql:rw,noexec,nosuid,nodev,size=8388608,uid=999,gid=999,mode=3777")
	}
	if component == "caddy" {
		for _, item := range []struct{ role, path string }{{"caddy-data", "/data"}, {"caddy-config", "/config"}} {
			args = append(args, "--mount=type=volume,src="+Name(s, item.role)+",dst="+item.path)
		}
	} else {
		file := "runtime.env"
		if component == "db" {
			file = "admin.env"
		}
		if component == "migrate" {
			file = "migrator.env"
			args = append(args, "--entrypoint=node")
		}
		args = append(args, "--env-file="+filepath.Join(d.directory, file))
	}
	args = append(args, d.ref(component))
	if component == "db" {
		args = append(args, "postgres", "-c", "listen_addresses=127.0.0.1", "-c", "log_statement=none", "-c", "log_min_error_statement=panic")
	}
	if component == "migrate" {
		args = append(args, "--max-old-space-size=192", "apps/api/dist/database/migrate-cli.js")
	}
	_, err = d.call(ctx, args...)
	return err
}
func (d *Docker) start(ctx context.Context, s State, component string, c secrets, restart bool) error {
	v, found, err := d.container(ctx, s, component, c)
	if err != nil {
		return err
	}
	if !found {
		return errors.New("dependency_unhealthy")
	}
	if v.State.Running {
		if !restart {
			return nil
		}
		_, err = d.call(ctx, "container", "restart", "--time=15", Name(s, component))
		return err
	}
	args := []string{"container", "start"}
	if component == "migrate" {
		args = append(args, "--attach")
	}
	args = append(args, Name(s, component))
	_, err = d.call(ctx, args...)
	return err
}
func (d *Docker) sql(ctx context.Context, s State, statement string, input bool) (string, error) {
	args := []string{"container", "exec", "--user=999:999"}
	if input {
		args = append(args, "--interactive")
	}
	args = append(args, Name(s, "db"), "psql", "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q", "-U", "cloudlane_admin", "-d", "cloudlane_platform")
	var data []byte
	var err error
	if input {
		data, err = d.runner.run(ctx, args, []byte(statement))
	} else {
		args = append(args, "-c", statement)
		data, err = d.call(ctx, args...)
	}
	return strings.TrimSpace(string(data)), err
}
func waitFor(ctx context.Context, check func(context.Context) (bool, error)) error {
	ctx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	ticker := time.NewTicker(300 * time.Millisecond)
	defer ticker.Stop()
	for {
		ok, err := check(ctx)
		if err != nil {
			return err
		}
		if ok {
			return nil
		}
		select {
		case <-ctx.Done():
			return errors.New("dependency_unhealthy")
		case <-ticker.C:
		}
	}
}

const roleCheck = `SELECT count(*)=2 AND bool_and(NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AND rolcanlogin) FROM pg_roles WHERE rolname IN ('cloudlane_migrator','cloudlane_runtime')`
const runtimeGrantCheck = `SELECT has_schema_privilege('cloudlane_runtime','cloudlane','USAGE') AND NOT has_schema_privilege('cloudlane_runtime','cloudlane','CREATE') AND has_table_privilege('cloudlane_runtime','cloudlane.projects','SELECT') AND has_table_privilege('cloudlane_runtime','cloudlane.projects','INSERT') AND has_table_privilege('cloudlane_runtime','cloudlane.projects','UPDATE') AND has_table_privilege('cloudlane_runtime','cloudlane.projects','DELETE') AND NOT has_table_privilege('cloudlane_runtime','cloudlane.schema_migrations','INSERT,UPDATE,DELETE')`

func (d *Docker) Check(ctx context.Context, step Step, s State, c secrets) (Observation, error) {
	no := Observation{}
	yes := Observation{Healthy: true}
	switch step {
	case Images:
		if _, err := d.call(ctx, "info", "--format={{.ServerVersion}}"); err != nil {
			return no, errors.New("daemon_unavailable")
		}
		for _, ref := range []string{d.release.DatabaseImage, d.release.APIImage, d.release.CaddyImage} {
			_, found, err := d.image(ctx, ref)
			if err != nil || !found {
				return no, err
			}
		}
		return yes, nil
	case Network:
		ok, err := d.network(ctx, s)
		return Observation{Healthy: ok}, err
	case Database:
		volume, err := d.volume(ctx, s, "data")
		if err != nil {
			return no, err
		}
		if !volume && s.DatabaseIdentity != "" {
			return no, errors.New("database_data_missing")
		}
		v, exists, err := d.container(ctx, s, "db", c)
		if err != nil || !exists || !v.State.Running {
			return no, err
		}
		roles, err := d.sql(ctx, s, roleCheck, false)
		return Observation{Healthy: volume && err == nil && roles == "t"}, nil
	case Migrations:
		v, found, err := d.container(ctx, s, "db", c)
		if err != nil || !found || !v.State.Running {
			return no, err
		}
		exists, err := d.sql(ctx, s, "SELECT to_regclass('cloudlane.schema_migrations') IS NOT NULL", false)
		if err != nil || exists != "t" {
			if s.DatabaseIdentity != "" {
				return no, errors.New("schema_drift")
			}
			return no, nil
		}
		rows, err := d.sql(ctx, s, "SELECT id||':'||checksum FROM cloudlane.schema_migrations ORDER BY id", false)
		if err != nil {
			return no, errors.New("schema_drift")
		}
		if plan.Digest([]byte(rows+"\n")) != d.release.SchemaSHA256 {
			if s.DatabaseIdentity != "" {
				return no, errors.New("schema_drift")
			}
			return no, nil
		}
		identity, err := d.sql(ctx, s, "SELECT id::text FROM cloudlane.installations WHERE singleton", false)
		if err != nil || !uuidRE.MatchString(identity) {
			return no, errors.New("schema_drift")
		}
		grants, err := d.sql(ctx, s, runtimeGrantCheck, false)
		return Observation{Healthy: err == nil && grants == "t", DatabaseIdentity: identity}, nil
	case API:
		v, found, err := d.container(ctx, s, "api", c)
		if err != nil || !found || !v.State.Running {
			return no, err
		}
		_, err = d.call(ctx, "container", "exec", "--user=10001:10001", Name(s, "api"), "node", "-e", apiHealthScript)
		return Observation{Healthy: err == nil}, nil
	case Caddy:
		v, found, err := d.container(ctx, s, "caddy", c)
		if err != nil || !found || !v.State.Running {
			return no, err
		}
		return Observation{Healthy: d.panel(s)}, nil
	case Health:
		for _, part := range []Step{Database, Migrations, API, Caddy} {
			o, err := d.Check(ctx, part, s, c)
			if err != nil || !o.Healthy {
				return no, err
			}
			if o.DatabaseIdentity != "" {
				yes.DatabaseIdentity = o.DatabaseIdentity
			}
		}
		return yes, nil
	}
	return no, errors.New("review_options")
}
func (d *Docker) Apply(ctx context.Context, step Step, s State, c secrets) error {
	switch step {
	case Images:
		for _, ref := range []string{d.release.DatabaseImage, d.release.APIImage, d.release.CaddyImage} {
			_, found, err := d.image(ctx, ref)
			if err != nil {
				return err
			}
			if !found {
				if strings.HasPrefix(ref, "sha256:") {
					return errors.New("image_unavailable")
				}
				if _, err := d.call(ctx, "image", "pull", ref); err != nil {
					return errors.New("image_unavailable")
				}
			}
		}
		return nil
	case Network:
		found, err := d.network(ctx, s)
		if err != nil || found {
			return err
		}
		args := append([]string{"network", "create", "--driver=bridge", "--internal"}, labelArgs(s, "control")...)
		args = append(args, Name(s, "control"))
		_, err = d.call(ctx, args...)
		return err
	case Database:
		if err := d.ensureVolume(ctx, s, "data"); err != nil {
			return err
		}
		if err := d.create(ctx, s, "db", c); err != nil {
			return err
		}
		if err := d.start(ctx, s, "db", c, false); err != nil {
			return err
		}
		if err := waitFor(ctx, func(ctx context.Context) (bool, error) {
			_, err := d.call(ctx, "container", "exec", "--user=999:999", Name(s, "db"), "pg_isready", "-h", "127.0.0.1", "-U", "cloudlane_admin", "-d", "cloudlane_platform")
			return err == nil, nil
		}); err != nil {
			return err
		}
		// Secrets are validated hex, sent only over stdin, and never reset on retry.
		if !secretRE.MatchString(c.migrator) || !secretRE.MatchString(c.runtime) {
			return errors.New("secret_invalid")
		}
		sql := fmt.Sprintf("BEGIN; DO $cl$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='cloudlane_migrator') THEN CREATE ROLE cloudlane_migrator LOGIN PASSWORD '%s'; END IF; IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='cloudlane_runtime') THEN CREATE ROLE cloudlane_runtime LOGIN PASSWORD '%s'; END IF; END $cl$; ALTER DATABASE cloudlane_platform OWNER TO cloudlane_migrator; REVOKE ALL ON DATABASE cloudlane_platform FROM PUBLIC; GRANT CONNECT ON DATABASE cloudlane_platform TO cloudlane_runtime; COMMIT;", c.migrator, c.runtime)
		_, err := d.sql(ctx, s, sql, true)
		return err
	case Migrations:
		if s.DatabaseIdentity != "" {
			present, err := d.Check(ctx, Migrations, s, c)
			if err != nil {
				return err
			}
			if !present.Healthy {
				return errors.New("schema_drift")
			}
			return nil
		}
		if err := d.create(ctx, s, "migrate", c); err != nil {
			return err
		}
		if err := d.start(ctx, s, "migrate", c, false); err != nil {
			return err
		}
		grant := `BEGIN; REVOKE CREATE ON SCHEMA public FROM PUBLIC; REVOKE ALL ON SCHEMA cloudlane FROM PUBLIC; GRANT USAGE ON SCHEMA cloudlane TO cloudlane_runtime; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA cloudlane TO cloudlane_runtime; REVOKE INSERT,UPDATE,DELETE ON cloudlane.schema_migrations FROM cloudlane_runtime; ALTER DEFAULT PRIVILEGES FOR ROLE cloudlane_migrator IN SCHEMA cloudlane GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO cloudlane_runtime; COMMIT;`
		_, err := d.sql(ctx, s, grant, true)
		return err
	case API, Caddy:
		component := string(step)
		if step == Caddy {
			for _, name := range []string{"caddy-data", "caddy-config"} {
				if err := d.ensureVolume(ctx, s, name); err != nil {
					return err
				}
			}
		}
		if err := d.create(ctx, s, component, c); err != nil {
			return err
		}
		if err := d.start(ctx, s, component, c, true); err != nil {
			return err
		}
		return waitFor(ctx, func(ctx context.Context) (bool, error) { o, err := d.Check(ctx, step, s, c); return o.Healthy, err })
	case Health:
		return waitFor(ctx, func(ctx context.Context) (bool, error) { o, err := d.Check(ctx, Health, s, c); return o.Healthy, err })
	}
	return errors.New("review_options")
}

const apiHealthScript = `const h=require('node:http');const r=h.get('http://127.0.0.1:3001/api/v1/health/ready',x=>{let b='';x.on('data',c=>{b+=c;if(b.length>4096)process.exit(1)});x.on('end',()=>{try{const j=JSON.parse(b);process.exit(x.statusCode===503&&j.database==='ready'&&j.authentication==='unavailable'?0:1)}catch{process.exit(1)}})});r.setTimeout(2000,()=>{r.destroy();process.exit(1)});r.on('error',()=>process.exit(1));`

func (d *Docker) panel(s State) bool {
	client := &http.Client{Timeout: 3 * time.Second, Transport: &http.Transport{Proxy: nil}, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	defer client.CloseIdleConnections()
	for _, path := range []string{"/", "/api/v1/health/ready", "/setup"} {
		res, err := client.Get("http://127.0.0.1:" + strconv.Itoa(s.Port) + path)
		if err != nil {
			return false
		}
		body, err := io.ReadAll(io.LimitReader(res.Body, 32769))
		res.Body.Close()
		if err != nil || len(body) > 32768 {
			return false
		}
		switch path {
		case "/":
			if res.StatusCode != 200 || !bytes.Contains(body, []byte("<!doctype html>")) {
				return false
			}
		case "/setup":
			if res.StatusCode != 503 {
				return false
			}
		default:
			var v struct{ Database, Authentication string }
			if json.Unmarshal(body, &v) != nil || res.StatusCode != 503 || v.Database != "ready" || v.Authentication != "unavailable" {
				return false
			}
		}
	}
	return true
}
