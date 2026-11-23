package main

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"cloudlane.local/installer/internal/preflight"
	"cloudlane.local/installer/internal/release"
)

func TestCLIRejectsMutationAndBypassCommandsWithoutEchoingInput(t *testing.T) {
	for _, args := range [][]string{{"install"}, {"repair"}, {"preflight", "--root", "SECRET"}, {"preflight", "--skip-checks"}, {"preflight", "--force"}, {"preflight", "--format", "SECRET"}, {"preflight", "SECRET"}, {"verify", "--version", "latest"}, {"verify", "--bad=SECRET"}, {"SECRET-command"}, {"version", "SECRET"}, {"help", "SECRET"}} {
		var out, stderr bytes.Buffer
		if run(args, &out, &stderr) != 1 || strings.Contains(out.String()+stderr.String(), "SECRET") {
			t.Fatal("invalid invocation accepted/leaked")
		}
	}
}

func TestCLIVerifiesSignedLocalArtifactAndRejectsChangedBytes(t *testing.T) {
	dir := t.TempDir()
	key, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	artifact := []byte("test bytes, never executed")
	digest := sha256.Sum256(artifact)
	keyDigest := sha256.Sum256(key)
	now := time.Now().UTC()
	name := "cloudlane-installer_0.1.0_linux_amd64"
	m := release.Manifest{Schema: 1, Product: "cloudlane-installer", Version: "0.1.0", Platform: "linux-amd64", Filename: name, SHA256: hex.EncodeToString(digest[:]), Size: int64(len(artifact)), IssuedAt: now.Add(-time.Minute).Format(time.RFC3339), ExpiresAt: now.Add(time.Hour).Format(time.RFC3339)}
	manifest, _ := json.Marshal(m)
	for name, data := range map[string][]byte{"manifest.json": manifest, "signature": ed25519.Sign(private, append([]byte(release.Prefix), manifest...)), "test-key": key, name: artifact} {
		if err := os.WriteFile(filepath.Join(dir, name), data, 0600); err != nil {
			t.Fatal(err)
		}
	}
	args := []string{"verify", "--manifest", filepath.Join(dir, "manifest.json"), "--signature", filepath.Join(dir, "signature"), "--trusted-key", filepath.Join(dir, "test-key"), "--artifact", filepath.Join(dir, name), "--key-sha256", hex.EncodeToString(keyDigest[:]), "--version", "0.1.0"}
	var out, stderr bytes.Buffer
	if run(args, &out, &stderr) != 0 {
		t.Fatal(stderr.String())
	}
	var result release.Result
	if err := json.Unmarshal(out.Bytes(), &result); err != nil || !result.Verified || result.ReadyToInstall {
		t.Fatal(result, err)
	}
	if err := os.WriteFile(filepath.Join(dir, name), []byte("changed"), 0600); err != nil {
		t.Fatal(err)
	}
	out.Reset()
	stderr.Reset()
	if run(args, &out, &stderr) != 1 || out.Len() != 0 || stderr.String() != "artifact_mismatch\n" {
		t.Fatal(out.String(), stderr.String())
	}
}

func TestCLIHelpAndVersionClearlyIdentifyDevelopment(t *testing.T) {
	for _, args := range [][]string{nil, {"--help"}, {"version"}} {
		var out, stderr bytes.Buffer
		if run(args, &out, &stderr) != 0 || !strings.Contains(out.String(), "development") || stderr.Len() != 0 {
			t.Fatal(out.String(), stderr.String())
		}
	}
}

func TestRealHostCLIReportsIncompleteOrBlockedNeverReady(t *testing.T) {
	var out, stderr bytes.Buffer
	code := run([]string{"preflight", "--format", "json"}, &out, &stderr)
	var report preflight.Report
	if err := json.Unmarshal(out.Bytes(), &report); err != nil {
		t.Fatal(err)
	}
	if (code != 0 && code != 2) || report.ReadyToInstall || report.Schema != "cloudlane.preflight.v1" || len(report.Checks) < 10 || stderr.Len() != 0 {
		t.Fatal(code, report, stderr.String())
	}
	if (code == 2) != (report.Status == "blocked") {
		t.Fatal("exit/report mismatch")
	}
}
