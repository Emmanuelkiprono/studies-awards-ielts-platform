import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import admin from "firebase-admin";
import path from "path";
import { createServer as createViteServer } from "vite";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function initFirebaseAdmin() {
  const saString = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!saString) {
    console.warn(
      "FIREBASE_SERVICE_ACCOUNT is not set. Firebase Admin routes will be disabled."
    );
    return null;
  }

  try {
    const serviceAccount = JSON.parse(saString);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin initialized.");
    return admin;
  } catch (error) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT:", error);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const HMR_PORT = process.env.HMR_PORT ? Number(process.env.HMR_PORT) : undefined;

  const firebaseAdmin = initFirebaseAdmin();

  app.use(express.json());
  app.use(cookieParser());

  // API Route: Create Teacher Account
  app.post("/api/admin/create-teacher", async (req, res) => {
    try {
      const { name, email, academyId } = req.body ?? {};

      if (!firebaseAdmin || !admin.apps || admin.apps.length === 0) {
        return res.status(500).json({
          success: false,
          error:
            "Firebase Admin not initialized. Set FIREBASE_SERVICE_ACCOUNT in .env to enable this route.",
        });
      }

      if (!email || typeof email !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "Missing or invalid 'email'." });
      }

      // Generate a temporary password
      const tempPassword = Math.random().toString(36).slice(-10) + "A1!";

      // Create Firebase Auth user
      const userRecord = await admin.auth().createUser({
        email,
        password: tempPassword,
        displayName: typeof name === "string" ? name : undefined,
      });

      // Create Firestore document
      const db = admin.firestore();
      await db.collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        name: typeof name === "string" ? name : null,
        email: email.toLowerCase(),
        role: "teacher",
        academyId: typeof academyId === "string" ? academyId : "studies_awards",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        fcmToken: null,
        forcePasswordChange: true, // Flag to force password change on first login
      });

      return res.json({
        success: true,
        uid: userRecord.uid,
        tempPassword,
        message: "Teacher account created successfully.",
      });
    } catch (error: any) {
      console.error("Error creating teacher:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "An unknown error occurred",
      });
    }
  });

  // Catch-all for API routes to return JSON
  app.all("/api/*", (req, res) => {
    res
      .status(404)
      .json({ success: false, error: `API route ${req.method} ${req.url} not found` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: HMR_PORT ? { port: HMR_PORT } : undefined,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
