const express = require("express");
const fs = require("fs");
const axios = require("axios");
const moment = require("moment");
const admin = require("firebase-admin");
require("dotenv").config();

const { MPESA_CONFIG } = require("./config.js");



// ✅ Create the Express app FIRST
const app = express();

// ✅ Middleware
app.use(express.json());

// ✅ Firebase setup
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();




// Simple test route
app.get("/", (req, res) => {
    res.send("MPESA DARAJA API WITH NODE JS BY Hews SOFTWARES");
    var timeStamp = moment().format("YYYYMMDDHHmmss");
    console.log(timeStamp);
});






async function getAccessToken() {
    const consumer_key = MPESA_CONFIG.consumerKey; // REPLACE IT WITH YOUR CONSUMER KEY
    const consumer_secret = MPESA_CONFIG.consumerSecret; // REPLACE IT WITH YOUR CONSUMER SECRET
    const url =
        "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
    const auth =
        "Basic " +
        new Buffer.from(consumer_key + ":" + consumer_secret).toString("base64");

    try {
        const response = await axios.get(url, {
            headers: {
                Authorization: auth,
            },
        });

        const dataresponse = response.data;
        // console.log(data);
        const accessToken = dataresponse.access_token;
        return accessToken;
    } catch (error) {
        throw error;
    }
}



// STK Push endpoint
app.post("/stkpush", async (req, res) => {
    try {
        const { phoneNumber, amount, accountNumber } = req.body;
        console.log("📞 Received:", { phoneNumber, amount, accountNumber });

        const accessToken = await getAccessToken();

        const auth = "Bearer " + accessToken;
        const timestamp = moment().format("YYYYMMDDHHmmss");
        const password = Buffer.from(`${MPESA_CONFIG.shortCode}${MPESA_CONFIG.passkey}${timestamp}`).toString("base64");

        const response = await axios.post(
            "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
            {
                BusinessShortCode: MPESA_CONFIG.shortCode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: "CustomerPayBillOnline",
                Amount: amount,
                PartyA: phoneNumber,
                PartyB: MPESA_CONFIG.shortCode,
                PhoneNumber: phoneNumber,
                CallBackURL: MPESA_CONFIG.callbackUrl,
                AccountReference: accountNumber,
                TransactionDesc: "Mpesa Daraja API stk push test",
            },
            { headers: { Authorization: auth } }
        );

        res.json({
            status: true,
            message:
                "😀 STK Push initiated successfully. Please enter your M-Pesa PIN.",
            response: response.data,
        });
    } catch (error) {
        console.error("❌ STK Push failed:", error.response?.data || error.message);
        res.status(500).json({
            status: false,
            message: "❌ STK Push request failed",
            error: error.response?.data || error.message,
        });
    }
});






// STK Push Callback route
app.post("/callback", async (req, res) => {
    try {
        console.log("✅ STK PUSH CALLBACK RECEIVED!");

        const stkCallback = req.body.Body.stkCallback;
        const merchantRequestID = stkCallback.MerchantRequestID;
        const checkoutRequestID = stkCallback.CheckoutRequestID;
        const resultCode = stkCallback.ResultCode;
        const resultDesc = stkCallback.ResultDesc;
        const callbackMetadata = stkCallback.CallbackMetadata.Item;

        const amount = callbackMetadata[0].Value;
        const mpesaReceiptNumber = callbackMetadata[1].Value;
        const transactionDate = callbackMetadata[3].Value;
        const phoneNumber = callbackMetadata[4].Value;

        console.log("MerchantRequestID:", merchantRequestID);
        console.log("CheckoutRequestID:", checkoutRequestID);
        console.log("ResultCode:", resultCode);
        console.log("ResultDesc:", resultDesc);
        console.log("Amount:", amount);
        console.log("MpesaReceiptNumber:", mpesaReceiptNumber);
        console.log("TransactionDate:", transactionDate);
        console.log("PhoneNumber:", phoneNumber);

        // Save to Firestore
        await db.collection("payments").doc(checkoutRequestID).set({
            merchantRequestID,
            checkoutRequestID,
            resultCode,
            resultDesc,
            amount,
            mpesaReceiptNumber,
            transactionDate,
            phoneNumber,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log("✅ STK PUSH CALLBACK STORED IN FIRESTORE");

        res.status(200).json({ status: "Callback received" });
    } catch (error) {
        console.error("❌ Error handling callback:", error);
        res.status(500).json({ error: error.toString() });
    }
});




// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
