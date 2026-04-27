import { useEffect, useState } from "react";
import { api } from "../api/client";
import { AuditLog } from "../types";

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    api.get("/admin/audit-logs").then((res) => setLogs(res.data.auditLogs));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-950">Audit Log</h1>
        <p className="mt-1 text-slate-600">Paneldeki kritik davranışlar ve yetkisiz erişim denemeleri.</p>
      </div>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Zaman</th><th>Kullanıcı</th><th>Aksiyon</th><th>Kaynak</th><th>IP</th></tr></thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-slate-100">
                <td className="p-3">{new Date(log.createdAt).toLocaleString("tr-TR")}</td>
                <td>{log.adminEmail ?? "-"}</td>
                <td className="font-semibold">{log.actionType}</td>
                <td>{log.resourceType}</td>
                <td>{log.ipAddress ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
