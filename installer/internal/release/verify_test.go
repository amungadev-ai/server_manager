package release

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"
)

type fixture struct {
	request  Request
	manifest Manifest
	private  ed25519.PrivateKey
	now      time.Time
}

func put(t *testing.T, p string, b []byte) {
	t.Helper()
	if err := os.WriteFile(p, b, 0600); err != nil {
		t.Fatal(err)
	}
}
func (f fixture) sign(t *testing.T, b []byte) {
	t.Helper()
	put(t, f.request.ManifestPath, b)
	put(t, f.request.SignaturePath, ed25519.Sign(f.private, append([]byte(Prefix), b...)))
}
func (f fixture) encode(t *testing.T) {
	t.Helper()
	b, err := json.Marshal(f.manifest)
	if err != nil {
		t.Fatal(err)
	}
	f.sign(t, b)
}
func newFixture(t *testing.T) fixture {
	t.Helper()
	dir := t.TempDir()
	key, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	keyHash := sha256.Sum256(key)
	artifact := []byte("DEVELOPMENT TEST BYTES ONLY\n")
	hash := sha256.Sum256(artifact)
	now := time.Date(2026, 11, 23, 12, 0, 0, 0, time.UTC)
	m := Manifest{Schema: 1, Product: "cloudlane-installer", Version: "0.1.0", Platform: "linux-amd64", Filename: "cloudlane-installer_0.1.0_linux_amd64", SHA256: hex.EncodeToString(hash[:]), Size: int64(len(artifact)), IssuedAt: now.Add(-time.Hour).Format(time.RFC3339), ExpiresAt: now.Add(time.Hour).Format(time.RFC3339)}
	r := Request{ManifestPath: filepath.Join(dir, "manifest.json"), SignaturePath: filepath.Join(dir, "manifest.sig"), ArtifactPath: filepath.Join(dir, m.Filename), KeyPath: filepath.Join(dir, "test-only.pub"), KeySHA256: hex.EncodeToString(keyHash[:]), Version: m.Version}
	put(t, r.KeyPath, key)
	put(t, r.ArtifactPath, artifact)
	f := fixture{r, m, private, now}
	f.encode(t)
	return f
}

func TestValidExactBytesAuthenticateOnlyLocalArtifact(t *testing.T) {
	f := newFixture(t)
	before := map[string]string{}
	for _, p := range []string{f.request.ManifestPath, f.request.SignaturePath, f.request.KeyPath, f.request.ArtifactPath} {
		b, _ := os.ReadFile(p)
		before[p] = string(b)
	}
	r, err := Verify(f.request, f.now)
	if err != nil || !r.Verified || r.Scope != "offline-artifact-only" || r.ReadyToInstall {
		t.Fatal(r, err)
	}
	for p, expected := range before {
		b, _ := os.ReadFile(p)
		if string(b) != expected {
			t.Fatal("verification mutated input")
		}
	}
	// Whitespace is permitted but is authenticated as bytes, including the newline.
	b, _ := json.MarshalIndent(f.manifest, "", "  ")
	f.sign(t, append(b, '\n'))
	if _, err := Verify(f.request, f.now); err != nil {
		t.Fatal(err)
	}
}

func TestExplicitPinsCannotBeOmittedOrSubstituted(t *testing.T) {
	for _, tc := range []struct {
		name   string
		change func(*fixture)
	}{
		{"missingKeyPin", func(f *fixture) { f.request.KeySHA256 = "" }},
		{"wrongKeyPin", func(f *fixture) { f.request.KeySHA256 = strings.Repeat("0", 64) }},
		{"uppercaseKeyPin", func(f *fixture) { f.request.KeySHA256 = strings.ToUpper(f.request.KeySHA256) }},
		{"missingVersion", func(f *fixture) { f.request.Version = "" }},
		{"mutableVersion", func(f *fixture) { f.request.Version = "latest" }},
		{"paddedVersion", func(f *fixture) { f.request.Version = "00.1.0" }},
		{"wrongVersion", func(f *fixture) { f.request.Version = "0.2.0" }},
		{"keySubstitution", func(f *fixture) { key, _, _ := ed25519.GenerateKey(rand.Reader); put(t, f.request.KeyPath, key) }},
		{"shortKey", func(f *fixture) { put(t, f.request.KeyPath, []byte("test")) }},
		{"largeKey", func(f *fixture) { put(t, f.request.KeyPath, make([]byte, 33)) }},
		{"missingArtifact", func(f *fixture) { f.request.ArtifactPath = "" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newFixture(t)
			tc.change(&f)
			if _, err := Verify(f.request, f.now); err == nil {
				t.Fatal("accepted invalid pin")
			}
		})
	}
}

