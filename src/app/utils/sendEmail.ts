import ejs from "ejs";
import path from "path";
import { sendMail } from "../lib/nodemailer";

export const sendTemplateEmail = async (
	template: string,
	to: string,
	subject: string,
	data: Record<string, unknown>,
) => {
	const html = await ejs.renderFile(
		path.join(process.cwd(), "src", "app", "templates", template),
		data,
	);
	await sendMail(to, subject, html);
};
