package preflight

import (
	"errors"
	"strconv"
	"strings"
	"unicode/utf8"
)

var errObservation = errors.New("invalid host observation")

func ParseOS(data []byte) (string, string, error) {
	if len(data) == 0 || len(data) > 65536 || !utf8.Valid(data) {
		return "", "", errObservation
	}
	values := map[string]string{}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok || k == "" {
			return "", "", errObservation
		}
		if k != "ID" && k != "VERSION_ID" {
			continue
		}
		if _, exists := values[k]; exists {
			return "", "", errObservation
		}
		if len(v) >= 2 && ((v[0] == '"' && v[len(v)-1] == '"') || (v[0] == '\'' && v[len(v)-1] == '\'')) {
			v = v[1 : len(v)-1]
		}
		if v == "" || strings.ContainsAny(v, "\"'\\$`\r\t ") {
			return "", "", errObservation
		}
		values[k] = v
	}
	if values["ID"] == "" || values["VERSION_ID"] == "" {
		return "", "", errObservation
	}
	return values["ID"], values["VERSION_ID"], nil
}

func ParseMemory(data []byte) (Resources, error) {
	var r Resources
	if len(data) == 0 || len(data) > 65536 {
		return r, errObservation
	}
	values := map[string]uint64{}
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}
		key := fields[0]
		if key != "MemTotal:" && key != "MemAvailable:" && key != "SwapTotal:" && key != "SwapFree:" {
			continue
		}
		if _, exists := values[key]; exists || len(fields) != 3 || fields[2] != "kB" {
			return r, errObservation
		}
		n, err := strconv.ParseUint(fields[1], 10, 64)
		if err != nil || n > ^uint64(0)/1024 {
			return r, errObservation
		}
		values[key] = n * 1024
	}
	if len(values) != 4 || values["MemTotal:"] == 0 || values["MemAvailable:"] == 0 || values["MemAvailable:"] > values["MemTotal:"] || values["SwapFree:"] > values["SwapTotal:"] {
		return r, errObservation
	}
	r.MemoryTotal, r.MemoryAvailable = values["MemTotal:"], values["MemAvailable:"]
	r.SwapTotal, r.SwapFree = values["SwapTotal:"], values["SwapFree:"]
	return r, nil
}

func socketAddress(s string, ipv6 bool) (uint16, error) {
	addr, port, ok := strings.Cut(s, ":")
	size := 8
	if ipv6 {
		size = 32
	}
	if !ok || len(addr) != size || len(port) != 4 {
		return 0, errObservation
	}
	for _, c := range addr + port {
		if !strings.ContainsRune("0123456789abcdefABCDEF", c) {
			return 0, errObservation
		}
	}
	n, err := strconv.ParseUint(port, 16, 16)
	return uint16(n), err
}

// ParseSockets returns only protocol/port, never IPs, UIDs, PIDs or process text.
// All bound local reserved ports are conservative conflicts, including TIME_WAIT.
func ParseSockets(data []byte, protocol string, ipv6 bool) ([]Socket, error) {
	if len(data) == 0 || len(data) > 1<<20 || (protocol != "tcp" && protocol != "udp") {
		return nil, errObservation
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	header := strings.Fields(lines[0])
	if len(header) < 4 || header[0] != "sl" || header[1] != "local_address" || (header[2] != "rem_address" && header[2] != "remote_address") || header[3] != "st" {
		return nil, errObservation
	}
	var sockets []Socket
	for _, line := range lines[1:] {
		if strings.TrimSpace(line) == "" {
			continue
		}
		f := strings.Fields(line)
		if len(f) < 10 || !strings.HasSuffix(f[0], ":") || len(f[3]) != 2 {
			return nil, errObservation
		}
		if _, err := strconv.ParseUint(strings.TrimSuffix(f[0], ":"), 10, 32); err != nil {
			return nil, errObservation
		}
		if _, err := strconv.ParseUint(f[3], 16, 8); err != nil {
			return nil, errObservation
		}
		port, err := socketAddress(f[1], ipv6)
		if err != nil {
			return nil, errObservation
		}
		if _, err := socketAddress(f[2], ipv6); err != nil {
			return nil, errObservation
		}
		if port != 0 {
			sockets = append(sockets, Socket{protocol, port})
		}
	}
	return sockets, nil
}
