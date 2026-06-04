import { Resend } from "resend";
import { AppError } from "@/lib/errors";
import { getEmailConfig } from "@/lib/email/config";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export const emailService = {
  isConfigured(): boolean {
    return getEmailConfig() !== null;
  },

  /** Sender address shown to recipients (no API key). */
  getFromAddress(): string | null {
    return getEmailConfig()?.from ?? null;
  },

  /**
   * Send without throwing — skips when Resend is not configured and logs failures.
   * Safe to call from event handlers.
   */
  async sendSafe(input: SendEmailInput): Promise<{ id: string } | null> {
    if (!getEmailConfig()) {
      console.info("[email] skipped (RESEND_API_KEY not set):", input.subject);
      return null;
    }
    try {
      return await this.send(input);
    } catch (error) {
      console.error(
        "[email] send failed:",
        error instanceof Error ? error.message : error
      );
      return null;
    }
  },

  async send(input: SendEmailInput): Promise<{ id: string }> {
    const config = getEmailConfig();
    if (!config) {
      throw new AppError(
        "Email is not configured. Set RESEND_API_KEY in .env.local",
        503,
        "EMAIL_NOT_CONFIGURED"
      );
    }

    const to = Array.isArray(input.to) ? input.to : [input.to];
    if (to.length === 0 || to.some((addr) => !addr.trim())) {
      throw new AppError("At least one recipient is required", 400);
    }

    const resend = new Resend(config.apiKey);
    const { data, error } = await resend.emails.send({
      from: config.from,
      to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    });

    if (error) {
      throw new AppError(error.message, 502, "EMAIL_SEND_FAILED");
    }
    if (!data?.id) {
      throw new AppError("Email provider returned no message id", 502);
    }

    return { id: data.id };
  },

  async sendTest(to: string): Promise<{ id: string }> {
    return this.send({
      to,
      subject: "Inventory Platform — test email",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; line-height: 1.5;">
          <h2 style="color: #2563eb;">Email delivery works</h2>
          <p>This is a test message from <strong>Inventory Platform</strong>.</p>
          <p style="color: #64748b; font-size: 14px;">
            Sent via Resend at ${new Date().toISOString()}
          </p>
        </div>
      `.trim(),
      text: `Email delivery works. Test from Inventory Platform at ${new Date().toISOString()}`,
    });
  },
};
