import type { Request, Response, NextFunction } from "express";
import { verifyIdToken } from "../lib/firebaseAdmin";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

/** Attaches req.userId / req.userEmail when a valid Firebase Bearer token is present. Never blocks the request. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const decoded = await verifyIdToken(token);
    if (decoded) {
      req.userId = decoded.uid;
      req.userEmail = decoded.email;
    }
  }
  next();
}

/** Rejects the request with 401 if no valid auth token is present. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  await optionalAuth(req, res, async () => {
    if (!req.userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    next();
  });
}
