# CL-002 / CL-003 verification — 2026-11-18

Working source: canonical task records. Environment: Node 24.22.3, npm 11.9.0, application TypeScript 6.0.3 and isolated generator TypeScript 5.9.3.

| Check | Result |
| --- | --- |
| OpenAPI and agent schema generation | PASS; 16 HTTP paths, 18 operations, 2 live platform operations; other operations unavailable |
| Independent OpenAPI parser validation | PASS; local references only |
| Generated output drift check | PASS |
| Application/contract/server type checks | PASS; Svelte 0 errors/warnings |
| Node tests | PASS; 28 tests |
| Python progress gate tests | PASS; 3 tests |
| Structural boundary rejection cases | PASS; browser-to-API/agent import, Node-only contract import and direct API host execution |
| Response validation | PASS; invalid sessions/data/errors/JSON and oversized streamed data rejected |
| Request validation | PASS; unknown authority fields, invalid IDs/query/retry keys, malformed JSON, content type and body-size limits |
| Safe unavailable behavior | PASS; valid login/claim/resource/deployment requests return 501 without cookies or operational success |
| Production / preview static builds | PASS; HTTP excludes fixtures; preview explicitly includes fixtures; both exclude agent contract/runtime SSR |
| Clean-checkout reproduction | PASS; fresh clone of `2444ea50b2490f3081649d1be02ee28255f201aa`, npm ci and npm run verify; all 31 tests pass |
| Actual hosted GitHub CI / independent review | NOT RUN |
| Browser visual/mobile/a11y QA | NOT RUN; private preview access requires ChatGPT sign-in |
| PostgreSQL, owner auth, real agent/VPS operations | NOT IMPLEMENTED by this milestone |

Schema parsing does not prove authorization, signature authenticity, freshness, replay safety or ownership. Relative timestamp and metric-usage refinements are enforced by runtime schemas; generated JSON Schema is an interchange description and requires corresponding receiver validation.

Initial failures resolved before handoff: incompatible generator compiler peer was isolated without forcing npm; malformed-JSON errors are now classified before Nest adapter normalization; comparison uses serialized wire JSON; disposable boundary test fixtures use the permitted ignored workspace directory.

Implementation checkpoint: `2444ea50b2490f3081649d1be02ee28255f201aa`. Verified code is unchanged by this final documentation checkpoint. Canonical records: tasks/progress/CL-002.md and CL-003.md. Remaining reviews are explicit; no security or production sign-off is inferred.
