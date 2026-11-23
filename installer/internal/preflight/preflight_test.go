package preflight

import (
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"
)

const memoryFixture = "MemTotal: 2097152 kB\nMemAvailable: 1048576 kB\nSwapTotal: 0 kB\nSwapFree: 0 kB\n"
const socketHeader = "  sl local_address rem_address st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode\n"

func socketRow(local string) string {
	return "0: " + local + " 00000000:0000 0A 00000000:00000000 00:00000000 00000000 0 0 1\n"
}
func goodEvidence() Evidence {
	return Evidence{OSID: "ubuntu", OSVersion: "24.04", Arch: "amd64", OSKnown: true, Systemd: true, HostKnown: true, Root: true, Resources: Resources{LogicalCPUs: 2, MemoryTotal: 2 << 30, MemoryAvailable: 1 << 30, DataFreeBytes: 20 << 30, DataFreeInodes: 100}, ResourcesKnown: true, CgroupV2: true, PortsKnown: true, StorageSafe: true, MarkersKnown: true}
}
func status(r Report, id string) string {
	for _, c := range r.Checks {
		if c.ID == id {
			return c.Status
		}
	}
	return "missing"
}

func TestCleanSnapshotIsNeverInstallAuthorization(t *testing.T) {
	r := Evaluate(goodEvidence())
	if r.Status != "incomplete" || r.ReadyToInstall {
		t.Fatalf("incorrect clean snapshot: %+v", r)
	}
	for _, id := range []string{"capacity_profile", "network", "installation_safety"} {
		if status(r, id) != "deferred" {
			t.Fatal(id)
		}
	}
}

func TestMandatoryUnknownsAndConflictsBlock(t *testing.T) {
	for _, tc := range []struct {
		name, id string
		change   func(*Evidence)
	}{
		{"ubuntu22", "os", func(e *Evidence) { e.OSVersion = "22.04" }},
		{"otherOS", "os", func(e *Evidence) { e.OSID = "debian" }},
		{"missingOS", "os", func(e *Evidence) { e.OSKnown = false }},
		{"arm64", "architecture", func(e *Evidence) { e.Arch = "arm64" }},
		{"noSystemd", "host", func(e *Evidence) { e.Systemd = false }},
		{"unknownHost", "host", func(e *Evidence) { e.HostKnown = false }},
		{"container", "host", func(e *Evidence) { e.Container = true }},
		{"unknownResources", "resources", func(e *Evidence) { e.ResourcesKnown = false }},
		{"noCgroup", "cgroup", func(e *Evidence) { e.CgroupV2 = false }},
		{"storage", "storage", func(e *Evidence) { e.StorageSafe = false }},
		{"markers", "markers", func(e *Evidence) { e.MarkersKnown = false }},
		{"existingIdentity", "installation", func(e *Evidence) { e.Existing = true }},
		{"proxy", "proxy", func(e *Evidence) { e.Proxy = true }},
		{"docker", "runtime", func(e *Evidence) { e.Runtime = true }},
		{"unknownPorts", "port_evidence", func(e *Evidence) { e.PortsKnown = false }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			e := goodEvidence()
			tc.change(&e)
			r := Evaluate(e)
			if r.Status != "blocked" || status(r, tc.id) != "block" || r.ReadyToInstall {
				t.Fatal(r)
			}
		})
	}
}

func TestProvisionalFloorsAndNonRootAreHonest(t *testing.T) {
	e := goodEvidence()
	e.Root = false
	e.Resources.MemoryTotal = 900 << 20
	e.Resources.DataFreeBytes = 9 << 30
	r := Evaluate(e)
	if status(r, "privilege") != "deferred" || status(r, "provisional_floor") != "warn" || r.ReadyToInstall {
		t.Fatal(r)
	}
}

