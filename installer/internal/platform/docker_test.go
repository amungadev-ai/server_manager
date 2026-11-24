package platform

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

type runFunc func(context.Context, []string, []byte) ([]byte, error)

func (f runFunc) run(c context.Context, a []string, b []byte) ([]byte, error) { return f(c, a, b) }
func dockerFixture(t *testing.T) (*Docker, State, secrets, *containerInfo, map[string]string) {
	t.Helper()
	p := verifiedFixture(t)
	s := State{Instance: strings.Repeat("a", 32), PlanSHA256: p.Hash(), Version: p.Value().Version, Port: 18080}
	c := secrets{strings.Repeat("a", 64), strings.Repeat("b", 64), strings.Repeat("c", 64)}
	d, _ := NewDocker(t.TempDir(), p)
	image := imageInfo{ID: p.Value().DatabaseImage, OS: "linux", Architecture: "amd64"}
	image.Config.Entrypoint = []string{"docker-entrypoint.sh"}
	v := &containerInfo{ID: strings.Repeat("d", 64), Image: image.ID}
	v.Config.Labels = labels(s, "db")
	v.Config.User = "999:999"
	v.Config.Env = strings.Split(strings.TrimSpace(environments(c)["admin.env"]), "\n")
	v.Config.Entrypoint = image.Config.Entrypoint
	v.Config.Cmd = []string{"postgres", "-c", "listen_addresses=127.0.0.1", "-c", "log_statement=none", "-c", "log_min_error_statement=panic"}
	v.HostConfig.NetworkMode = Name(s, "control")
	v.HostConfig.ReadonlyRootfs = true
	v.HostConfig.CapDrop = []string{"ALL"}
	v.HostConfig.SecurityOpt = []string{"no-new-privileges"}
	v.HostConfig.Memory = 384 << 20
	v.HostConfig.MemorySwap = 384 << 20
	v.HostConfig.NanoCPUs = 1e9
	v.HostConfig.PidsLimit = 128
	v.HostConfig.RestartPolicy.Name = "no"
	v.HostConfig.LogConfig.Type = "local"
	v.HostConfig.LogConfig.Config = map[string]string{"max-size": "5m", "max-file": "2"}
	v.HostConfig.PortBindings = map[string][]portBinding{"8080/tcp": {{HostIP: "127.0.0.1", HostPort: "18080"}}}
	v.Mounts = []mountInfo{{Type: "volume", Name: Name(s, "data"), Destination: "/var/lib/postgresql", RW: true}}
	v.NetworkSettings.Networks = map[string]json.RawMessage{Name(s, "control"): json.RawMessage(`{}`)}
	v.State.Running = true
	volumeLabels := labels(s, "data")
	d.runner = runFunc(func(_ context.Context, args []string, _ []byte) ([]byte, error) {
		var out any
		switch args[0] + " " + args[1] {
		case "container inspect":
			out = v
		case "image inspect":
			out = image
		case "volume inspect":
			out = volumeInfo{Driver: "local", Labels: volumeLabels}
		default:
			return nil, nil
		}
		return json.Marshal([]any{out})
	})
	return d, s, c, v, volumeLabels
}
func TestDockerOwnedConfigurationIsRequiredBeforeReuse(t *testing.T) {
	d, s, c, _, _ := dockerFixture(t)
	if _, ok, err := d.container(context.Background(), s, "db", c); err != nil || !ok {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name   string
		change func(*containerInfo)
	}{
		{"foreign", func(v *containerInfo) { v.Config.Labels["com.cloudlane.review.instance"] = "other" }},
		{"hostNetwork", func(v *containerInfo) { v.HostConfig.NetworkMode = "host" }},
		{"rootUser", func(v *containerInfo) { v.Config.User = "0:0" }},
		{"privileged", func(v *containerInfo) { v.HostConfig.Privileged = true }},
		{"writableRoot", func(v *containerInfo) { v.HostConfig.ReadonlyRootfs = false }},
		{"addedCapability", func(v *containerInfo) { v.HostConfig.CapAdd = []string{"SYS_ADMIN"} }},
		{"missingDrop", func(v *containerInfo) { v.HostConfig.CapDrop = nil }},
		{"missingNNP", func(v *containerInfo) { v.HostConfig.SecurityOpt = nil }},
		{"hostPID", func(v *containerInfo) { v.HostConfig.PidMode = "host" }},
		{"bindMount", func(v *containerInfo) { v.HostConfig.Binds = []string{"/:/host"} }},
		{"hostDevice", func(v *containerInfo) { v.HostConfig.Devices = []json.RawMessage{json.RawMessage(`{}`)} }},
		{"publicPort", func(v *containerInfo) { v.HostConfig.PortBindings["8080/tcp"][0].HostIP = "0.0.0.0" }},
		{"extraPort", func(v *containerInfo) {
			v.HostConfig.PortBindings["5432/tcp"] = []portBinding{{HostIP: "127.0.0.1", HostPort: "5432"}}
		}},
		{"extraNetwork", func(v *containerInfo) { v.NetworkSettings.Networks["external"] = json.RawMessage(`{}`) }},
		{"hostFilesystem", func(v *containerInfo) { v.Mounts[0].Type = "bind" }},
		{"wrongVolume", func(v *containerInfo) { v.Mounts[0].Name = "unrelated" }},
		{"wrongImage", func(v *containerInfo) { v.Image = "sha256:" + strings.Repeat("f", 64) }},
		{"shellOverride", func(v *containerInfo) { v.Config.Entrypoint = []string{"sh", "-c"} }},
		{"changedCommand", func(v *containerInfo) { v.Config.Cmd = []string{"arbitrary"} }},
		{"changedCredential", func(v *containerInfo) { v.Config.Env[0] = "POSTGRES_USER=other" }},
		{"unboundedMemory", func(v *containerInfo) { v.HostConfig.Memory = 0 }},
		{"unboundedPIDs", func(v *containerInfo) { v.HostConfig.PidsLimit = 0 }},
		{"unboundedLogs", func(v *containerInfo) { v.HostConfig.LogConfig.Type = "json-file" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			d, s, c, v, _ := dockerFixture(t)
			tc.change(v)
			if _, _, err := d.container(context.Background(), s, "db", c); err == nil {
				t.Fatal("unsafe resource reused")
			}
		})
	}
}
func TestOwnedContainerCannotReuseForeignDataVolume(t *testing.T) {
	d, s, c, _, volumeLabels := dockerFixture(t)
	volumeLabels["com.cloudlane.review.plan"] = "other"
	if _, _, err := d.container(context.Background(), s, "db", c); err == nil {
		t.Fatal("foreign volume reused")
	}
}
func TestMissingInitializedDataIsNeverRecreated(t *testing.T) {
	d, s, c, _, _ := dockerFixture(t)
	s.DatabaseIdentity = "00000000-0000-0000-0000-000000000001"
	writes := 0
	d.runner = runFunc(func(_ context.Context, a []string, _ []byte) ([]byte, error) {
		if a[1] == "inspect" {
			return nil, errors.New("absent")
		}
		writes++
		return nil, nil
	})
	if _, err := d.Check(context.Background(), Database, s, c); err == nil || err.Error() != "database_data_missing" {
		t.Fatal(err)
	}
	if err := d.ensureVolume(context.Background(), s, "data"); err == nil || writes != 0 {
		t.Fatal("missing volume silently initialized")
	}
}
func TestFixedRoleSQLDoesNotPlacePasswordsInArguments(t *testing.T) {
	d, s, c, _, _ := dockerFixture(t)
	original := d.runner
	seenSQL := false
	d.runner = runFunc(func(ctx context.Context, a []string, b []byte) ([]byte, error) {
		for _, arg := range a {
			if strings.Contains(arg, c.admin) || strings.Contains(arg, c.migrator) || strings.Contains(arg, c.runtime) {
				t.Fatal("password in command argument")
			}
		}
		if len(b) > 0 {
			seenSQL = true
			if !strings.Contains(string(b), "IF NOT EXISTS") || strings.Contains(string(b), "ALTER ROLE") {
				t.Fatal("role password reset on retry")
			}
		}
		return original.run(ctx, a, b)
	})
	if err := d.Apply(context.Background(), Database, s, c); err != nil || !seenSQL {
		t.Fatal(err)
	}
}
func TestDockerOutputBufferIsBounded(t *testing.T) {
	var b boundedBuffer
	if _, err := b.Write(make([]byte, 1<<20)); err != nil {
		t.Fatal(err)
	}
	if _, err := b.Write([]byte("x")); err == nil {
		t.Fatal("output unbounded")
	}
}
