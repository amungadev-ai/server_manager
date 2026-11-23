// Package release verifies local bytes only. It performs no download/execution.
package release

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"syscall"
	"time"
	"unicode/utf8"
)

const Prefix = "CLOUDLANE-RELEASE-MANIFEST-V1\n"
const MaxArtifactSize int64 = 128 << 20

var versionPattern = regexp.MustCompile(`^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$`)
var digestPattern = regexp.MustCompile(`^[a-f0-9]{64}$`)

type Manifest struct {
	Schema    int    `json:"schema"`
	Product   string `json:"product"`
	Version   string `json:"version"`
	Platform  string `json:"platform"`
	Filename  string `json:"filename"`
	SHA256    string `json:"sha256"`
	Size      int64  `json:"size"`
	IssuedAt  string `json:"issued_at"`
	ExpiresAt string `json:"expires_at"`
}

type Request struct {
	ManifestPath, SignaturePath, ArtifactPath, KeyPath string
	KeySHA256, Version                                 string
}

type Result struct {
	Schema         string `json:"schema"`
	Verified       bool   `json:"verified"`
	Scope          string `json:"scope"`
	Version        string `json:"version"`
	ArtifactSHA256 string `json:"artifact_sha256"`
	ReadyToInstall bool   `json:"ready_to_install"`
}

// Error codes never contain input, filenames, key material or OS exception text.
func fail(code string) error { return errors.New(code) }

// openRegular prevents FIFO/device blocking and rejects final-component symlinks.
// No claim is made that a caller-selected directory or subsequent execution is safe.
func openRegular(path string) (*os.File, error) {
	fd, err := syscall.Open(path, syscall.O_RDONLY|syscall.O_NOFOLLOW|syscall.O_NONBLOCK|syscall.O_CLOEXEC, 0)
	if err != nil {
		return nil, fail("input_unavailable")
	}
	f := os.NewFile(uintptr(fd), "input")
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() {
		f.Close()
		return nil, fail("input_not_regular")
	}
	return f, nil
}

func readInput(path string, limit int64) ([]byte, error) {
	f, err := openRegular(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	b, err := io.ReadAll(io.LimitReader(f, limit+1))
	if err != nil || int64(len(b)) > limit {
		return nil, fail("input_size")
	}
	return b, nil
}

func parseManifest(data []byte) (Manifest, error) {
	var m Manifest
	if len(data) == 0 || len(data) > 16384 || !utf8.Valid(data) {
		return m, fail("manifest_format")
	}
	// Inspect top-level raw values first: encoding/json otherwise accepts duplicate
	// names and null scalar fields. All values here must be scalar and non-null.
	d := json.NewDecoder(bytes.NewReader(data))
	token, err := d.Token()
	if err != nil || token != json.Delim('{') {
		return m, fail("manifest_format")
	}
	seen := map[string]bool{}
	allowed := map[string]bool{"schema": true, "product": true, "version": true, "platform": true, "filename": true, "sha256": true, "size": true, "issued_at": true, "expires_at": true}
	for d.More() {
		t, err := d.Token()
		key, ok := t.(string)
		if err != nil || !ok || !allowed[key] || seen[key] {
			return m, fail("manifest_fields")
		}
		seen[key] = true
		var raw json.RawMessage
		if err := d.Decode(&raw); err != nil || bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
			return m, fail("manifest_fields")
		}
	}
	if _, err := d.Token(); err != nil || len(seen) != len(allowed) {
		return m, fail("manifest_fields")
	}
	if err := d.Decode(new(any)); err != io.EOF {
		return m, fail("manifest_format")
	}
	if err := json.Unmarshal(data, &m); err != nil {
		return m, fail("manifest_format")
	}
	return m, nil
}

func Verify(r Request, now time.Time) (Result, error) {
	var result Result
	if r.ManifestPath == "" || r.SignaturePath == "" || r.ArtifactPath == "" || r.KeyPath == "" || !digestPattern.MatchString(r.KeySHA256) || !versionPattern.MatchString(r.Version) {
		return result, fail("explicit_pins_required")
	}
	key, err := readInput(r.KeyPath, ed25519.PublicKeySize)
	if err != nil || len(key) != ed25519.PublicKeySize {
		return result, fail("trusted_key_input")
	}
	keyDigest := sha256.Sum256(key)
	if hex.EncodeToString(keyDigest[:]) != r.KeySHA256 {
		return result, fail("trusted_key_mismatch")
	}
	data, err := readInput(r.ManifestPath, 16384)
	if err != nil {
		return result, fail("manifest_input")
	}
	sig, err := readInput(r.SignaturePath, ed25519.SignatureSize)
	if err != nil || len(sig) != ed25519.SignatureSize || !ed25519.Verify(ed25519.PublicKey(key), append([]byte(Prefix), data...), sig) {
		return result, fail("signature_invalid")
	}
	m, err := parseManifest(data)
	if err != nil {
		return result, err
	}
	if m.Schema != 1 || m.Product != "cloudlane-installer" || m.Platform != "linux-amd64" {
		return result, fail("manifest_target")
	}
	if !versionPattern.MatchString(m.Version) || m.Version != r.Version {
		return result, fail("version_mismatch")
	}
	expectedName := "cloudlane-installer_" + r.Version + "_linux_amd64"
	if m.Filename != expectedName || filepath.Base(r.ArtifactPath) != expectedName {
		return result, fail("filename_mismatch")
	}
	if !digestPattern.MatchString(m.SHA256) || m.Size <= 0 || m.Size > MaxArtifactSize {
		return result, fail("artifact_metadata")
	}
	issued, ie := time.Parse(time.RFC3339, m.IssuedAt)
	expires, ee := time.Parse(time.RFC3339, m.ExpiresAt)
	if ie != nil || ee != nil || issued.UTC().Format(time.RFC3339) != m.IssuedAt || expires.UTC().Format(time.RFC3339) != m.ExpiresAt || !expires.After(issued) || expires.Sub(issued) > 30*24*time.Hour || !now.Before(expires) || issued.After(now.Add(5*time.Minute)) {
		return result, fail("manifest_time")
	}
	f, err := openRegular(r.ArtifactPath)
	if err != nil {
		return result, fail("artifact_input")
	}
	defer f.Close()
	hash := sha256.New()
	n, err := io.Copy(hash, io.LimitReader(f, m.Size+1))
	if err != nil || n != m.Size || hex.EncodeToString(hash.Sum(nil)) != m.SHA256 {
		return result, fail("artifact_mismatch")
	}
	return Result{Schema: "cloudlane.release-verification.v1", Verified: true, Scope: "offline-artifact-only", Version: m.Version, ArtifactSHA256: m.SHA256}, nil
}