func TestSignatureAndPayloadTampering(t *testing.T) {
	for _, tc := range []struct {
		name   string
		change func(*testing.T, fixture)
	}{
		{"manifestByte", func(t *testing.T, f fixture) {
			b, _ := os.ReadFile(f.request.ManifestPath)
			put(t, f.request.ManifestPath, append(b, ' '))
		}},
		{"missingPrefix", func(t *testing.T, f fixture) {
			b, _ := os.ReadFile(f.request.ManifestPath)
			put(t, f.request.SignaturePath, ed25519.Sign(f.private, b))
		}},
		{"wrongDomain", func(t *testing.T, f fixture) {
			b, _ := os.ReadFile(f.request.ManifestPath)
			put(t, f.request.SignaturePath, ed25519.Sign(f.private, append([]byte("AGENT\n"), b...)))
		}},
		{"shortSignature", func(t *testing.T, f fixture) { put(t, f.request.SignaturePath, make([]byte, 63)) }},
		{"largeSignature", func(t *testing.T, f fixture) { put(t, f.request.SignaturePath, make([]byte, 65)) }},
		{"artifactChanged", func(t *testing.T, f fixture) {
			put(t, f.request.ArtifactPath, []byte(strings.Repeat("x", int(f.manifest.Size))))
		}},
		{"artifactTruncated", func(t *testing.T, f fixture) { put(t, f.request.ArtifactPath, []byte("x")) }},
		{"artifactExtended", func(t *testing.T, f fixture) {
			b, _ := os.ReadFile(f.request.ArtifactPath)
			put(t, f.request.ArtifactPath, append(b, 'x'))
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newFixture(t)
			tc.change(t, f)
			if _, err := Verify(f.request, f.now); err == nil {
				t.Fatal("accepted altered bytes")
			}
		})
	}
}

func TestCallerCannotRenameAnAuthenticatedArtifact(t *testing.T) {
	f := newFixture(t)
	newPath := filepath.Join(filepath.Dir(f.request.ArtifactPath), "wrong-name")
	if err := os.Rename(f.request.ArtifactPath, newPath); err != nil {
		t.Fatal(err)
	}
	f.request.ArtifactPath = newPath
	if _, err := Verify(f.request, f.now); err == nil {
		t.Fatal("accepted wrong artifact filename")
	}
}

