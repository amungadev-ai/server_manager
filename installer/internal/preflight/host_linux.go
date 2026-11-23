//go:build linux

package preflight

import (
	"errors"
	"io"
	"os"
	"runtime"
	"strings"
	"syscall"
)

// reader is deliberately unexported. Only tests inject roots; the CLI cannot.
type reader struct {
	read func(string, int64) ([]byte, error)
	stat func(string) (os.FileInfo, error)
	fs   func(string, *syscall.Statfs_t) error
	uid  int
	arch string
	cpus int
}

func boundedRead(path string, limit int64) ([]byte, error) {
	fd, err := syscall.Open(path, syscall.O_RDONLY|syscall.O_NONBLOCK|syscall.O_CLOEXEC, 0)
	if err != nil {
		return nil, err
	}
	f := os.NewFile(uintptr(fd), "observation")
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() {
		return nil, errObservation
	}
	data, err := io.ReadAll(io.LimitReader(f, limit+1))
	if err != nil || int64(len(data)) > limit {
		return nil, errObservation
	}
	return data, nil
}

func Collect() Report {
	h := reader{boundedRead, os.Lstat, syscall.Statfs, os.Geteuid(), runtime.GOARCH, runtime.NumCPU()}
	return Evaluate(h.collect())
}

func (h reader) collect() Evidence {
	e := Evidence{Arch: h.arch, Root: h.uid == 0, MarkersKnown: true, HostKnown: true, StorageSafe: true}
	osData, osErr := h.read("/etc/os-release", 65536)
	id, version, parseErr := ParseOS(osData)
	e.OSID, e.OSVersion, e.OSKnown = id, version, osErr == nil && parseErr == nil
	pid1, pidErr := h.read("/proc/1/comm", 128)
	info, systemdErr := h.stat("/run/systemd/system")
	e.Systemd = pidErr == nil && strings.TrimSpace(string(pid1)) == "systemd" && systemdErr == nil && info.IsDir() && info.Mode()&os.ModeSymlink == 0
	if pidErr != nil || (systemdErr != nil && !errors.Is(systemdErr, os.ErrNotExist)) {
		e.HostKnown = false
	}
	for _, path := range []string{"/.dockerenv", "/run/.containerenv", "/run/systemd/container"} {
		_, err := h.stat(path)
		if err == nil {
			e.Container = true
		} else if !errors.Is(err, os.ErrNotExist) {
			e.HostKnown = false
		}
	}
	data, memErr := h.read("/proc/meminfo", 65536)
	mem, parseErr := ParseMemory(data)
	e.Resources = mem
	e.Resources.LogicalCPUs = h.cpus
	var disk syscall.Statfs_t
	diskErr := h.fs("/var/lib", &disk)
	diskOK := diskErr == nil && disk.Bsize > 0 && disk.Bavail > 0 && disk.Ffree > 0 && disk.Bavail <= ^uint64(0)/uint64(disk.Bsize)
	if diskOK {
		e.Resources.DataFreeBytes = disk.Bavail * uint64(disk.Bsize)
		e.Resources.DataFreeInodes = disk.Ffree
	}
	e.ResourcesKnown = memErr == nil && parseErr == nil && h.cpus > 0 && diskOK
	controllers, controllerErr := h.read("/sys/fs/cgroup/cgroup.controllers", 4096)
	fields := strings.Fields(string(controllers))
	set := map[string]bool{}
	for _, field := range fields {
		set[field] = true
	}
	e.CgroupV2 = controllerErr == nil && set["cpu"] && set["memory"] && set["pids"]
	for _, path := range []string{"/etc", "/var/lib", "/var/log", "/run", "/opt"} {
		info, err := h.stat(path)
		var fs syscall.Statfs_t
		if err != nil {
			e.StorageSafe = false
			continue
		}
		owner, ok := info.Sys().(*syscall.Stat_t)
		if !ok || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm()&0022 != 0 || owner.Uid != 0 || h.fs(path, &fs) != nil || fs.Flags&1 != 0 {
			e.StorageSafe = false
		}
	}
	groups := []struct {
		paths  []string
		target *bool
	}{
		{[]string{"/etc/cloudlane", "/var/lib/cloudlane", "/var/log/cloudlane", "/run/cloudlane", "/opt/cloudlane", "/run/lock/cloudlane-installer.lock"}, &e.Existing},
		{[]string{"/etc/caddy", "/etc/nginx", "/etc/apache2"}, &e.Proxy},
		{[]string{"/run/docker.sock", "/etc/docker", "/var/lib/docker", "/usr/bin/docker", "/usr/local/bin/docker", "/usr/bin/dockerd", "/etc/containerd", "/var/lib/containerd", "/run/containerd/containerd.sock"}, &e.Runtime},
	}
	for _, group := range groups {
		for _, path := range group.paths {
			_, err := h.stat(path)
			if err == nil {
				*group.target = true
			} else if !errors.Is(err, os.ErrNotExist) {
				e.MarkersKnown = false
			}
		}
	}
	e.PortsKnown = true
	for _, table := range []struct {
		path, protocol string
		ipv6           bool
	}{
		{"/proc/net/tcp", "tcp", false}, {"/proc/net/tcp6", "tcp", true},
		{"/proc/net/udp", "udp", false}, {"/proc/net/udp6", "udp", true},
	} {
		data, err := h.read(table.path, 1<<20)
		sockets, parseErr := ParseSockets(data, table.protocol, table.ipv6)
		if err != nil || parseErr != nil {
			e.PortsKnown = false
			continue
		}
		e.Sockets = append(e.Sockets, sockets...)
	}
	return e
}
