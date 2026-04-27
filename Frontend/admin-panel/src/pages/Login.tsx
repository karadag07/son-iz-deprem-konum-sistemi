import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { token, login } = useAuth();
  const [email, setEmail] = useState("super@demo.com");
  const [password, setPassword] = useState("Demo123!");
  const [error, setError] = useState("");

  if (token) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await login(email, password);
    } catch {
      setError("Giriş başarısız. Demo: super@demo.com / Demo123!");
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="text-2xl font-bold text-slate-950">Afet Konum Kasası</div>
        <p className="mt-2 text-sm text-slate-500">Panel ve analiz MVP girişi</p>
        <label className="mt-6 block text-sm font-medium text-slate-700">E-posta</label>
        <input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="mt-4 block text-sm font-medium text-slate-700">Şifre</label>
        <input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        <button className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white hover:bg-slate-800">Giriş yap</button>
        <div className="mt-4 rounded-xl bg-slate-100 p-3 text-xs text-slate-600">
          Demo kullanıcılar: super@demo.com, operation@demo.com, viewer@demo.com. Şifre: Demo123!
        </div>
      </form>
    </div>
  );
}
