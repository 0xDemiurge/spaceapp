# Contributing to SpaceApp

Advanced API settings are documented in the [configuration reference](docs/configuration-reference.md).

Use a checkout you own. Do not run development tests against an installed
operator instance or reuse its credentials, browser profiles, sockets or data.

## Development prerequisites

The monorepo requires Node **>=22.12 <23**, as declared in the root
`package.json`, and npm. Linux is the reference development environment;
Windows contributors can use WSL. Building `node-pty` may require Python 3,
Make and a C++ compiler if a compatible prebuilt binary is unavailable.

The `run-spaceapp` installer is a separate package with its own host Node
requirement. Installing the application and developing this monorepo have
different prerequisites; consult the selected installer's `engines` field.

From the repository root, install the locked dependencies:

```sh
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci
```

Skipping the Electron download is suitable for core development. Desktop
packaging requires its normal toolchain and separate platform acceptance.
Dependency installation may use the network; the smoke command below does not
need a provider account, API key, Docker, PostgreSQL or Temporal.

## Run the full app from source

Use Node 22 (>=22.12 <23), npm, and Docker with Compose v2. Install dependencies
with `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`. Docker pulls PostgreSQL/pgvector
and Temporal using the installer's digest pins; the first run also needs npm
registry access for the Dockerfile-pinned OpenCode CLI. Nothing is installed globally.

```sh
npm run dev:stack                 # up: keep this terminal open
npm run dev:stack -- status       # from another terminal
npm run dev:stack -- rebuild      # pick up packages/* changes
npm run dev:stack -- down         # stop processes and containers, preserve data
npm run dev:stack -- reset        # remove this stack's containers, volume and state
npm run dev:stack -- --build      # force internal package builds on startup
```

Open the printed URL, enter the one-time owner setup token, create the owner,
and sign in. Open Getting Started and add an OpenCode terminal pane. No provider
account is required to reach its UI; executing AI tasks may require a model or
provider account. Dev-login is disabled. The setup token is valid for 15 minutes;
restart an unclaimed stack if it expires. Existing owner credentials survive down/up.

| Service | Default port | Override |
| --- | --- | --- |
| API | 4920 | SPACE_DEV_STACK_API_PORT |
| Web | 4921 | SPACE_DEV_STACK_WEB_PORT |
| PostgreSQL | 55432 | SPACE_DEV_STACK_POSTGRES_PORT |
| Temporal | 57233 | SPACE_DEV_STACK_TEMPORAL_PORT |

All listeners bind to 127.0.0.1. Ports must be distinct, 1024-65535, and cannot
be 4910 or 4911. The default Compose project is `spaceapp-dev`; set
`SPACE_DEV_STACK_PROJECT` to a unique name for another checkout. State, private
secrets, wrappers, provider homes and the CLI binary live in git-ignored
`.dev-stack/`. Override it with `SPACE_DEV_STACK_DIR` (a dedicated directory
inside the checkout; ignore that path in your local Git excludes). Use the same
overrides for every lifecycle command. Never point it at an installed instance.

API edits in `apps/api/src` restart its watch runner. Web edits in
`apps/web/src` use Vite HMR. After editing `packages/*`, run the rebuild command;
it rebuilds the internal packages and worker and restarts API, worker and CLI host.
Open panes may need reopening after a CLI-host restart. Browser/companion services
and root/admin shell features remain disabled.

On macOS, start Docker Desktop or Colima and select its context with
`docker context use <context>`; confirm `docker compose version` works.
On Windows 11 use **WSL2**, clone inside the Linux filesystem (for example
`~/src/spaceapp`, not `/mnt/c`), and enable Docker Desktop's WSL integration.
Run Node, npm and these commands inside that distribution. Native Windows is
rejected because the CLI host requires Unix sockets and PTYs.

Troubleshooting:

