"use client";

import { useFormStatus } from "react-dom";

export function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="login-button"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <span className="login-button-spinner" aria-hidden />
          Signing in…
        </>
      ) : (
        "Sign in"
      )}
    </button>
  );
}
