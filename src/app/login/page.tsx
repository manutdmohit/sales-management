import { loginAction } from "@/app/login/actions";
import { MAGIC_TOUCH_BRAND } from "@/domain/brand";

type LoginPageProps = {
  searchParams: Promise<{ from?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { from, error } = await searchParams;
  const showError = error === "invalid";

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={MAGIC_TOUCH_BRAND.logoUrl}
            alt={`${MAGIC_TOUCH_BRAND.name} logo`}
            className="login-logo"
            width={48}
            height={48}
          />
          <h1 className="login-title">{MAGIC_TOUCH_BRAND.name}</h1>
          <p className="login-subtitle">{MAGIC_TOUCH_BRAND.address}</p>
        </div>

        {showError && (
          <p className="login-error" role="alert">
            Invalid email or password. Please try again.
          </p>
        )}

        <form action={loginAction}>
          {from ? <input type="hidden" name="from" value={from} /> : null}
          <div className="login-field">
            <label className="login-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="login-input"
              placeholder="admin@inventory.local"
            />
          </div>
          <div className="login-field">
            <label className="login-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="login-input"
            />
          </div>
          <button type="submit" className="login-button">
            Sign in
          </button>
        </form>

        <p className="login-hint">
          Admin: <code>admin@inventory.local</code> / <code>admin123</code>
          <br />
          Staff: <code>staff@inventory.local</code> / <code>staff123</code>
        </p>
      </div>
    </div>
  );
}
