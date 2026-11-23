package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"time"

	"cloudlane.local/installer/internal/preflight"
	"cloudlane.local/installer/internal/release"
)

const help = `Cloudlane installer development candidate (CL-080)
Commands:
  preflight [--format text|json]  Read-only Linux host diagnostics
  verify --manifest FILE --signature FILE --artifact FILE --trusted-key FILE --key-sha256 HEX --version X.Y.Z
                                Offline local artifact verification; requires independent key trust
  version                       Show development build label
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

func main() { os.Exit(run(os.Args[1:], os.Stdout, os.Stderr)) }
