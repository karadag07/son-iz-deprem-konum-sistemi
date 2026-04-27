import { useEffect, useState } from "react";
import { api } from "../api/client";
import { DisasterEvent, PriorityArea } from "../types";

function getErrorMessage(err: unknown, fallback: string) {
  const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
  return anyErr?.response?.data?.message ?? anyErr?.message ?? fallback;
}

function damageLabel(value: PriorityArea["damageLevel"]) {
  if (value === "COLLAPSED") return "Yıkım";
  if (value === "HIGH") return "Yüksek hasar";
  if (value === "MEDIUM") return "Orta hasar";
  if (value === "LOW") return "Düşük hasar";
  return "Belirsiz";
}

export default function PriorityAreas() {
  const [disasters, setDisasters] = useState<DisasterEvent[]>([]);
  const [disasterId, setDisasterId] = useState("");
  const [areas, setAreas] = useState<PriorityArea[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadAreas(id: string) {
    const { data } = await api.get(`/admin/disasters/${id}/priority-areas`);
    setAreas(data.priorityAreas ?? []);
  }

  useEffect(() => {
    api.get("/admin/disasters")
      .then((res) => {
        setDisasters(res.data.disasters);
        const first = res.data.disasters[0]?.id ?? "";
        setDisasterId(first);
        if (first) loadAreas(first);
      })
      .catch((err) => setError(getErrorMessage(err, "Afet listesi alınamadı.")));
  }, []);

  async function analyze() {
    if (!disasterId) return;
    setNotice("");
    setError("");
    try {
      await api.post(`/admin/disasters/${disasterId}/analyze`);
      await loadAreas(disasterId);
      setNotice("Analiz çalıştırıldı. Alanlar yalnızca aciliyet skoruna göre yüksekten düşüğe sıralandı.");
    } catch (err) {
      setError(getErrorMessage(err, "Analiz çalıştırılamadı."));
    }
  }


  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Öncelikli Kontrol Alanları</h1>
          <p className="mt-1 text-slate-600">Alanlar kişi durumuna göre değil; manuel hasar girdisi, son konum yoğunluğu ve afet sonrası veri güncelleme farkına göre yalnızca aciliyet skoruyla sıralanır.</p>
        </div>
        <button onClick={analyze} className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white">Analiz Çalıştır</button>
      </div>

      {notice && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}
      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}

      <div className="mb-6 flex flex-wrap gap-3">
        <select className="rounded-xl border border-slate-300 px-4 py-3" value={disasterId} onChange={(e) => { setDisasterId(e.target.value); loadAreas(e.target.value); }}>
          {disasters.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </div>

      <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Sıralama seçenekleri kaldırıldı. Acil durum kullanımında liste her zaman en yüksek arama önceliği skorundan en düşüğe doğru gösterilir.
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3">Sıra</th>
              <th>Seviye</th>
              <th>Skor</th>
              <th>Adres / Alan</th>
              <th>Hasar Girdisi</th>
              <th>Son Konum Kaydı</th>
              <th>Veri Güncellendi</th>
              <th>Veri Güncellenmedi</th>
              <th>Ortalama Doğruluk</th>
              <th>Öneri</th>
            </tr>
          </thead>
          <tbody>
            {areas.map((area, index) => (
              <tr key={area.id} className="border-t border-slate-100 align-top">
                <td className="p-3 font-semibold text-slate-500">#{index + 1}</td>
                <td className="font-bold">{area.priorityLevel}</td>
                <td className="font-bold">{area.priorityScore}</td>
                <td>
                  <div className="font-semibold text-slate-950">{area.addressText}</div>
                  <div className="text-xs text-slate-500">
                    {area.neighborhood || "-"} / {area.street || "-"}
                  </div>
                </td>
                <td>{damageLabel(area.damageLevel)}</td>
                <td>{area.preDisasterSignalCount}</td>
                <td>{area.postDisasterUpdatedCount}</td>
                <td>{area.notUpdatedCount}</td>
                <td>{area.averageAccuracy} m</td>
                <td className="max-w-md">{area.suggestedAreaText}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {areas.length === 0 ? <div className="p-6 text-slate-500">Önce haritada manuel hasar/yıkım gir ve analiz çalıştır.</div> : null}
      </div>
    </div>
  );
}
