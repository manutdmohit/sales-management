export type EmailConfig = {
  apiKey: string;
  from: string;
};

/** Resend sender — use onboarding@resend.dev until your domain is verified. */
export function getEmailConfig(): EmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Inventory Platform <onboarding@resend.dev>";

  return { apiKey, from };
}

export function isEmailConfigured(): boolean {
  return getEmailConfig() !== null;
}
