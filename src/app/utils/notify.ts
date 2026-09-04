import path from "path";
import ejs from "ejs";
import config from "../config";
import { transporter } from "../lib/nodemailer";

/**
 * Best-effort templated email sender. Never throws — notifications
 * must not break the business flow that triggers them.
 */
export const sendTemplatedEmail = async (
  to: string,
  subject: string,
  template: string,
  data: Record<string, unknown> = {},
): Promise<void> => {
  try {
    const html = await ejs.renderFile(
      path.join(process.cwd(), "src/app/templates", template),
      { year: new Date().getFullYear(), ...data },
    );

    await transporter.sendMail({
      from: config.email_sender,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error(`[notify] failed to send "${subject}" to ${to}:`, error);
  }
};
