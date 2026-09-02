import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  node_env: process.env.NODE_ENV,
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,
  bak_url: process.env.APP_URL,
  frontend_url: process.env.FRONTEND_URL,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  jwt_access_secret: process.env.JWT_ACCESS_SECRET!,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET!,
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN!,
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN!,
  google_client_id: process.env.GOOGLE_CLIENT_ID!,
  tester_admin_name: process.env.TESTER_ADMIN_NAME!,
  tester_admin_email: process.env.TESTER_ADMIN_EMAIL!,
  tester_admin_password: process.env.TESTER_ADMIN_PASSWORD!,
  tester_power_operator_name: process.env.TESTER_POWER_OPERATOR_NAME!,
  tester_power_operator_email: process.env.TESTER_POWER_OPERATOR_EMAIL!,
  tester_power_operator_password: process.env.TESTER_POWER_OPERATOR_PASSWORD!,
  tester_technician_name: process.env.TESTER_TECHNICIAN_NAME!,
  tester_technician_email: process.env.TESTER_TECHNICIAN_EMAIL!,
  tester_technician_password: process.env.TESTER_TECHNICIAN_PASSWORD!,
  redis_user: process.env.REDIS_USER!,
  redis_password: process.env.REDIS_PASSWORD!,
  redis_host: process.env.REDIS_HOST!,
  redis_port: process.env.REDIS_PORT!,
  email_sender: process.env.EMAIL_SENDER!,
  smtp_user: process.env.SMTP_USER!,
  smtp_password: process.env.SMTP_PASSWORD!,
  cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY!,
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET!,
};
