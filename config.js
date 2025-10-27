// config.js
import dotenv from "dotenv";

dotenv.config();

export const MPESA_CONFIG = {
    consumerKey: process.env.CONSUMER_KEY,
    consumerSecret: process.env.CONSUMER_SECRET,
    shortCode: process.env.SHORT_CODE,
    passkey: process.env.PASSKEY,
    callbackUrl: process.env.CALLBACK_URL,
};

