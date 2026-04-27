import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const nav = [
  { to: "/", label: "Dashboard" },
  { to: "/map", label: "Harita Analiz" },
  { to: "/priority", label: "Öncelikli Alanlar" },
  { to: "/audit", label: "Audit Log" }
];

export default function Layout() {
  const { admin, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 w-72 bg-slate-950 px-5 py-6 text-white">
        <div className="text-xl font-bold">Afet Konum Kasası</div>
        <div className="mt-2 text-sm text-slate-400">Panel + analiz demo MVP</div>
        <div className="mt-8 space-y-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-xl px-4 py-3 text-sm font-medium ${isActive ? "bg-white text-slate-950" : "text-slate-300 hover:bg-slate-800"}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="absolute bottom-6 left-5 right-5 rounded-2xl bg-slate-900 p-4">
          <div className="text-sm font-semibold">{admin?.name}</div>
          <div className="text-xs text-slate-400">{admin?.email}</div>
          <div className="mt-1 text-xs text-slate-500">{admin?.role}</div>
          <button onClick={logout} className="mt-4 w-full rounded-xl bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600">
            Çıkış
          </button>
        </div>
      </aside>
      <main className="ml-72 min-h-screen p-8">
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Bu sistem kesin kişi durumu üretmez. Veriler; son güvenilir konum, afet sonrası güncelleme durumu,
          manuel saha hasar/yıkım girdisi ve bölgesel yoğunluk üzerinden arama-kurtarma önceliği oluşturmak için kullanılır.
        </div>
        <Outlet />
      </main>
    </div>
  );
}