func TestReservedBindingsAreDeduplicatedSortedAndDoNotTouchSSH(t *testing.T) {
	e := goodEvidence()
	e.Sockets = []Socket{{"udp", 443}, {"tcp", 443}, {"tcp", 80}, {"tcp", 80}, {"tcp", 22}, {"udp", 80}}
	r := Evaluate(e)
	var ids []string
	for _, c := range r.Checks {
		if strings.HasPrefix(c.ID, "port_") && c.ID != "port_evidence" {
			ids = append(ids, c.ID)
		}
	}
	if strings.Join(ids, ",") != "port_tcp_80,port_tcp_443,port_udp_443" || r.Status != "blocked" {
		t.Fatal(ids, r)
	}
}

func TestOSParser(t *testing.T) {
	for _, data := range []string{"ID=ubuntu\nVERSION_ID=24.04\n", "NAME=Ubuntu Linux\nID=\"ubuntu\"\nVERSION_ID='24.04'\n"} {
		id, v, err := ParseOS([]byte(data))
		if err != nil || id != "ubuntu" || v != "24.04" {
			t.Fatal(id, v, err)
		}
	}
	for _, data := range []string{"", "ID=ubuntu\n", "ID=ubuntu\nID=ubuntu\nVERSION_ID=24.04", "ID=$(SECRET)\nVERSION_ID=24.04", "ID=\"ubuntu\nVERSION_ID=24.04", "ID=ubuntu\nVERSION_ID=24.04\rBAD", string([]byte{255}), strings.Repeat("x", 65537)} {
		if _, _, err := ParseOS([]byte(data)); err == nil {
			t.Fatalf("accepted malformed OS fixture")
		}
	}
}

func TestMemoryParser(t *testing.T) {
	m, err := ParseMemory([]byte(memoryFixture))
	if err != nil || m.MemoryTotal != 2<<30 || m.SwapTotal != 0 {
		t.Fatal(m, err)
	}
	for _, data := range []string{
		"", strings.Replace(memoryFixture, " kB", " MB", 1), memoryFixture + "MemTotal: 4 kB\n",
		strings.Replace(memoryFixture, "2097152", "18446744073709551615", 1), strings.Replace(memoryFixture, "2097152", "-1", 1),
		strings.Replace(memoryFixture, "2097152", "0", 1), strings.Replace(memoryFixture, "1048576", "0", 1), strings.Replace(memoryFixture, "1048576", "9999999", 1),
		strings.Replace(memoryFixture, "SwapFree: 0", "SwapFree: 1", 1), strings.Replace(memoryFixture, "SwapFree: 0 kB\n", "", 1), strings.Repeat("x", 65537),
	} {
		if _, err := ParseMemory([]byte(data)); err == nil {
			t.Fatal("accepted malformed memory fixture")
		}
	}
}

func TestSocketParserIPv4AndIPv6(t *testing.T) {
	for _, v6 := range []bool{false, true} {
		addr := "00000000"
		if v6 {
			addr = strings.Repeat("0", 32)
		}
		row := socketRow(addr + ":01BB")
		if v6 {
			row = strings.Replace(row, "00000000:0000", addr+":0000", 1)
		}
		for _, p := range []string{"tcp", "udp"} {
			sockets, err := ParseSockets([]byte(socketHeader+row), p, v6)
			if err != nil || len(sockets) != 1 || sockets[0] != (Socket{p, 443}) {
				t.Fatal(sockets, err)
			}
		}
	}
	for _, data := range []string{"", "bad header\n", socketHeader + "bad row", socketHeader + socketRow("NOTHEX00:0050"), socketHeader + socketRow("00000000:XXXXX"), socketHeader + strings.Replace(socketRow("00000000:0050"), " 0A ", " ZZ ", 1), strings.Repeat("x", (1<<20)+1)} {
		if _, err := ParseSockets([]byte(data), "tcp", false); err == nil {
			t.Fatal("accepted malformed socket fixture")
		}
	}
	if _, err := ParseSockets([]byte(socketHeader), "shell", false); err == nil {
		t.Fatal("accepted protocol")
	}
}

type fileInfo struct {
	mode os.FileMode
	uid  uint32
}

