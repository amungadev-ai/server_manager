<script lang="ts">
  import { onMount, tick } from 'svelte';
  import QRCode from 'qrcode';
  import { AuthClient } from '#lib/api/auth.ts';
  import { InfrastructureError } from '#lib/api/http.ts';
  import type { z } from 'zod';
  import type { MfaProofResponseSchema } from '@cloudlane/contracts/api';
  let { entry }: { entry: 'setup' | 'login' | 'recover' | 'security' } =
    $props();
  type Step =
    | 'loading'
    | 'unavailable'
    | 'claim'
    | 'owner'
    | 'login'
    | 'enroll'
    | 'mfa'
    | 'recovery'
    | 'codes'
    | 'security'
    | 'success';
  const demo = import.meta.env.VITE_CLOUDLANE_DATA_MODE === 'demo';
  let step = $state<Step>('loading');
  let busy = $state(false),
    error = $state(''),
    notice = $state('');
  let email = $state(''),
    displayName = $state(''),
    password = $state(''),
    confirmPassword = $state('');
  let claimCode = $state(''),
    code = $state(''),
    recoveryCode = $state(''),
    acknowledged = $state(false);
  let secret = $state(''),
    qr = $state(''),
    codes = $state<string[]>([]),
    expiresAt = $state('');
  let heading: HTMLHeadingElement;
  let client: AuthClient | undefined;
  let alive = true;
  const previewCodes = () =>
    Array.from(
      { length: 10 },
      (_, i) =>
        (i.toString(16).repeat(4) + '-').repeat(7) + i.toString(16).repeat(4),
    );
  const title = $derived(
    {
      loading: 'Checking your installation',
      unavailable: 'Owner access unavailable',
      claim: 'Claim your installation',
      owner: 'Create your owner account',
      login: entry === 'recover' ? 'Recover owner access' : 'Welcome back',
      enroll: 'Secure your owner account',
      mfa: 'Verify your authenticator',
      recovery: 'Use a recovery code',
      codes: 'Save your recovery codes',
      security: 'Recovery code settings',
      success: 'Owner access ready',
    }[step],
  );
  function clearSecrets() {
    password = '';
    confirmPassword = '';
    claimCode = '';
    code = '';
    recoveryCode = '';
    secret = '';
    qr = '';
    codes = [];
    acknowledged = false;
  }
  async function show(next: Step) {
    error = '';
    notice = '';
    step = next;
    await tick();
    if (alive) heading?.focus();
  }
  async function work(operation: () => Promise<void>) {
    if (busy) return;
    busy = true;
    error = '';
    notice = '';
    try {
      await operation();
    } catch (e) {
      if (alive) {
        error =
          e instanceof InfrastructureError
            ? e.message
            : 'This step could not be completed. Please try again.';
        await tick();
        document.getElementById('auth-error')?.focus();
      }
    } finally {
      if (alive) busy = false;
    }
  }
  async function setupAuthenticator(seed: string, uri: string) {
    secret = seed;
    qr = '';
    await show('enroll');
    const generated = await QRCode.toDataURL(uri, {
      width: 224,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
    if (alive && step === 'enroll') qr = generated;
  }
  async function proof(result: z.infer<typeof MfaProofResponseSchema>) {
    secret = '';
    qr = '';
    code = '';
    password = '';
    confirmPassword = '';
    recoveryCode = '';
    if ('codes' in result) {
      codes = result.codes;
      acknowledged = false;
      expiresAt = result.expiresAt;
      await show('codes');
    } else {
      codes = [];
      await show('success');
    }
  }
  async function afterPassword() {
    if (demo) {
      if (entry === 'setup')
        await setupAuthenticator(
          'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
          'otpauth://totp/Cloudlane:preview%40example.test?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Cloudlane',
        );
      else await show(entry === 'recover' ? 'recovery' : 'mfa');
      return;
    }
    const result = await client!.login(email, password);
    password = '';
    confirmPassword = '';
    expiresAt = result.expiresAt;
    if (result.state === 'mfa_setup_required') {
      const enrollment = await client!.enroll();
      await setupAuthenticator(enrollment.secret, enrollment.uri);
    } else await show(entry === 'recover' ? 'recovery' : 'mfa');
  }
  function validNewPassword() {
    if (
      Array.from(password).length < 15 ||
      new TextEncoder().encode(password).length > 1024
    ) {
      error = 'Use at least 15 characters and at most 1024 UTF-8 bytes.';
      return false;
    }
    if (password !== confirmPassword) {
      error = 'Your passwords do not match.';
      return false;
    }
    return true;
  }
  async function submit() {
    await work(async () => {
      if (step === 'claim') {
        if (!demo) await client!.claim(claimCode);
        claimCode = '';
        await show('owner');
      } else if (step === 'owner') {
        if (!demo && !validNewPassword()) {
          await tick();
          document.getElementById('auth-error')?.focus();
          return;
        }
        if (!demo) await client!.createOwner(email, displayName, password);
        await show('login');
        await afterPassword();
      } else if (step === 'login') await afterPassword();
      else if (step === 'enroll' || step === 'mfa') {
        if (demo) {
          if (step === 'enroll') {
            secret = '';
            qr = '';
            codes = previewCodes();
            await show('codes');
          } else await show('success');
        } else await proof(await client!.verify(code, step === 'enroll'));
      } else if (step === 'recovery') {
        if (!demo) await client!.recover(recoveryCode);
        recoveryCode = '';
        await show('success');
      } else if (step === 'codes') {
        if (!acknowledged) return;
        if (!demo) await client!.acknowledge();
        codes = [];
        await show('success');
      } else if (step === 'security') {
        if (demo) {
          codes = previewCodes();
          await show('codes');
        } else await proof(await client!.regenerate(password, code));
      }
    });
  }
  async function restart() {
    clearSecrets();
    client?.clear();
    expiresAt = '';
    await show(
      entry === 'setup' ? 'claim' : entry === 'security' ? 'login' : 'login',
    );
  }
  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      notice = 'Recovery codes copied. Store them somewhere private.';
    } catch {
      notice =
        'Clipboard unavailable. Download the codes or save them manually.';
    }
  }
  function downloadCodes() {
    const url = URL.createObjectURL(
      new Blob(
        [
          'Cloudlane recovery codes — keep private. Each code works once with your password.\n\n' +
            codes.join('\n') +
            '\n',
        ],
        { type: 'text/plain' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cloudlane-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
    notice = 'Recovery code download prepared.';
  }
  onMount(() => {
    try {
      const prefs = JSON.parse(
        localStorage.getItem('cloudlane:appearance') ?? 'null',
      );
      if (
        prefs &&
        ['original', 'slate', 'sand', 'sage', 'mauve'].includes(prefs.palette)
      )
        document.documentElement.dataset.palette = prefs.palette;
      if (prefs?.theme === 'light' || prefs?.theme === 'dark')
        document.documentElement.classList.toggle(
          'dark',
          prefs.theme === 'dark',
        );
    } catch {
      /* Optional appearance preference only. */
    }
    const init = async () => {
      if (demo) {
        await show(
          entry === 'setup'
            ? 'claim'
            : entry === 'security'
              ? 'security'
              : 'login',
        );
        return;
      }
      if (location.protocol !== 'https:') {
        await show('unavailable');
        return;
      }
      client = new AuthClient();
      await work(async () => {
        const status = await client!.status();
        if (status.state === 'unconfigured') {
          await show('unavailable');
          return;
        }
        if (entry === 'security') {
          try {
            await client!.session();
            await show('security');
          } catch {
            await show('login');
          }
        } else if (entry === 'setup' && !status.ownerConfigured)
          await show('claim');
        else await show('login');
      });
      if (step === 'loading') await show('unavailable');
    };
    void init();
    return () => {
      alive = false;
      clearSecrets();
      email = '';
      displayName = '';
      expiresAt = '';
      client?.dispose();
    };
  });
</script>

<svelte:head>
  <title>{title} — Cloudlane</title><meta
    name="robots"
    content="noindex, nofollow"
  /><meta name="referrer" content="no-referrer" />
</svelte:head>
<div class="auth-page">
  <header class="auth-brand">
    <a href="/" aria-label="Cloudlane home">
      <span class="auth-logo" aria-hidden="true">C</span><span>
        Cloudlane<small>YOUR INFRASTRUCTURE, SIMPLIFIED</small>
      </span>
    </a><span class="auth-status">Owner access</span>
  </header>
  <main class="auth-main">
    <aside class="auth-intro">
      <p class="auth-eyebrow">YOUR WORKSPACE. YOUR CONTROL.</p>
      <h2>A secure home for everything you deploy.</h2>
      <p>One owner account for your projects, services and infrastructure.</p>
      <div class="auth-intro-note">
        <span aria-hidden="true">◇</span>
        <p>
          Authenticator verification protects owner access. Recovery codes help
          when your device is unavailable.
        </p>
      </div>
      <a href="/">Back to workspace </a>
    </aside>
    <section class="auth-card" aria-labelledby="auth-title" aria-busy={busy}>
      <p class="auth-eyebrow">
        {entry === 'setup'
          ? 'INSTALLATION SETUP'
          : entry === 'security'
            ? 'ACCOUNT SECURITY'
            : 'WELCOME TO CLOUDLANE'}
      </p>
      <h1 id="auth-title" tabindex="-1" bind:this={heading}>{title}</h1>
      {#if demo}<p class="auth-banner" role="note">
          <strong>Read-only preview</strong> — synthetic walkthrough. No account is
          created. Real credentials cannot be entered.
        </p>{/if}
      {#if error}<div
          id="auth-error"
          role="alert"
          tabindex="-1"
          class="auth-error"
        >
          {error}
        </div>{/if}
      {#if notice}<p class="auth-notice" role="status">{notice}</p>{/if}
      {#if step === 'loading'}<p class="auth-description">
          Checking the secure authentication API…
        </p>
      {:else if step === 'unavailable'}<p class="auth-description">
          Owner sign-in needs HTTPS and a configured authentication API. Open
          the secure Cloudlane address supplied by your installation
          administrator.
        </p>
        <p class="auth-description">
          The static preview does not run the authentication server. Production
          activation is pending security review.
        </p>
        <a class="auth-button secondary" href="/">Return to workspace</a>
      {:else if step === 'success'}<p class="auth-description">
          {demo
            ? 'You have completed the synthetic owner-access walkthrough.'
            : 'Your password and second factor have been verified.'}
        </p>
        <a class="auth-button" href="/">Open workspace</a>
        <p class="auth-description">
          {demo
            ? 'The workspace uses demo infrastructure data.'
            : 'Infrastructure operations remain limited to the features enabled on this installation.'}
        </p>
        <a class="auth-link" href="/auth/security">Recovery code settings</a>
      {:else}
        <form
          onsubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {#if step === 'claim'}<p class="auth-description">
              Use the one-time claim code provided by your installer. It expires
              after 20 minutes.
            </p>
            <label for="claim-code">Installation claim code</label><input
              id="claim-code"
              name="claim-code"
              type="password"
              autocomplete="off"
              spellcheck="false"
              disabled={demo || busy}
              bind:value={claimCode}
              required
              placeholder={demo
                ? 'Synthetic installer claim (preview only)'
                : 'Paste your installer claim code'}
            />
            <p class="auth-hint">
              Only someone with access to your installation should have this
              code.
            </p>
          {:else if step === 'owner' || step === 'login'}
            <p class="auth-description">
              {step === 'owner'
                ? 'Create the first owner, then add an authenticator. Owner access requires both.'
                : entry === 'recover'
                  ? 'First verify your password, then use one of your saved recovery codes.'
                  : 'Sign in with your password, then verify your authenticator.'}
            </p>
            {#if step === 'owner'}<label for="display-name">
                Your name
              </label><input
                id="display-name"
                name="name"
                autocomplete="name"
                bind:value={displayName}
                required
                maxlength="80"
                disabled={demo || busy}
                placeholder={demo ? 'Preview owner' : 'Your name'}
              />{/if}
            <label for="owner-email">Email address</label><input
              id="owner-email"
              name="email"
              type="email"
              autocomplete="username"
              bind:value={email}
              required
              maxlength="254"
              disabled={demo || busy}
              placeholder={demo ? 'preview@example.test' : 'you@example.com'}
            />
            <label for="owner-password">Password</label><input
              id="owner-password"
              name="password"
              type="password"
              autocomplete={step === 'owner'
                ? 'new-password'
                : 'current-password'}
              bind:value={password}
              required
              maxlength="1024"
              disabled={demo || busy}
              placeholder={demo
                ? 'Synthetic password (preview only)'
                : 'Your password'}
              aria-describedby={step === 'owner' ? 'password-hint' : undefined}
            />
            {#if step === 'owner'}<p id="password-hint" class="auth-hint">
                Use at least 15 characters. Spaces and Unicode are welcome.
                Maximum 1024 UTF-8 bytes.
              </p>
              <label for="confirm-password">Confirm password</label><input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autocomplete="new-password"
                bind:value={confirmPassword}
                required
                disabled={demo || busy}
                placeholder={demo
                  ? 'Synthetic password (preview only)'
                  : 'Repeat your password'}
              />{/if}
          {:else if step === 'enroll'}<p class="auth-description">
              Scan this QR code in your authenticator app, or enter the setup
              key manually. Then enter its six-digit code.
            </p>
            {#if qr}<img
                class="auth-qr"
                src={qr}
                alt="Authenticator enrollment QR code"
                width="224"
                height="224"
              />{/if}<label for="setup-secret">
              Authenticator setup key
            </label><input
              id="setup-secret"
              class="auth-mono"
              type="text"
              value={secret}
              readonly
              autocomplete="off"
            />
            <p class="auth-hint">
              Shown once for this setup attempt. Keep it private.
            </p>
          {:else if step === 'mfa'}<p class="auth-description">
              Enter the current six-digit code from your authenticator app. Each
              code can be accepted once.
            </p>
          {:else if step === 'recovery'}<p class="auth-description">
              Enter one saved recovery code. It works once and signs out your
              other owner sessions.
            </p>
            <label for="recovery-code">Recovery code</label><input
              id="recovery-code"
              name="recovery-code"
              class="auth-mono"
              autocomplete="off"
              spellcheck="false"
              bind:value={recoveryCode}
              required
              maxlength="39"
              pattern="[0-9a-fA-F]{4}(-[0-9a-fA-F]{4}){7}"
              disabled={demo || busy}
              placeholder="0000-0000-0000-0000-0000-0000-0000-0000"
            />
          {:else if step === 'codes'}<p class="auth-description">
              Save these ten codes somewhere private. You will not see them
              again. Each works once with your password.
            </p>
            <ol class="auth-codes" aria-label="Recovery codes">
              {#each codes as item}<li><code>{item}</code></li>{/each}
            </ol>
            <div class="auth-code-actions">
              <button
                type="button"
                class="auth-button secondary"
                onclick={copyCodes}
              >
                Copy codes
              </button><button
                type="button"
                class="auth-button secondary"
                onclick={downloadCodes}
              >
                Download codes
              </button>
            </div>
            <label class="auth-checkbox">
              <input
                type="checkbox"
                bind:checked={acknowledged}
                required
                disabled={busy}
              />I have saved my recovery codes somewhere private.
            </label>
          {:else if step === 'security'}<p class="auth-description">
              Replace your recovery codes with a fresh set. This invalidates the
              old codes and signs out every owner session. Verify your password
              and a fresh authenticator code to continue.
            </p>
            <label for="stepup-password">Current password</label><input
              id="stepup-password"
              type="password"
              name="password"
              autocomplete="current-password"
              required
              disabled={demo || busy}
              bind:value={password}
              placeholder={demo
                ? 'Synthetic password (preview only)'
                : 'Your current password'}
            />{/if}
          {#if step === 'enroll' || step === 'mfa' || step === 'security'}<label
              for="totp-code"
            >
              Authenticator code
            </label><input
              id="totp-code"
              name="totp-code"
              class="auth-mono"
              inputmode="numeric"
              autocomplete="one-time-code"
              pattern="[0-9]{6}"
              minlength="6"
              maxlength="6"
              bind:value={code}
              required
              disabled={demo || busy}
              placeholder="000000"
            />{/if}
          {#if expiresAt && (step === 'mfa' || step === 'enroll' || step === 'recovery' || step === 'codes')}<p
              class="auth-hint"
            >
              This step expires at {new Date(expiresAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}. Start again if it expires.
            </p>{/if}
          <button
            class="auth-button"
            type="submit"
            disabled={busy || (step === 'codes' && !acknowledged)}
          >
            {busy
              ? 'Verifying…'
              : demo
                ? 'Continue preview'
                : step === 'codes'
                  ? 'Finish secure setup'
                  : step === 'security'
                    ? 'Replace recovery codes'
                    : step === 'claim'
                      ? 'Verify claim code'
                      : 'Continue'}
          </button>
        </form>
        <div class="auth-links">
          {#if step === 'security'}<button
              type="button"
              class="auth-link"
              disabled={busy}
              onclick={() =>
                work(async () => {
                  if (!demo) await client!.logout();
                  clearSecrets();
                  await show('login');
                })}
            >
              Sign out
            </button>{/if}
          {#if step === 'mfa'}<button
              type="button"
              class="auth-link"
              disabled={busy}
              onclick={() => {
                code = '';
                void show('recovery');
              }}
            >
              Use a recovery code
            </button>{/if}
          {#if step === 'recovery'}<button
              type="button"
              class="auth-link"
              disabled={busy}
              onclick={() => {
                recoveryCode = '';
                void show('mfa');
              }}
            >
              Use authenticator instead
            </button>{/if}
          {#if step !== 'claim' && step !== 'login'}<button
              type="button"
              class="auth-link"
              disabled={busy}
              onclick={restart}
            >
              Start again
            </button>{/if}
          {#if step === 'login'}<a href="/recover">
              Lost your authenticator?
            </a>{/if}
        </div>
      {/if}
      {#if entry === 'recover'}<details class="auth-help">
          <summary>Lost your password and recovery codes?</summary>
          <p>
            Local administrator recovery requires access to the installation
            host. Contact your installation administrator. The root-only
            recovery command is still awaiting installer integration and
            security review; no public reset or email recovery is enabled.
          </p>
        </details>{/if}
      <p class="auth-footer">Protected owner access · Cloudlane</p>
    </section>
  </main>
</div>

<style>
  .auth-page {
    min-height: 100vh;
    background:
      radial-gradient(
        ellipse at 12% 24%,
        rgba(87, 187, 158, 0.07),
        transparent 55%
      ),
      var(--bg);
    color: var(--text);
  }
  .auth-brand {
    max-width: 1240px;
    margin: auto;
    padding: 30px 42px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }
  .auth-brand > a {
    display: flex;
    gap: 12px;
    align-items: center;
    font-weight: 750;
    font-size: 21px;
    letter-spacing: -0.7px;
  }
  .auth-brand small {
    display: block;
    color: var(--muted);
    font-size: 8px;
    letter-spacing: 1.8px;
  }
  .auth-logo {
    width: 39px;
    height: 39px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #b9fff0, #61b8a9 63%, #5e84db);
    color: #062820;
    border-radius: 12px;
  }
  .auth-status {
    font-size: 11px;
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 30px;
    padding: 6px 11px;
  }
  .auth-main {
    display: grid;
    grid-template-columns: 1fr minmax(0, 460px);
    align-items: center;
    gap: 90px;
    max-width: 1120px;
    margin: auto;
    padding: 55px 42px 80px;
  }
  .auth-eyebrow {
    font-size: 10px;
    letter-spacing: 1.7px;
    font-weight: 700;
    color: var(--mint);
    margin: 0 0 15px;
  }
  .auth-intro h2 {
    font-size: 40px;
    line-height: 1.22;
    letter-spacing: -1.6px;
    margin: 0 0 22px;
    max-width: 420px;
  }
  .auth-intro > p:not(.auth-eyebrow) {
    color: var(--muted);
    max-width: 330px;
    line-height: 1.8;
  }
  .auth-intro-note {
    display: flex;
    gap: 15px;
    align-items: center;
    padding: 22px 0 28px;
    color: var(--muted);
    font-size: 12px;
    max-width: 345px;
  }
  .auth-intro-note > span {
    font-size: 30px;
    color: var(--mint);
  }
  .auth-intro > a {
    color: var(--mint);
    font-size: 12px;
    font-weight: 600;
  }
  .auth-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 30px;
    min-width: 0;
    box-shadow: 0 20px 60px rgb(0 0 0 / 0.15);
  }
  .auth-card h1 {
    font-size: 25px;
    letter-spacing: -0.8px;
    line-height: 1.25;
    margin: 0 0 16px;
  }
  .auth-card h1:focus {
    outline: none;
  }
  .auth-description {
    font-size: 14px;
    line-height: 1.8;
    color: var(--muted);
    margin: 0 0 22px;
  }
  .auth-banner {
    background: var(--bluebg);
    border: 1px solid var(--border2);
    border-radius: 8px;
    padding: 12px;
    font-size: 11px;
    color: var(--text);
    line-height: 1.7;
    margin-bottom: 22px;
  }
  .auth-card label:not(.auth-checkbox) {
    display: block;
    font-size: 14px;
    font-weight: 600;
    margin: 18px 0 8px;
  }
  .auth-card input {
    font-size: 16px;
    min-height: 42px;
    background: var(--bg);
    color: var(--text);
  }
  .auth-card input:disabled {
    opacity: 1;
    color: var(--muted);
  }
  .auth-card input:disabled::placeholder {
    color: var(--muted);
  }
  .auth-hint {
    color: var(--muted);
    font-size: 10px;
    line-height: 1.8;
    margin: 9px 0 18px;
  }
  .auth-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 43px;
    padding: 10px 16px;
    border-radius: 9px;
    font-weight: 700;
    font-size: 12px;
    background: var(--mint);
    color: #082720;
    border: 1px solid var(--mint);
    margin-top: 24px;
    white-space: normal;
  }
  .auth-button:hover {
    color: #082720;
    filter: brightness(1.06);
  }
  .auth-button.secondary {
    background: var(--panel2);
    color: var(--text);
    border-color: var(--border2);
    margin-top: 0;
  }
  .auth-links {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    justify-content: center;
    font-size: 11px;
    margin-top: 20px;
    color: var(--muted);
  }
  .auth-link {
    background: transparent;
    border: 0;
    color: var(--mint);
    font-size: 11px;
    padding: 0;
  }
  .auth-link:focus-visible,
  .auth-button:focus-visible,
  .auth-card summary:focus-visible {
    outline: 2px solid var(--mint);
    outline-offset: 4px;
  }
  .auth-error {
    border: 1px solid #63333f;
    background: var(--redbg);
    color: var(--red);
    border-radius: 8px;
    padding: 12px;
    font-size: 12px;
    margin-bottom: 16px;
  }
  .auth-notice {
    font-size: 11px;
    color: var(--mint);
  }
  .auth-footer {
    border-top: 1px solid var(--border);
    padding-top: 18px;
    margin: 25px 0 0;
    text-align: center;
    font-size: 10px;
    color: var(--muted);
  }
  .auth-qr {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 0 auto 20px;
    border-radius: 9px;
  }
  .auth-mono {
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.5px;
  }
  .auth-codes {
    list-style: none;
    padding: 14px;
    margin: 0;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .auth-codes li {
    font-size: 10px;
    line-height: 2.4;
    overflow-wrap: anywhere;
  }
  .auth-code-actions {
    display: flex;
    gap: 10px;
    margin: 12px 0 20px;
  }
  .auth-checkbox {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 11px;
    color: var(--muted);
    line-height: 1.6;
  }
  .auth-checkbox input {
    min-height: 16px;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .auth-help {
    margin-top: 20px;
    font-size: 11px;
    color: var(--muted);
    line-height: 1.8;
  }
  .auth-help summary {
    cursor: pointer;
    color: var(--text);
  }
  @media (max-width: 850px) {
    .auth-main {
      grid-template-columns: 1fr;
      max-width: 510px;
      gap: 30px;
      padding: 25px 22px 50px;
    }
    .auth-intro {
      display: none;
    }
    .auth-brand {
      padding: 25px 22px;
    }
    .auth-card {
      padding: 25px;
    }
    .auth-brand > a {
      font-size: 19px;
    }
  }
  @media (max-width: 390px) {
    .auth-status {
      display: none;
    }
    .auth-card {
      padding: 20px;
    }
    .auth-main {
      padding: 15px 14px 40px;
    }
  }
</style>
