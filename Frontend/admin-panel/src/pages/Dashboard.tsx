import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client";
import StatCard from "../components/StatCard";
import { DisasterEvent, PriorityArea, NetworkResult, LocationSyncStatus } from "../types";

interface UpdateRequest {
  id: string;
  requestedAt: string;
  targetDeviceCount: number;
  responseCount: number;
  noResponseCount: number;
  note: string;
}

interface DashboardData {
  disaster: DisasterEvent;
  network: NetworkResult;
  counts: {
    totalDevicesInArea: number;
    postDisasterUpdated: number;
    notUpdated: number;
    debrisReports: number;
    priorityAreas: number;
    deviceStatuses: number;
    updateRequests: number;
  };
  lastUpdateRequest: UpdateRequest | null;
  topPriorityAreas: PriorityArea[];
  locationSync?: LocationSyncStatus;
}

function getErrorMessage(err: unknown, fallback: string) {
  const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
  return anyErr?.response?.data?.message ?? anyErr?.message ?? fallback;
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("tr-TR");
}

export default function Dashboard() {
  const [disasters, setDisasters] = useState<DisasterEvent[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refreshDashboard(id: string) {
    const { data: refreshed } = await api.get(`/admin/disasters/${id}/dashboard`);
    setData(refreshed);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    api.get("/admin/disasters")
      .then((res) => {
        if (!active) return;
        const list: DisasterEvent[] = res.data.disasters ?? [];
        setDisasters(list);
        setSelectedId(list[0]?.id ?? "");
        if (!list.length) {
          setError("Demo afet olayı bulunamadı. Backend demo verisi yüklenememiş olabilir.");
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(getErrorMessage(err, "Backend'e ulaşılamadı. Backend terminalinin çalıştığını kontrol et."));
        setLoading(false);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setLoading(true);
    setError("");
    setNotice("");

    api.get(`/admin/disasters/${selectedId}/dashboard`)
      .then((res) => {
        if (!active) return;
        setData(res.data);
      })
      .catch((err) => {
        if (!active) return;
        setError(getErrorMessage(err, "Dashboard verisi alınamadı."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [selectedId]);

  async function analyze() {
    if (!selectedId) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await api.post(`/admin/disasters/${selectedId}/analyze`);
      await refreshDashboard(selectedId);
      setNotice("Analiz çalıştırıldı. Öncelikli kontrol alanları güncellendi.");
    } catch (err) {
      setError(getErrorMessage(err, "Analiz çalıştırılamadı."));
    } finally {
      setLoading(false);
    }
  }

  async function requestDeviceUpdate() {
    if (!selectedId) return;
    setRequesting(true);
    setError("");
    setNotice("");
    try {
      const res = await api.post(`/admin/disasters/${selectedId}/request-device-update`);
      await refreshDashboard(selectedId);
      setNotice(res.data.message ?? "Cihazlardan afet sonrası veri güncellemesi istendi.");
    } catch (err) {
      setError(getErrorMessage(err, "Cihazlardan veri güncellemesi istenemedi."));
    } finally {
      setRequesting(false);
    }
  }

  const chartData = useMemo(() => data?.topPriorityAreas.map((area, index) => ({
    name: area.addressText || `Alan ${index + 1}`,
    skor: area.priorityScore,
    sinyal: area.preDisasterSignalCount,
    guncellenmedi: area.notUpdatedCount
  })) ?? [], [data]);

  if (loading && !data) {
    return <div className="rounded-2xl bg-white p-6 text-slate-600 shadow-sm">Yükleniyor...</div>;
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <div className="text-lg font-bold">Dashboard verisi alınamadı</div>
        <p className="mt-2">{error}</p>
        <div className="mt-4 rounded-xl bg-white p-4 text-sm text-slate-700">
          Backend kontrolü: <span className="font-mono">http://localhost:4000/health</span><br />
          Oturum sorunu varsa çıkış yapıp tekrar giriş yap.
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-slate-600">Veri bulunamadı.</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Ana Dashboard</h1>
          <p className="mt-1 text-slate-600">Afet alanı, anlık veri güncelleme isteği, şebeke tahmini ve aciliyet sıralı arama önceliği analizi.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <select className="rounded-xl border border-slate-300 px-4 py-3" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {disasters.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <button disabled={requesting || loading} onClick={requestDeviceUpdate} className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-400">
            {requesting ? "İsteniyor..." : "Cihazlardan Anlık Güncelleme İste"}
          </button>
          <button disabled={loading} onClick={analyze} className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
            {loading ? "Çalışıyor..." : "Analiz Çalıştır"}
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        {data.network.notice}
        <div className="mt-2 text-blue-950">
          Konum kaynağı: <b>{data.locationSync?.source === "postgres" ? "PostgreSQL device_locations" : "Demo"}</b>
          {data.locationSync?.loadedCount !== undefined ? <> · Yüklenen kayıt: <b>{data.locationSync.loadedCount}</b></> : null}
          {data.locationSync?.refreshedAt ? <> · Son okuma: <b>{formatDate(data.locationSync.refreshedAt)}</b></> : null}
        </div>
        <div className="mt-2 text-blue-950">
          Anlık güncelleme isteği sadece seçili afet bölgesindeki cihazlara yöneliktir. Mobil push henüz eklenmediği için demo ortamında yeni veri gelmez; hedef cihazlar “afet sonrası veri güncellenmedi” kategorisinde kalır.
        </div>
      </div>

      {notice && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {notice}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error}
        </div>
      )}

      <div className="grid grid-cols-7 gap-4">
        <StatCard title="Afet Alanındaki Cihaz" value={data.counts.totalDevicesInArea} />
        <StatCard title="Afet Sonrası Veri Güncellendi" value={data.counts.postDisasterUpdated} />
        <StatCard title="Afet Sonrası Veri Güncellenmedi" value={data.counts.notUpdated} />
        <StatCard title="Güncelleme Oranı" value={`%${data.network.updateRatePercent}`} sub={data.network.analysisMode} />
        <StatCard title="Manuel Hasar/Yıkım Girdisi" value={data.counts.debrisReports} />
        <StatCard title="Öncelikli Alan" value={data.counts.priorityAreas} />
        <StatCard title="Güncelleme İsteği" value={data.counts.updateRequests} sub={data.lastUpdateRequest ? formatDate(data.lastUpdateRequest.requestedAt) : "Henüz yok"} />
      </div>

      {data.lastUpdateRequest && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
          <div className="font-bold text-slate-950">Son anlık veri güncelleme isteği</div>
          <div className="mt-2 grid gap-3 md:grid-cols-4">
            <div>Hedef cihaz: <b>{data.lastUpdateRequest.targetDeviceCount}</b></div>
            <div>Gelen yeni veri: <b>{data.lastUpdateRequest.responseCount}</b></div>
            <div>Veri gelmeyen: <b>{data.lastUpdateRequest.noResponseCount}</b></div>
            <div>Zaman: <b>{formatDate(data.lastUpdateRequest.requestedAt)}</b></div>
          </div>
          <p className="mt-2 text-slate-500">{data.lastUpdateRequest.note}</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 text-lg font-bold">En Yüksek Arama Önceliği Skorları</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="skor" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="text-lg font-bold">Hızlı Geçiş</div>
          <div className="mt-4 space-y-3">
            <Link className="block rounded-xl border border-slate-200 p-4 hover:bg-slate-50" to="/map">Harita Analiz Ekranı</Link>
            <Link className="block rounded-xl border border-slate-200 p-4 hover:bg-slate-50" to="/priority">Öncelikli Kontrol Alanları</Link>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-4 text-lg font-bold">İlk 5 Öncelikli Kontrol Alanı</div>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Seviye</th><th>Skor</th><th>Adres</th><th>Sinyal</th><th>Güncellenmedi</th><th>Öneri</th></tr></thead>
            <tbody>
              {data.topPriorityAreas.map((area) => (
                <tr key={area.id} className="border-t border-slate-100">
                  <td className="p-3 font-semibold">{area.priorityLevel}</td>
                  <td>{area.priorityScore}</td>
                  <td>{area.addressText}</td>
                  <td>{area.preDisasterSignalCount}</td>
                  <td>{area.notUpdatedCount}</td>
                  <td>{area.suggestedAreaText}</td>
                </tr>
              ))}
              {!data.topPriorityAreas.length && (
                <tr><td colSpan={6} className="p-4 text-slate-500">Henüz öncelikli kontrol alanı yok. Manuel hasar/yıkım girip analiz çalıştır.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