func (f fileInfo) Name() string       { return "metadata" }
func (f fileInfo) Size() int64        { return 0 }
func (f fileInfo) Mode() os.FileMode  { return f.mode }
func (f fileInfo) ModTime() time.Time { return time.Time{} }
func (f fileInfo) IsDir() bool        { return f.mode.IsDir() }
func (f fileInfo) Sys() any           { return &syscall.Stat_t{Uid: f.uid} }

func fakeHost() (reader, map[string][]byte, map[string]os.FileInfo) {
	files := map[string][]byte{"/etc/os-release": []byte("ID=ubuntu\nVERSION_ID=24.04"), "/proc/1/comm": []byte("systemd\n"), "/proc/meminfo": []byte(memoryFixture), "/sys/fs/cgroup/cgroup.controllers": []byte("cpu memory pids io")}
	for _, p := range []string{"tcp", "tcp6", "udp", "udp6"} {
		files["/proc/net/"+p] = []byte(socketHeader)
	}
	metadata := map[string]os.FileInfo{}
	for _, p := range []string{"/etc", "/var/lib", "/var/log", "/run", "/opt", "/run/systemd/system"} {
		metadata[p] = fileInfo{os.ModeDir | 0755, 0}
	}
	h := reader{arch: "amd64", cpus: 2, uid: 0,
		read: func(p string, n int64) ([]byte, error) {
			b, ok := files[p]
			if !ok {
				return nil, os.ErrNotExist
			}
			if int64(len(b)) > n {
				return nil, errObservation
			}
			return b, nil
		},
		stat: func(p string) (os.FileInfo, error) {
			f, ok := metadata[p]
			if !ok {
				return nil, os.ErrNotExist
			}
			return f, nil
		},
		fs: func(_ string, s *syscall.Statfs_t) error {
			s.Bsize = 4096
			s.Bavail = 10 << 20
			s.Ffree = 100
			return nil
		},
	}
	return h, files, metadata
}

func TestCollectorUsesOnlyBoundedFixedReadsAndMetadata(t *testing.T) {
	h, _, _ := fakeHost()
	original := h.read
	h.read = func(path string, n int64) ([]byte, error) {
		if strings.Contains(path, "cloudlane") || strings.Contains(path, "docker") || strings.Contains(path, "caddy") {
			t.Fatal("read sensitive state contents")
		}
		if n <= 0 || n > 1<<20 {
			t.Fatal("unbounded read")
		}
		return original(path, n)
	}
	r := Evaluate(h.collect())
	if r.Status != "incomplete" || r.ReadyToInstall {
		t.Fatal(r)
	}
}

func TestCollectorFailsClosedOnMissingAndMalformedObservations(t *testing.T) {
	for _, path := range []string{"/etc/os-release", "/proc/1/comm", "/proc/meminfo", "/sys/fs/cgroup/cgroup.controllers", "/proc/net/tcp", "/proc/net/tcp6", "/proc/net/udp", "/proc/net/udp6"} {
		t.Run(path, func(t *testing.T) {
			h, files, _ := fakeHost()
			delete(files, path)
			if Evaluate(h.collect()).Status != "blocked" {
				t.Fatal("missing evidence accepted")
			}
			files[path] = []byte("SECRET-malformed")
			r := Evaluate(h.collect())
			b, _ := json.Marshal(r)
			if r.Status != "blocked" || strings.Contains(string(b), "SECRET") {
				t.Fatal("malformed evidence leaked/accepted")
			}
		})
	}
}

func TestCollectorPreservesAllExistingStateMarkers(t *testing.T) {
	for _, path := range []string{"/etc/cloudlane", "/var/lib/cloudlane", "/var/log/cloudlane", "/run/cloudlane", "/opt/cloudlane", "/run/lock/cloudlane-installer.lock", "/etc/nginx", "/etc/apache2", "/etc/caddy", "/run/docker.sock", "/etc/docker", "/var/lib/docker", "/usr/bin/docker", "/usr/local/bin/docker", "/usr/bin/dockerd", "/etc/containerd", "/var/lib/containerd", "/run/containerd/containerd.sock", "/.dockerenv", "/run/.containerenv", "/run/systemd/container"} {
		t.Run(path, func(t *testing.T) {
			h, _, metadata := fakeHost()
			metadata[path] = fileInfo{os.ModeSymlink | 0777, 0}
			if Evaluate(h.collect()).Status != "blocked" {
				t.Fatal("marker was ignored")
			}
		})
	}
}

