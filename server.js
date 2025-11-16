const express = require("express");
const fs = require("fs");
const axios = require("axios");
const moment = require("moment");
const admin = require("firebase-admin");
require("dotenv").config();
const cors = require("cors");
const { MPESA_CONFIG } = require("./config.js");
const path = require("path");



// ✅ Create the Express app FIRST
const app = express();
// ✅ Enable CORS for all requests
app.use(cors());
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
                "😀 Request successful ✔✔. Please enter your M-Pesa PIN.",
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




// B2C WITHDRAWAL ROUTE
app.post("/b2curlrequest", (req, res) => {
    const { phoneNumber, amount } = req.body;

    if (!phoneNumber || !amount) {
        return res.status(400).json({
            error: "Phone number and amount are required",
        });
    }

    getAccessToken()
        .then((accessToken) => {
            const securityCredential =
                "N3Lx/hisedzPLxhDMDx80IcioaSO7eaFuMC52Uts4ixvQ/Fhg5LFVWJ3FhamKur/bmbFDHiUJ2KwqVeOlSClDK4nCbRIfrqJ+jQZsWqrXcMd0o3B2ehRIBxExNL9rqouKUKuYyKtTEEKggWPgg81oPhxQ8qTSDMROLoDhiVCKR6y77lnHZ0NU83KRU4xNPy0hRcGsITxzRWPz3Ag+qu/j7SVQ0s3FM5KqHdN2UnqJjX7c0rHhGZGsNuqqQFnoHrshp34ac/u/bWmrApUwL3sdP7rOrb0nWasP7wRSCP6mAmWAJ43qWeeocqrz68TlPDIlkPYAT5d9QlHJbHHKsa1NA==";

            const url = "https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest";

            axios
                .post(
                    url,
                    {
                        InitiatorName: "testapi",
                        SecurityCredential: securityCredential,
                        CommandID: "PromotionPayment",
                        Amount: amount,
                        PartyA: "600996", // Your shortcode
                        PartyB: phoneNumber, // Recipient (user)
                        Remarks: "Withdrawal",
                        QueueTimeOutURL: "https://yourdomain.com/b2c/queue",
                        ResultURL: "https://throughthelensbackend.onrender.com/b2c/result",
                        Occasion: "Auto Withdrawal",
                    },
                    {
                        headers: {
                            Authorization: "Bearer " + accessToken,
                        },
                    }
                )
                .then((response) => {
                    res.status(200).json({
                        status: true,
                        message: "Withdrawal request sent successfully",
                        mpesa: response.data,
                    });
                })
                .catch((error) => {
                    console.error(error);
                    res.status(500).json({
                        status: false,
                        message: "❌ B2C Request failed",
                        error: error.response?.data || error.message,
                    });
                });
        })
        .catch((err) => {
            console.error(err);
            res.status(500).json({
                status: false,
                message: "❌ Failed to get access token",
            });
        });
});



// B2C Result Callback Route
app.post("/b2c/result", async (req, res) => {
    try {
        console.log("✅ B2C RESULT CALLBACK RECEIVED!");

        const result = req.body.Result;
        const resultType = result.ResultType;
        const resultCode = result.ResultCode;
        const resultDesc = result.ResultDesc;
        const originatorConversationID = result.OriginatorConversationID;
        const conversationID = result.ConversationID;
        const transactionID = result.TransactionID;

        const resultParameters = result.ResultParameters?.ResultParameter || [];

        // Extract important fields
        let transactionAmount = null;
        let workingAccount = null;
        let utilityAccount = null;
        let transactionCompletedDateTime = null;
        let receiverPartyPublicName = null;
        let receiverPartyPhone = null;

        resultParameters.forEach((item) => {
            if (item.Key === "TransactionAmount") transactionAmount = item.Value;
            if (item.Key === "WorkingAccountAvailableFunds")
                workingAccount = item.Value;
            if (item.Key === "UtilityAccountAvailableFunds")
                utilityAccount = item.Value;
            if (item.Key === "TransactionCompletedDateTime")
                transactionCompletedDateTime = item.Value;
            if (item.Key === "ReceiverPartyPublicName")
                receiverPartyPublicName = item.Value;
            if (item.Key === "ReceiverPartyPhone")
                receiverPartyPhone = item.Value;
        });

        // Log everything
        console.log("ResultType:", resultType);
        console.log("ResultCode:", resultCode);
        console.log("ResultDesc:", resultDesc);
        console.log("OriginatorConversationID:", originatorConversationID);
        console.log("ConversationID:", conversationID);
        console.log("TransactionID:", transactionID);
        console.log("TransactionAmount:", transactionAmount);
        console.log("TransactionCompletedDateTime:", transactionCompletedDateTime);
        console.log("ReceiverPartyPublicName:", receiverPartyPublicName);
        console.log("ReceiverPartyPhone:", receiverPartyPhone);

        // Save to Firestore
        await db.collection("b2c_results").doc(conversationID).set({
            resultType,
            resultCode,
            resultDesc,
            originatorConversationID,
            conversationID,
            transactionID,
            transactionAmount,
            transactionCompletedDateTime,
            receiverPartyPublicName,
            receiverPartyPhone,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log("✅ B2C RESULT CALLBACK STORED IN FIRESTORE");

        res.status(200).json({ status: "B2C callback received" });
    } catch (error) {
        console.error("❌ Error handling B2C callback:", error);
        res.status(500).json({ error: error.toString() });
    }
});






const logFile = path.join(process.cwd(), "visited_paths.csv");
const sitemapFile = path.join(process.cwd(), "sitemap.xml");

// Helper: add a new path
function addPath(pathStr) {
    const date = new Date().toISOString().split("T")[0];
    const line = `${pathStr},${date}\n`;
    fs.appendFileSync(logFile, line, "utf8");
    console.log(`✅ Logged path: ${pathStr}`);
}

// Endpoint: save path (replaces save_path.php)
app.get("/save_path.php", (req, res) => {
    const visitedPath = req.query.path;
    if (!visitedPath) {
        return res.status(400).json({ error: "Missing path" });
    }

    addPath(visitedPath);
    res.json({ status: "added", path: visitedPath });
});

/// Endpoint: generate sitemap (replaces sitemap.php)
app.get(["/sitemap.php", "/sitemap.xml"], (req, res) => {
    try {
        if (!fs.existsSync(logFile)) {
            return res
                .status(404)
                .json({ error: "No visited paths found. Log file missing." });
        }

        // Read and clean up logged URLs
        const lines = fs
            .readFileSync(logFile, "utf8")
            .trim()
            .split("\n")
            .filter(Boolean);

        // Extract unique paths only
        const urls = [...new Set(lines.map((line) => line.split(",")[0].trim()))];

        // Generate XML content
        const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
            urls
                .map(
                    (u) => `
  <url>
    <loc>https://throughthelens.pages.dev${u}</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
                )
                .join("\n") +
            `\n</urlset>`;

        // Save it to sitemap.xml
        fs.writeFileSync(sitemapFile, sitemapContent, "utf8");
        console.log("🗺️ Sitemap successfully updated with", urls.length, "URLs.");

        // Respond to browser or crawler
        res.type("application/xml").send(sitemapContent);
    } catch (err) {
        console.error("❌ Sitemap generation failed:", err);
        res.status(500).json({ error: "Failed to generate sitemap" });
    }
});






// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
