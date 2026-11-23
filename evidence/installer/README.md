# CL-080 retained implementation evidence

[PR #8](https://github.com/amungadev-ai/server_manager/pull/8) · [run 45166802363](https://github.com/amungadev-ai/server_manager/actions/runs/45166802363) · [batch interpretation](../../docs/evidence/INSTALLER_PREFLIGHT.md)

Implementation head: `4c1d78c72cb847f8e6e6171b87915b30c2b708be`. Tested PR merge: `26bc2381cf6aca2689aa01c4defb94f91ac3b4c5`. Both use tree `af5439e569388423a7ae9870f9834ae1ad51380c`. All 7 required jobs succeeded. The later handoff adds documentation/evidence only; it does not relabel these reports as a different source.

[artifact-index.json](run-45166802363/artifact-index.json) records original native artifact IDs/ZIP SHA-256 values, job outcomes, verified included manifest files, files outside the upload allowlist and SHA-256/byte counts for every retained report. Each ZIP digest was checked before its contents. Manifest source/run/clean-tree fields and all included declared file hashes were verified. No absent harness/discovery file is claimed checked.

- `installer-1/reports/`: Go JSON/race tests, vet/format/build logs, counters/coverage and sanitized actual host diagnostics. 24 top-level tests + 107 subtests, zero skips. The Ubuntu runner recognizes supported OS/arch but correctly blocks its existing proxy/runtime and storage conflict. The development binary was checked inside the ZIP against its manifest and build-summary digest; it is not retained in Git or signed as a release.
- `verification-1/reports/`: build/check/lint/unit evidence; 78 Node + 10 Python tests.
- `postgres-1/reports/`: real PostgreSQL/HTTPS evidence; 58 cases.
- `browser-{desktop,mobile}-1/reports/`: actual Chromium markers, expected run, JUnit/log and original hash manifest; 27 cases each, zero retries, 40 total immutable-source comparisons. Screenshot/trace bytes were verified inside the source ZIP and are not duplicated in Git.

To recheck retained bytes from the repository root:

```python
import hashlib, json
from pathlib import Path
root = Path('evidence/installer/run-45166802363')
index = json.loads((root / 'artifact-index.json').read_text())
for artifact in index['artifacts']:
    for item in artifact['retained']:
        data = (root / item['path']).read_bytes()
        assert len(data) == item['bytes']
        assert hashlib.sha256(data).hexdigest() == item['sha256']
```

CI artifacts have seven-day retention; these text reports remain source scoped. No dedicated-VPS install, production publisher key/signing/revocation/provenance, verified capacity/firewall, IP TLS or independent security approval is demonstrated here.
