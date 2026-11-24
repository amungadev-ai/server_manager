package plan

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func fixture(t *testing.T) (Plan, ed25519.PublicKey, ed25519.PrivateKey, time.Time) {
	t.Helper()
	pub, key, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 11, 24, 10, 0, 0, 0, time.UTC)
	p := Plan{1, "cloudlane-platform-review", "0.1.0", "linux-amd64", "postgres:18.7@sha256:" + strings.Repeat("1", 64), "sha256:" + strings.Repeat("2", 64), "sha256:" + strings.Repeat("3", 64), strings.Repeat("4", 64), now.Add(-time.Hour).Format(time.RFC3339), now.Add(time.Hour).Format(time.RFC3339)}
	return p, pub, key, now
}
func TestVerifiedPlansRequireExactPinsAndDomain(t *testing.T) {
	p, pub, key, now := fixture(t)
	data, _ := json.Marshal(p)
	sig := ed25519.Sign(key, append([]byte(Prefix), data...))
	v, err := Verify(data, sig, pub, Digest(pub), p.Version, now)
	if err != nil || !v.Valid() || v.Hash() != Digest(data) || v.Value() != p {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name           string
		data, sig, pub []byte
		pin, version   string
	}{
		{"wrongKeyPin", data, sig, pub, strings.Repeat("0", 64), p.Version}, {"missingPin", data, sig, pub, "", p.Version}, {"otherVersion", data, sig, pub, Digest(pub), "0.2.0"}, {"noKey", data, sig, nil, Digest(pub), p.Version}, {"tamperedBytes", append(data, ' '), sig, pub, Digest(pub), p.Version}, {"wrongDomain", data, ed25519.Sign(key, append([]byte("CLOUDLANE-RELEASE-MANIFEST-V1\n"), data...)), pub, Digest(pub), p.Version},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := Verify(tc.data, tc.sig, tc.pub, tc.pin, tc.version, now); err == nil {
				t.Fatal("untrusted plan accepted")
			}
		})
	}
}
func TestSignedPlansMustStillMeetPolicy(t *testing.T) {
	for _, tc := range []struct {
		name   string
		change func(*Plan)
	}{
		{"schema", func(p *Plan) { p.Schema = 2 }}, {"product", func(p *Plan) { p.Product = "cloudlane-platform" }}, {"architecture", func(p *Plan) { p.Platform = "linux-arm64" }}, {"mutableImage", func(p *Plan) { p.APIImage = "node:latest" }}, {"shellInImage", func(p *Plan) { p.APIImage = "--privileged" }}, {"schemaDigest", func(p *Plan) { p.SchemaSHA256 = "" }}, {"futureTime", func(p *Plan) { p.IssuedAt = "2026-11-24T10:06:00Z" }}, {"expired", func(p *Plan) { p.ExpiresAt = "2026-11-24T10:00:00Z" }}, {"longLifetime", func(p *Plan) { p.ExpiresAt = "2027-01-01T00:00:00Z" }}, {"offsetTime", func(p *Plan) { p.IssuedAt = "2026-11-24T09:00:00+00:00" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			p, pub, key, now := fixture(t)
			tc.change(&p)
			data, _ := json.Marshal(p)
			if _, err := Verify(data, ed25519.Sign(key, append([]byte(Prefix), data...)), pub, Digest(pub), "0.1.0", now); err == nil {
				t.Fatal("invalid signed policy accepted")
			}
		})
	}
}
func TestSignedUnknownDuplicateMissingNullFieldsRejected(t *testing.T) {
	p, pub, key, now := fixture(t)
	b, _ := json.Marshal(p)
	for _, data := range []string{strings.Replace(string(b), `"schema":1`, `"schema":1,"schema":1`, 1), strings.Replace(string(b), `"schema":1`, `"schema":1,"command":"shell"`, 1), strings.Replace(string(b), `"schema":1,`, "", 1), strings.Replace(string(b), `"version":"0.1.0"`, `"version":null`, 1), string(b) + " {}", strings.Repeat(" ", 16385)} {
		if _, err := Verify([]byte(data), ed25519.Sign(key, append([]byte(Prefix), []byte(data)...)), pub, Digest(pub), p.Version, now); err == nil {
			t.Fatal("signed malformed metadata accepted")
		}
	}
}