- Docker unavailable: start the daemon/Desktop/Colima and check the selected context.
- Port in use: use the corresponding override above, then down/up with those settings.
  Vite uses strict port selection and will report the collision.
- Socket path too long: use a shorter checkout or a shorter `SPACE_DEV_STACK_DIR`.
- Process exited: the supervisor names the process, stops its peers and exits nonzero.
  Read its prefixed output; containers remain available for inspection until down.
- OpenCode install offline: restore npm registry access and retry; a matching installed
  version is reused. Provider credentials are not required for the terminal UI.
- Slow readiness: set `SPACE_DEV_STACK_READY_TIMEOUT_MS` (default 240000). A failure
  names dependencies that are not ready. Use `docker compose -p spaceapp-dev
  -f .dev-stack/compose.yml logs` for database/Temporal diagnostics.
- An interrupted supervisor can leave a startup lock. Run down/reset before retrying.
  After a supervisor crash, cleanup stops the recorded child process groups. It checks
  the state marker and Docker ownership labels before cleaning up this stack.

The Linux CI driver exercises readiness, owner setup, sign-in, OpenCode pane
startup and reset without a TTY. Real Linux and macOS/WSL2 terminal evidence is
still required before claiming cross-platform acceptance.

## First executed task, without a provider

```sh
npm run smoke:offline
```

This builds the CLI host and runs an explicitly **simulated runtime** through
the real Unix socket protocol and a real PTY child. It submits two arithmetic
tasks, checks their results, reconnects without replacing the process, and
resubmits an input key to verify duplicate suppression within that host's
retained session. The child receives an allowlisted environment. Its process,
socket and temporary directory are removed before success is reported.

Success is a JSON record with `mode: "SIMULATED_RUNTIME"`, `passed: true` and
`cleaned: true`. A wrong answer or early child exit fails the command. This is
a contributor transport/acceptance check, not evidence of AI quality, provider
authentication, native task resume, browser behavior or crash durability.

Unix socket paths are short. If your inherited `TMPDIR` is deeply nested,
select a short temporary directory you own and set `TMPDIR` for the command.
On Windows run this particular smoke check inside WSL or a Linux development
container. It does not certify the Windows/macOS installer.

## Make and verify a small change

Work on a branch, not on `main`, so the change can become a pull request:

```sh
git switch -c my-change
```

For example, change the synthetic task's result handling in
`scripts/fixtures/offline-cli.mjs`, then run:

```sh
npm run test:contributor
npm run check
```

The contributor regression tests reject incorrect task output and early process
exit, and check cleanup after both. Restore the intended behavior before
submitting a change. Use the tests for the affected workspace as well; the
offline smoke is not a substitute for them.

## Checks before a commit

After `npm ci`, these commands work in this order, also on a fresh clone:

```sh
npm run check
npm test
npm run build
npm run hygiene:preflight
```

`npm run check` runs the dependency boundary check, builds the internal
`@space/*` packages in dependency order and then type-checks the apps, so it
does not need an earlier `npm run build`. `npm test` builds the internal
packages and runs the test suites in this checkout. `npm run build` also builds
the API, worker and web app. Run `npm run hygiene:preflight` before every
commit: it fails on untracked files and on staged runtime, secret, dependency,
generated or report paths. Commit from your branch; older releases of this
check also refuse to run on `main`.

Opt-in database and authenticated provider proofs require separate isolated
fixtures; skipped proofs are not passing evidence.

In the maintainers' source repository, `npm run check:claims` compares the
version, licence, Node requirement, runtime list and key constants stated in
the README and `docs/` with the code, and rejects unqualified latency or
isolation claims; maintainers run it when a change touches any of them. Current
results and known failures are indexed there in `docs/quality/README.md`, and
its `AGENTS.md` describes the guidance to read before changing session
attachment, room retention, control, readiness, polling or deployment.

Keep changes reviewable and include the exact commands and limitations of your
verification. Never include credentials, private transcripts or local runtime
state in a contribution.
