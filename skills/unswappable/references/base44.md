# Base44 apps

A Base44 app often makes visitors log in before they see anything. Then the landing page is a login wall, and nobody learns what the product is. When the site is a Base44 app, the goal is a public landing page that anyone can open, the app's own branded login page, and every private page still behind that login.

Facts here come from the Base44 platform API and the official `base44/skills` repo (SDK auth, platform-frontend and CLI references). When the Base44 MCP tools are connected, re-check them against `GET /api/apps/{app_id}/agent-profile` and the skill references it lists, because the platform changes.

## Spot it

Any one of these means it is a Base44 app:
- `@base44/sdk` in `package.json`
- a `base44Client` file, or `createClient({ appId })`
- calls to `base44.auth` or `base44.entities`
- a `*.base44.app` address
- the Base44 MCP tools returning this app

Then read `GET /api/apps/{app_id}` (for `public_settings` and `auth_config`) and the agent profile (for `framework`, `vite_spa` or `tanstack_start`, and `custom_auth_enrolled`).

## What to change

1. **Make the landing page public.** This needs the owner's explicit yes, because it changes who can open the app. Ask in plain words: "Your app is set to make everyone log in first, so the landing page is hidden. Can I switch it to public, so anyone can see the landing page, while every private page still needs a login?"
   - Only after a yes: `PATCH /api/apps/{app_id}` with `{"public_settings": "public_without_login"}`. Workspace SSO rules can still force a login; if so, say so.
   - Without the MCP tools, the owner does it themselves: Settings → Access, or `base44 visibility public`.
2. **Lock the data before it is public.** A public app is only as safe as its entity security rules. Check every entity's `rls` before switching:
   - Private records are owner-only: `{"created_by": "{{user.email}}"}`.
   - Admin data uses `{"user_condition": {"role": "admin"}}`.
   - Only content meant for everyone gets `"read": true`.
   - Sensitive fields get field-level `rls`.

   Show the owner any entity that would become readable by strangers, and fix it before going public. Keep `asServiceRole` in backend functions only.
3. **Use the app's own login.** The custom-auth boilerplate gives the app its own login pages instead of the platform's. It needs `custom_auth_enrolled: true` and public visibility.
   - If the profile does not show it enrolled, there is no documented enroll command. Ask the builder AI for it with `edit_base44_app`, or have the owner turn it on. Do not hand-build a login page while the platform login is in charge.
   - Five routes come together: `/login`, `/register`, `/forgot-password`, `/reset-password` and `/mfa`. In Vite apps they are in `src/pages/`; in TanStack apps they are in `src/components/auth/` with routes in `src/routes/`. Keep them all, and restyle them in the concept. Do not rewrite their logic.
4. **Gate the private pages, not the landing.**
   - **Vite:** put private routes inside `<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />`, and keep `/` and the other marketing pages outside it.
   - **TanStack:** put private routes under a pathless `_authed` layout with `beforeLoad: requireSignedIn`. Public pages stay server-rendered.
5. **Design the login as part of the site.** The login, register, verify-email and reset screens carry the concept and the vibe. They are part of the state list, and they get the blind review like every other page.

## SDK calls the login pages use

Do not write auth backend logic. The platform owns tokens, sessions and email verification.

| Need | Call |
| --- | --- |
| Sign in | `base44.auth.loginViaEmailPassword(email, password)`. 401 means wrong details, 403 means the email is not verified. The boilerplate wraps it with MFA handling. |
| Sign up | `register({ email, password })`. This does not sign the user in. Then `verifyOtp({ email, otpCode })`, then `setToken(access_token)`, then a full-page redirect. Resend the code with `resendOtp(email)`. |
| Google and other providers | `loginWithProvider('google', returnTo)`. The others are `microsoft`, `facebook`, `apple` and `sso`. Turn methods on in `auth_config` (owner's yes). |
| Password reset | `resetPasswordRequest(email)`, then `resetPassword({ resetToken, newPassword })`. |
| Who is signed in | `me()`, where 401 means a visitor, or `isAuthenticated()`. |
| Sign out | `logout(redirectUrl)`. |
| After sign-in | Redirect to a same-origin `returnTo` with `window.location.href`. Avoid `redirectToLogin`. |

Passwords are 8 to 72 bytes. Rate limits are per IP. Users cannot sign in until they verify their email.

## Change the code the right way

- Read the app's `AGENTS.md` and keep its framework. Never move it to another framework or router.
- Make exact changes with the file tools (`read_file`, `edit_file`, `write_file`). Use the builder AI only for changes that still need designing. Never use both on the same change, and never edit while the app's status is `processing`.
- Call `create_checkpoint` after each set of edits. Use `GET /api/apps/{app_id}/sandbox/preview-url` to review the work, and run the whole unswappable review on that preview.
- Publish (`POST /api/apps/{app_id}/deploy`) only with the owner's yes.
