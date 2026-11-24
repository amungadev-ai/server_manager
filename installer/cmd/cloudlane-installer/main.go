package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"
	"time"

	"cloudlane.local/installer/internal/plan"
	"cloudlane.local/installer/internal/platform"
	"cloudlane.local/installer/internal/preflight"
	"cloudlane.local/installer/internal/release"
)

const help = `Cloudlane installer development candidate (CL-080/081)
Commands:
  preflight [--format text|json]  Read-only Linux host diagnostics
  verify --manifest FILE --signature FILE --artifact FILE --trusted-key FILE --key-sha256 HEX --version X.Y.Z
                                Offline local artifact verification; requires independent key trust
  version                       Show development build label
  review --plan FILE --signature FILE --trusted-key FILE --key-sha256 HEX --version X.Y.Z --workspace NEW_PRIVATE_DIRECTORY --port N --operation install|resume|repair|doctor [--apply]
                                Non-root isolated loopback installation. Repair defaults to dry-run.
No host installation command is available. No production release or trust key exists.
`

func run(args []string, out, stderr io.Writer) int {
	if len(args) == 0 || args[0] == "help" || args[0] == "--help" || args[0] == "-h" {
		if len(args) > 1 {
			fmt.Fprintln(stderr, "invalid_arguments")
			return 1
		}
		fmt.Fprint(out, help)
		return 0
	}
	switch args[0] {
	case "review":
		return runReview(args[1:], out, stderr)
	case "version":
		if len(args) != 1 {
			fmt.Fprintln(stderr, "invalid_arguments")
			return 1
		}
		fmt.Fprintln(out, "cloudlane-installer development (CL-080; no production release)")
		return 0
	case "preflight":
		f := flag.NewFlagSet("preflight", flag.ContinueOnError)
		f.SetOutput(io.Discard)
		format := f.String("format", "text", "")
		if err := f.Parse(args[1:]); err != nil || f.NArg() != 0 || (*format != "text" && *format != "json") {
			fmt.Fprintln(stderr, "invalid_arguments")
			return 1
		}
		r := preflight.Collect()
		if *format == "json" {
			if err := json.NewEncoder(out).Encode(r); err != nil {
				return 1
			}
		} else {
			fmt.Fprintf(out, "Preflight: %s; ready to install: false\n", r.Status)
			fmt.Fprintf(out, "Observed: CPUs=%d RAM=%d available_RAM=%d swap=%d free_swap=%d data_free_bytes=%d data_free_inodes=%d\n", r.Resources.LogicalCPUs, r.Resources.MemoryTotal, r.Resources.MemoryAvailable, r.Resources.SwapTotal, r.Resources.SwapFree, r.Resources.DataFreeBytes, r.Resources.DataFreeInodes)
			for _, c := range r.Checks {
				fmt.Fprintf(out, "%s %s: %s\n", c.Status, c.ID, c.Message)
			}
		}
		if r.Status == "blocked" {
			return 2
		}
		return 0
	case "verify":
		f := flag.NewFlagSet("verify", flag.ContinueOnError)
		f.SetOutput(io.Discard)
		var r release.Request
		f.StringVar(&r.ManifestPath, "manifest", "", "")
		f.StringVar(&r.SignaturePath, "signature", "", "")
		f.StringVar(&r.ArtifactPath, "artifact", "", "")
		f.StringVar(&r.KeyPath, "trusted-key", "", "")
		f.StringVar(&r.KeySHA256, "key-sha256", "", "")
		f.StringVar(&r.Version, "version", "", "")
		if err := f.Parse(args[1:]); err != nil || f.NArg() != 0 {
			fmt.Fprintln(stderr, "invalid_arguments")
			return 1
		}
		result, err := release.Verify(r, time.Now().UTC())
		if err != nil {
			fmt.Fprintln(stderr, err.Error())
			return 1
		}
		if err := json.NewEncoder(out).Encode(result); err != nil {
			return 1
		}
		return 0
	default:
		fmt.Fprintln(stderr, "unknown_command")
		return 1
	}
}

func runReview(args []string, out, stderr io.Writer) int {
	f := flag.NewFlagSet("review", flag.ContinueOnError)
	f.SetOutput(io.Discard)
	manifest := f.String("plan", "", "")
	signature := f.String("signature", "", "")
	key := f.String("trusted-key", "", "")
	pin := f.String("key-sha256", "", "")
	version := f.String("version", "", "")
	directory := f.String("workspace", "", "")
	port := f.Int("port", 0, "")
	operation := f.String("operation", "", "")
	apply := f.Bool("apply", false, "")
	fail := func(code string) int { fmt.Fprintln(stderr, code); return 1 }
	if err := f.Parse(args); err != nil || f.NArg() != 0 || *directory == "" || (*operation != "install" && *operation != "resume" && *operation != "repair" && *operation != "doctor") || (*apply && *operation != "repair") {
		return fail("invalid_arguments")
	}
	if runtime.GOOS != "linux" || runtime.GOARCH != "amd64" || os.Geteuid() == 0 {
		return fail("nonroot_linux_review_required")
	}
	data, err := plan.Read(*manifest, 16384)
	if err != nil {
		return fail("plan_input")
	}
	sig, err := plan.Read(*signature, 64)
	if err != nil {
		return fail("plan_input")
	}
	pub, err := plan.Read(*key, 32)
	if err != nil {
		return fail("plan_input")
	}
	verified, err := plan.Verify(data, sig, pub, *pin, *version, time.Now().UTC())
	if err != nil {
		return fail(err.Error())
	}
	path, err := filepath.Abs(*directory)
	if err != nil {
		return fail("workspace_unsafe")
	}
	driver, err := platform.NewDocker(path, verified)
	if err != nil {
		return fail("review_options")
	}
	e, err := platform.Open(path, verified, *operation, *port, driver)
	if err != nil {
		return fail(platform.Code(err))
	}
	defer e.Close()
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()
	ctx, deadline := context.WithTimeout(ctx, 10*time.Minute)
	defer deadline()
	report, err := e.Run(ctx, *operation, *apply)
	if err != nil {
		return fail(platform.Code(err))
	}
	if err := json.NewEncoder(out).Encode(report); err != nil {
		return 1
	}
	return 0
}

func main() { os.Exit(run(os.Args[1:], os.Stdout, os.Stderr)) }