func TestCollectorUnsafeStorageAndUnavailableMarkers(t *testing.T) {
	for _, tc := range []struct {
		name   string
		change func(*reader, map[string]os.FileInfo)
	}{
		{"worldWritable", func(_ *reader, m map[string]os.FileInfo) { m["/opt"] = fileInfo{os.ModeDir | 0777, 0} }},
		{"nonRootOwner", func(_ *reader, m map[string]os.FileInfo) { m["/etc"] = fileInfo{os.ModeDir | 0755, 1000} }},
		{"symlinkParent", func(_ *reader, m map[string]os.FileInfo) { m["/var/lib"] = fileInfo{os.ModeSymlink | 0755, 0} }},
		{"unreadableMarker", func(h *reader, _ map[string]os.FileInfo) {
			old := h.stat
			h.stat = func(p string) (os.FileInfo, error) {
				if p == "/etc/cloudlane" {
					return nil, os.ErrPermission
				}
				return old(p)
			}
		}},
		{"readOnly", func(h *reader, _ map[string]os.FileInfo) {
			old := h.fs
			h.fs = func(p string, s *syscall.Statfs_t) error { err := old(p, s); s.Flags = 1; return err }
		}},
		{"unavailableFS", func(h *reader, _ map[string]os.FileInfo) {
			h.fs = func(string, *syscall.Statfs_t) error { return errors.New("SECRET") }
		}},
		{"fullDisk", func(h *reader, _ map[string]os.FileInfo) {
			h.fs = func(_ string, s *syscall.Statfs_t) error { s.Bsize = 4096; s.Ffree = 1; return nil }
		}},
		{"fullInodes", func(h *reader, _ map[string]os.FileInfo) {
			h.fs = func(_ string, s *syscall.Statfs_t) error { s.Bsize = 4096; s.Bavail = 100; return nil }
		}},
		{"overflow", func(h *reader, _ map[string]os.FileInfo) {
			h.fs = func(_ string, s *syscall.Statfs_t) error {
				s.Bsize = 4096
				s.Bavail = ^uint64(0)
				s.Ffree = 100
				return nil
			}
		}},
		{"zeroCPU", func(h *reader, _ map[string]os.FileInfo) { h.cpus = 0 }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h, _, m := fakeHost()
			tc.change(&h, m)
			r := Evaluate(h.collect())
			b, _ := json.Marshal(r)
			if r.Status != "blocked" || strings.Contains(string(b), "SECRET") {
				t.Fatal(r)
			}
		})
	}
}

func TestRealLinuxTCPAndUDPBindingsAreObserved(t *testing.T) {
	tcp, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer tcp.Close()
	udp, err := net.ListenPacket("udp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer udp.Close()
	for _, tc := range []struct {
		protocol string
		port     int
	}{{"tcp", tcp.Addr().(*net.TCPAddr).Port}, {"udp", udp.LocalAddr().(*net.UDPAddr).Port}} {
		data, err := boundedRead("/proc/net/"+tc.protocol, 1<<20)
		if err != nil {
			t.Fatal(err)
		}
		sockets, err := ParseSockets(data, tc.protocol, false)
		if err != nil {
			t.Fatal(err)
		}
		found := false
		for _, s := range sockets {
			if s.Port == uint16(tc.port) {
				found = true
			}
		}
		if !found {
			t.Fatal(fmt.Sprintf("real %s binding not observed", tc.protocol))
		}
	}
}

func TestBoundedReadRejectsOversizeAndFIFOWithoutBlocking(t *testing.T) {
	path := filepath.Join(t.TempDir(), "observation")
	if err := os.WriteFile(path, []byte("12345"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := boundedRead(path, 4); err == nil {
		t.Fatal("unbounded read")
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err := syscall.Mkfifo(path, 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := boundedRead(path, 4); err == nil {
		t.Fatal("FIFO observation accepted")
	}
}
