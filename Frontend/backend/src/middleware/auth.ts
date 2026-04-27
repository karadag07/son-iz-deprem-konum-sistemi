import { NextFunction, Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { store } from "../data/demoData.js";
import { AdminUser, Role } from "../types.js";

export interface AuthRequest extends Request {
  admin?: Omit<AdminUser, "passwordHash">;
}

const secret = process.env.JWT_SECRET ?? "change-me-in-production";

export function signAdminToken(admin: AdminUser): string {
  const options: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN ?? "12h") as SignOptions["expiresIn"] };
  return jwt.sign({ sub: admin.id, email: admin.email, role: admin.role }, secret, options);
}

export function authRequired(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    store.auditLogs.unshift({
      id: randomUUID(),
      actionType: "UNAUTHORIZED_ATTEMPT",
      resourceType: "AUTH",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: { path: req.path, reason: "missing_token" },
      createdAt: new Date().toISOString()
    });
    return res.status(401).json({ message: "Yetkisiz erişim." });
  }

  try {
    const payload = jwt.verify(token, secret) as { sub: string; email: string; role: Role };
    const admin = store.admins.find((item) => item.id === payload.sub && item.isActive);
    if (!admin) throw new Error("inactive_admin");
    const { passwordHash, ...safeAdmin } = admin;
    req.admin = safeAdmin;
    return next();
  } catch {
    store.auditLogs.unshift({
      id: randomUUID(),
      actionType: "UNAUTHORIZED_ATTEMPT",
      resourceType: "AUTH",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: { path: req.path, reason: "invalid_token" },
      createdAt: new Date().toISOString()
    });
    return res.status(401).json({ message: "Geçersiz veya süresi dolmuş token." });
  }
}

export function requireRoles(roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      store.auditLogs.unshift({
        id: randomUUID(),
        adminUserId: req.admin?.id,
        adminEmail: req.admin?.email,
        actionType: "FORBIDDEN_ATTEMPT",
        resourceType: "RBAC",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        metadata: { path: req.path, requiredRoles: roles, actualRole: req.admin?.role },
        createdAt: new Date().toISOString()
      });
      return res.status(403).json({ message: "Bu işlem için yetki yok." });
    }
    return next();
  };
}

export function auditAction(actionType: string, resourceType: string, resourceId?: string, metadata?: Record<string, unknown>) {
  return (req: AuthRequest) => {
    store.auditLogs.unshift({
      id: randomUUID(),
      adminUserId: req.admin?.id,
      adminEmail: req.admin?.email,
      actionType,
      resourceType,
      resourceId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata,
      createdAt: new Date().toISOString()
    });
  };
}
