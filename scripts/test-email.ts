/**
 * Send a test email via Resend.
 *
 * Usage (pick one — avoid `--to=`; npm treats it as its own flag):
 *   npm run test:email -- mohitdev4444@gmail.com
 *   npm run test:email -- --recipient=mohitdev4444@gmail.com
 *   set TEST_EMAIL_TO=mohitdev4444@gmail.com && npm run test:email
 *
 * Requires RESEND_API_KEY in .env or .env.local
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

function parseFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit?.slice(prefix.length);
}

function parseRecipient(): string | undefined {
  return (
    process.env.TEST_EMAIL_TO?.trim() ||
    parseFlag("recipient") ||
    process.argv.slice(2).find((a) => !a.startsWith("-") && a.includes("@"))
  );
}

function promptRecipient(): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write("Recipient email: ");
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (chunk) => {
      input += chunk;
      resolve(input.trim());
    });
  });
}

async function main() {
  let to = parseRecipient();
  if (!to && process.stdin.isTTY) {
    to = await promptRecipient();
  }
  if (!to) {
    console.error(
      "Do not use --to= (npm blocks it on Windows).\n\n" +
        "Usage:\n" +
        "  npm run test:email -- saudmohit@gmail.com\n" +
        "  npm run test:email -- --recipient=saudmohit@gmail.com\n" +
        "  npm run test:email   (prompts for email)"
    );
    process.exit(1);
  }

  const { emailService } = await import("../src/services/email.service");

  if (!emailService.isConfigured()) {
    console.error(
      "RESEND_API_KEY is not set. Add it to .env.local and try again."
    );
    process.exit(1);
  }

  console.log(`From: ${emailService.getFromAddress()}`);
  console.log(`To:   ${to}`);
  console.log("Sending…");

  const { id } = await emailService.sendTest(to);
  console.log(`Sent — Resend message id: ${id}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