func TestAuthenticatedMetadataStillMustMeetPolicy(t *testing.T) {
	for _, tc := range []struct {
		name   string
		change func(*fixture)
	}{
		{"schema", func(f *fixture) { f.manifest.Schema = 2 }},
		{"product", func(f *fixture) { f.manifest.Product = "other" }},
		{"platform", func(f *fixture) { f.manifest.Platform = "linux-arm64" }},
		{"version", func(f *fixture) { f.manifest.Version = "0.0.9" }},
		{"filenameTraversal", func(f *fixture) { f.manifest.Filename = "../" + f.manifest.Filename }},
		{"filenameURL", func(f *fixture) { f.manifest.Filename = "https://untrusted/installer" }},
		{"emptyHash", func(f *fixture) { f.manifest.SHA256 = "" }},
		{"uppercaseHash", func(f *fixture) { f.manifest.SHA256 = strings.ToUpper(f.manifest.SHA256) }},
		{"zeroSize", func(f *fixture) { f.manifest.Size = 0 }},
		{"negativeSize", func(f *fixture) { f.manifest.Size = -1 }},
		{"largeSize", func(f *fixture) { f.manifest.Size = MaxArtifactSize + 1 }},
		{"future", func(f *fixture) { f.manifest.IssuedAt = f.now.Add(6 * time.Minute).Format(time.RFC3339) }},
		{"expired", func(f *fixture) { f.manifest.ExpiresAt = f.now.Format(time.RFC3339) }},
		{"backwardsLifetime", func(f *fixture) { f.manifest.ExpiresAt = f.manifest.IssuedAt }},
		{"longLifetime", func(f *fixture) { f.manifest.ExpiresAt = f.now.Add(31 * 24 * time.Hour).Format(time.RFC3339) }},
		{"offsetTime", func(f *fixture) { f.manifest.IssuedAt = "2026-11-23T11:00:00+00:00" }},
		{"fractionalTime", func(f *fixture) { f.manifest.IssuedAt = "2026-11-23T11:00:00.1Z" }},
		{"invalidTime", func(f *fixture) { f.manifest.IssuedAt = "SECRET invalid time" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newFixture(t)
			tc.change(&f)
			f.encode(t)
			_, err := Verify(f.request, f.now)
			if err == nil || strings.Contains(err.Error(), "SECRET") {
				t.Fatal("metadata accepted/leaked", err)
			}
		})
	}
}

func TestStrictSignedManifestParsing(t *testing.T) {
	for _, tc := range []struct {
		name   string
		change func(string) string
	}{
		{"duplicate", func(b string) string { return strings.Replace(b, `"schema":1`, `"schema":1,"schema":1`, 1) }},
		{"escapedDuplicate", func(b string) string { return strings.Replace(b, `"schema":1`, `"schema":1,"\u0073chema":1`, 1) }},
		{"unknown", func(b string) string { return strings.Replace(b, `"schema":1`, `"schema":1,"url":"SECRET"`, 1) }},
		{"null", func(b string) string { return strings.Replace(b, `"version":"0.1.0"`, `"version":null`, 1) }},
		{"missing", func(b string) string { return strings.Replace(b, `"schema":1,`, "", 1) }},
		{"wrongType", func(b string) string { return strings.Replace(b, `"schema":1`, `"schema":"1"`, 1) }},
		{"nested", func(b string) string { return strings.Replace(b, `"schema":1`, `"schema":{"a":1}`, 1) }},
		{"trailing", func(b string) string { return b + " {}" }},
		{"broken", func(b string) string { return b[:len(b)-1] }},
		{"array", func(b string) string { return "[" + b + "]" }},
		{"invalidUTF8", func(b string) string { return string([]byte{255}) + b }},
		{"oversize", func(b string) string { return b + strings.Repeat(" ", 16385) }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newFixture(t)
			b, _ := json.Marshal(f.manifest)
			f.sign(t, []byte(tc.change(string(b))))
			_, err := Verify(f.request, f.now)
			if err == nil || strings.Contains(err.Error(), "SECRET") {
				t.Fatal("signed malformed input accepted/leaked", err)
			}
		})
	}
}

func TestInputTypesDoNotBlockOrFollowFinalSymlinks(t *testing.T) {
	for _, kind := range []string{"symlink", "fifo", "directory", "missing"} {
		t.Run(kind, func(t *testing.T) {
			f := newFixture(t)
			path := f.request.ArtifactPath
			if err := os.Remove(path); err != nil {
				t.Fatal(err)
			}
			switch kind {
			case "symlink":
				if err := os.Symlink(f.request.KeyPath, path); err != nil {
					t.Fatal(err)
				}
			case "fifo":
				if err := syscall.Mkfifo(path, 0600); err != nil {
					t.Fatal(err)
				}
			case "directory":
				if err := os.Mkdir(path, 0700); err != nil {
					t.Fatal(err)
				}
			}
			if _, err := Verify(f.request, f.now); err == nil {
				t.Fatal("unsafe file type accepted")
			}
		})
	}
}
