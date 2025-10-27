const express = require("express");
const fs = require("fs"); // Import fs
const app = express();
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);




// Middleware to parse JSON
app.use(express.json());




admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore(); // Firestore reference




// Simple test route
app.get("/", (req, res) => {
    res.send("🚀 M-Pesa Server is Live on Render!");
});


// STK Push Callback route
app.post("/api/callback", async (req, res) => {
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
