# Package boundaries and review ownership

| Package/path | Allowed dependencies | Responsibility / review area |
| --- | --- | --- |
| `packages/contracts` | Zod and its own portable source | Typed HTTP/agent schemas, generated types; API/contract compatibility review |
| `packages/design-tokens` | CSS only | Approved v1.13 palettes; design/accessibility review |
| `apps/dashboard` | SvelteKit, contract API/client/preview exports, design tokens | Presentation and typed transport; frontend review |
| `apps/api` | NestJS, HTTP contracts and approved server libraries | Validation, future auth, resource policy and job requests; API/security review |
| `agent` | Future Go runtime and reviewed protocol | Typed privileged operations only; agent/security review |
| `installer`, `deploy` | Reviewed host/install integrations | Host lifecycle and ingress; operations/security review |
| `tools/contract-generator` | Isolated OpenAPI tooling/compiler and contracts; no production runtime | Schema/type generation and compatibility review |
| `scripts`, `tests` | Build/test tools; no production secrets | Generation, structural checks and reproducible evidence |

Never import another application's implementation. Browser code cannot import the agent contract, Node builtins or API/installer/host modules. Portable contracts cannot import Node/NestJS/Svelte or application code. API code cannot spawn host processes or bypass the future restricted agent. Preview fixtures and synthetic identifiers stay in the demo adapter, not in production response validation.

`npm run check:boundaries` checks manifests and source imports/calls. Tests demonstrate rejection of cross-application imports, Node-only contract dependencies and direct host execution. It is a review aid; dynamic resolution, runtime authorization and workload isolation require separate tests/review.

The task claimant owns implementation/checkpoint accuracy. A maintainer reviews integration evidence. A separate reviewer must sign off security-sensitive operational work. Review areas above are roles, not fictional assigned people. GitHub CODEOWNERS identities and branch protection cannot be configured until a real shared repository/reviewer is selected (CL-004).
