import { OAuth2Client } from "google-auth-library";
import config from "../config";

export const googleAuthClient = config.google_client_id
	? new OAuth2Client(config.google_client_id)
	: null;
