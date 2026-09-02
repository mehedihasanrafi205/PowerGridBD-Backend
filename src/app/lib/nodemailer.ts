import nodemailer from "nodemailer";
import config from "../config";

export const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: config.smtp_user,
		pass: config.smtp_password,
	},
});

export const sendMail = async (to: string, subject: string, html: string) => {
	await transporter.sendMail({
		from: config.email_sender,
		to,
		subject,
		html,
	});
};
