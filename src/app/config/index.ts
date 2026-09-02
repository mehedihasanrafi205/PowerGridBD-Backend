import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const get = (key: string) => process.env[key];

export default {
	node_env: get("NODE_ENV"),
	port: get("PORT"),
	app_url: get("APP_URL") || get("BACKEND_URL"),
	frontend_url: get("FRONTEND_URL"),

	database_url: get("DATABASE_URL"),

	bcrypt_salt_rounds: Number(get("BCRYPT_SALT_ROUNDS")) || 10,

	jwt_access_secret: get("JWT_ACCESS_SECRET")!,
	jwt_refresh_secret: get("JWT_REFRESH_SECRET")!,
	jwt_access_expires_in: get("JWT_ACCESS_EXPIRES_IN")!,
	jwt_refresh_expires_in: get("JWT_REFRESH_EXPIRES_IN")!,

	google_client_id: get("GOOGLE_CLIENT_ID"),

	tester_admin_name: get("TESTER_ADMIN_NAME"),
	tester_admin_email: get("TESTER_ADMIN_EMAIL"),
	tester_admin_password: get("TESTER_ADMIN_PASSWORD"),

	redis_user: get("REDIS_USER"),
	redis_password: get("REDIS_PASSWORD"),
	redis_host: get("REDIS_HOST"),
	redis_port: get("REDIS_PORT"),

	email_sender: get("EMAIL_SENDER"),
	smtp_user: get("SMTP_USER"),
	smtp_password: get("SMTP_PASSWORD"),

	cloudinary_cloud_name: get("CLOUDINARY_CLOUD_NAME"),
	cloudinary_api_key: get("CLOUDINARY_API_KEY"),
	cloudinary_api_secret: get("CLOUDINARY_API_SECRET"),
};
