// Package preflight describes observations without authorizing host mutation.
package preflight

import (
	"fmt"
	"sort"
)

type Check struct {
	ID      string `json:"id"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

type Resources struct {
	LogicalCPUs     int    `json:"logical_cpus"`
	MemoryTotal     uint64 `json:"memory_total_bytes"`
	MemoryAvailable uint64 `json:"memory_available_bytes"`
	SwapTotal       uint64 `json:"swap_total_bytes"`
	SwapFree        uint64 `json:"swap_free_bytes"`
	DataFreeBytes   uint64 `json:"data_filesystem_available_bytes"`
	DataFreeInodes  uint64 `json:"data_filesystem_available_inodes"`
}

type Report struct {
	Schema         string    `json:"schema"`
	Status         string    `json:"status"`
	ReadyToInstall bool      `json:"ready_to_install"`
	Resources      Resources `json:"resources"`
	Checks         []Check   `json:"checks"`
}

type Socket struct {
	Protocol string
	Port     uint16
}

// Evidence is internal to collection/tests. No CLI accepts injected host facts.
type Evidence struct {
	OSID, OSVersion, Arch       string
	OSKnown, Systemd, HostKnown bool
	Container, Root             bool
	Resources                   Resources
	ResourcesKnown, CgroupV2    bool
	PortsKnown, StorageSafe     bool
	Sockets                     []Socket
	Existing, Proxy, Runtime    bool
	MarkersKnown                bool
}

func Evaluate(e Evidence) Report {
	r := Report{Schema: "cloudlane.preflight.v1", Status: "incomplete", Resources: e.Resources}
	add := func(id, status, message string) {
		r.Checks = append(r.Checks, Check{id, status, message})
		if status == "block" {
			r.Status = "blocked"
		}
	}
	check := func(id string, ok bool, pass, fail string) {
		if ok {
			add(id, "pass", pass)
		} else {
			add(id, "block", fail)
		}
	}
	check("os", e.OSKnown && e.OSID == "ubuntu" && e.OSVersion == "24.04", "Ubuntu 24.04 observed.", "Only Ubuntu 24.04 is a candidate; OS evidence is unsupported or unavailable.")
	check("architecture", e.Arch == "amd64", "x86_64 observed.", "Only Linux x86_64 is a candidate.")
	check("host", e.HostKnown && e.Systemd && !e.Container, "Systemd PID 1 observed; no known container marker.", "Systemd PID 1 is required; container or unavailable host evidence blocks fresh installation.")
	if e.Root {
		add("privilege", "pass", "Root observed; this command still performs no host changes.")
	} else {
		add("privilege", "deferred", "Read-only diagnostics run without root. Future host changes require explicit sudo and rechecks.")
	}
	check("resources", e.ResourcesKnown, "Resource counters observed; effective profile capacity remains unverified.", "Resource counters are missing, malformed, exhausted or unavailable.")
	if e.ResourcesKnown && (e.Resources.MemoryTotal < 1<<30 || e.Resources.DataFreeBytes < 10<<30) {
		add("provisional_floor", "warn", "Below the unverified 1 GiB RAM / 10 GiB data-disk reference; no capacity profile is certified.")
	}
	check("cgroup", e.CgroupV2, "Cgroup v2 cpu, memory and pids controllers observed.", "Required cgroup v2 controller evidence is unavailable.")
	check("storage", e.StorageSafe, "Fixed platform parent directories are root-owned, private from untrusted writes and writable mounts.", "Platform parent metadata is unavailable, unsafe, symbolic or on a read-only mount.")
	check("markers", e.MarkersKnown, "Fixed conflict paths inspected by metadata only.", "A fixed conflict path could not be inspected safely.")
	check("installation", !e.Existing, "No Cloudlane path marker observed.", "Existing Cloudlane state or lock path detected. Preserve identity; use future repair/upgrade, never fresh initialization.")
	check("proxy", !e.Proxy, "No known proxy configuration marker observed.", "Existing proxy configuration detected. Resolve explicitly; no service will be stopped or overwritten.")
	check("runtime", !e.Runtime, "No known Docker/containerd marker observed.", "Existing Docker/containerd detected. Compatibility, networks and firewall require explicit review; no daemon is contacted.")
	check("port_evidence", e.PortsKnown, "IPv4/IPv6 TCP/UDP binding tables observed in this network namespace.", "Port evidence is unavailable, malformed or exceeds the bounded snapshot. Fresh installation is blocked.")
	seen := map[Socket]bool{}
	for _, s := range e.Sockets {
		if (s.Protocol == "tcp" && (s.Port == 80 || s.Port == 443)) || (s.Protocol == "udp" && s.Port == 443) {
			seen[s] = true
		}
	}
	conflicts := make([]Socket, 0, len(seen))
	for s := range seen {
		conflicts = append(conflicts, s)
	}
	sort.Slice(conflicts, func(i, j int) bool {
		if conflicts[i].Protocol == conflicts[j].Protocol {
			return conflicts[i].Port < conflicts[j].Port
		}
		return conflicts[i].Protocol < conflicts[j].Protocol
	})
	for _, s := range conflicts {
		add(fmt.Sprintf("port_%s_%d", s.Protocol, s.Port), "block", fmt.Sprintf("%s port %d is bound. Resolve explicitly; SSH and other services are untouched.", s.Protocol, s.Port))
	}
	if e.PortsKnown && len(conflicts) == 0 {
		add("ports", "pass", "No reserved binding observed; repeat under the future install lock.")
	}
	add("capacity_profile", "deferred", "Benchmark effective CPU/cgroup/RAM/swap and all component/WAL/rollback/storage budgets on dedicated starter and standard VPS profiles.")
	add("network", "deferred", "Verify dedicated host/network namespace, public IPv4/IPv6 inbound reachability, DNS, repositories, ACME and actual firewall exposure on the target VPS.")
	add("installation_safety", "deferred", "Verify publisher/revocation/provenance, clock synchronization, private staging, protected lock/journal and postconditions before any privileged installation.")
	return r
}
