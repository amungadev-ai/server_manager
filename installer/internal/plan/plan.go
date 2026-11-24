package plan

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"regexp"
	"syscall"
	"time"

	"cloudlane.local/installer/internal/strictjson"
)

const Prefix = "CLOUDLANE-PLATFORM-PLAN-V1\n"

var hex64 = regexp.MustCompile(`^[a-f0-9]{64}$`)
var versionRE = regexp.MustCompile(`^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$`)
var imageRE = regexp.MustCompile(`^(sha256:[a-f0-9]{64}|[a-z0-9][a-z0-9./:_-]{0,180}@sha256:[a-f0-9]{64})$`)

type Plan struct {
	Schema        int    `json:"schema"`
	Product       string `json:"product"`
	Version       string `json:"version"`
	Platform      string `json:"platform"`
	DatabaseImage string `json:"database_image"`
	APIImage      string `json:"api_image"`
	CaddyImage    string `json:"caddy_image"`
	SchemaSHA256  string `json:"schema_sha256"`
	IssuedAt      string `json:"issued_at"`
	ExpiresAt     string `json:"expires_at"`
}
type Verified struct {
	value  Plan
	digest string
}

func (v Verified) Value() Plan  { return v.value }
func (v Verified) Hash() string { return v.digest }
func (v Verified) Valid() bool  { return hex64.MatchString(v.digest) }
func Digest(b []byte) string    { h := sha256.Sum256(b); return hex.EncodeToString(h[:]) }
func Verify(data, signature, key []byte, pin, version string, now time.Time) (Verified, error) {
	fail := func(code string) (Verified, error) { return Verified{}, errors.New(code) }
	if len(key) != ed25519.PublicKeySize || !hex64.MatchString(pin) || Digest(key) != pin {
		return fail("plan_key_pin")
	}
	if len(data) > 16384 || len(signature) != ed25519.SignatureSize || !ed25519.Verify(ed25519.PublicKey(key), append([]byte(Prefix), data...), signature) {
		return fail("plan_signature")
	}
	var p Plan
	if err := strictjson.Decode(data, &p, 16384); err != nil {
		return fail("plan_format")
	}
	if p.Schema != 1 || p.Product != "cloudlane-platform-review" || p.Platform != "linux-amd64" || !versionRE.MatchString(version) || p.Version != version {
		return fail("plan_target")
	}
	if !imageRE.MatchString(p.DatabaseImage) || !imageRE.MatchString(p.APIImage) || !imageRE.MatchString(p.CaddyImage) || !hex64.MatchString(p.SchemaSHA256) {
		return fail("plan_artifact_pins")
	}
	i, ie := time.Parse(time.RFC3339, p.IssuedAt)
	e, ee := time.Parse(time.RFC3339, p.ExpiresAt)
	if ie != nil || ee != nil || i.UTC().Format(time.RFC3339) != p.IssuedAt || e.UTC().Format(time.RFC3339) != p.ExpiresAt || !e.After(i) || e.Sub(i) > 30*24*time.Hour || !now.Before(e) || i.After(now.Add(5*time.Minute)) {
		return fail("plan_time")
	}
	return Verified{p, Digest(data)}, nil
}
func Read(path string, limit int64) ([]byte, error) {
	fd, err := syscall.Open(path, syscall.O_RDONLY|syscall.O_CLOEXEC|syscall.O_NOFOLLOW|syscall.O_NONBLOCK, 0)
	if err != nil {
		return nil, errors.New("plan_input")
	}
	f := os.NewFile(uintptr(fd), "input")
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() {
		return nil, errors.New("plan_input")
	}
	b, err := io.ReadAll(io.LimitReader(f, limit+1))
	if err != nil || int64(len(b)) > limit {
		return nil, errors.New("plan_input")
	}
	return b, nil
}
