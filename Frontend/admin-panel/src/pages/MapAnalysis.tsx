import L, { LeafletMouseEvent } from "leaflet";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { api } from "../api/client";
import { DebrisReport, DisasterEvent, MapDevice, PriorityArea } from "../types";

function dot(color: string, size = 14) {
  return L.divIcon({
    className: "",
    html: `<div class="marker-dot" style="background:${color};width:${size}px;height:${size}px"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

type PickMode = "none" | "region" | "debris";
type ViewMode = "world" | "region";

interface MapData {
  disasterArea: DisasterEvent;
  devices: MapDevice[];
  debrisReports: DebrisReport[];
  priorityAreas: PriorityArea[];
}

interface DraftDebris {
  latitude: number;
  longitude: number;
  title: string;
  description: string;
  radiusMeters: number;
  buildingName: string;
  street: string;
  neighborhood: string;
  damageLevel: "LOW" | "MEDIUM" | "HIGH" | "COLLAPSED" | "UNKNOWN";
}

interface RegionDraft {
  latitude: number;
  longitude: number;
  title: string;
  radiusMeters: number;
  eventTime: string;
}

function defaultEventTimeInput() {
  return "2026-04-25T08:00";
}

function zoomForRadius(radiusMeters: number) {
  if (radiusMeters >= 100_000) return 8;
  if (radiusMeters >= 50_000) return 9;
  if (radiusMeters >= 20_000) return 10;
  if (radiusMeters >= 8_000) return 12;
  return 13;
}

function getErrorMessage(err: unknown, fallback: string) {
  const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
  return anyErr?.response?.data?.message ?? anyErr?.message ?? fallback;
}

function MapClickHandler({ mode, onPick }: { mode: PickMode; onPick: (lat: number, lng: number) => void }) {
  const enabled = mode !== "none";
  const map = useMapEvents({
    click(event) {
      if (!enabled) return;
      onPick(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6)));
    }
  });

  useEffect(() => {
    const container = map.getContainer();
    const oldCursor = container.style.cursor;
    container.style.cursor = enabled ? "crosshair" : oldCursor;
    return () => {
      container.style.cursor = oldCursor;
    };
  }, [enabled, map]);

  return null;
}

function MapViewport({ disaster, viewMode }: { disaster: DisasterEvent; viewMode: ViewMode }) {
  const map = useMap();

  useEffect(() => {
    if (viewMode === "world") {
      map.setView([20, 15], 2);
      return;
    }

    map.setView(
      [disaster.centerLatitude, disaster.centerLongitude],
      zoomForRadius(disaster.radiusMeters)
    );
  }, [disaster.centerLatitude, disaster.centerLongitude, disaster.radiusMeters, map, viewMode]);

  return null;
}

export default function MapAnalysis() {
  const [disasterId, setDisasterId] = useState("");
  const [disasters, setDisasters] = useState<DisasterEvent[]>([]);
  const [data, setData] = useState<MapData | null>(null);
  const [pickMode, setPickMode] = useState<PickMode>("none");
  const [viewMode, setViewMode] = useState<ViewMode>("world");
  const [submitting, setSubmitting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [draft, setDraft] = useState<DraftDebris | null>(null);
  const [regionDraft, setRegionDraft] = useState<RegionDraft | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [layers, setLayers] = useState({
    updated: true,
    notUpdated: true,
    outside: true,
    debris: true,
    priority: true
  });

  // SADECE DEĞİŞEN KRİTİK KISIMLAR

  async function load(id: string = disasterId, includeOutside = layers.outside) {
    try {
      let baseMapData: MapData = {
        disasterArea: {
          id: id || "manual-test-area",
          title: "Manuel Deprem Bölgesi",
          disasterType: "EARTHQUAKE",
          eventTime: new Date().toISOString(),
          centerLatitude: 37.96,
          centerLongitude: 34.68,
          radiusMeters: 5000,
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as any,
        devices: [],
        debrisReports: [],
        priorityAreas: []
      };

      if (id) {
        try {
          const mapRes = await api.get(`/admin/disasters/${id}/map-data`, {
            params: { includeOutside }
          });

          baseMapData = mapRes.data;
        } catch {
          console.warn("Admin map-data alınamadı, fallback bölge kullanılacak.");
        }
      }

      const locationRes = await fetch("http://localhost:8080/api/location");
      const locations = await locationRes.json();

      const mappedDevices = locations.map((d: any) => ({
        id: d.id,
        latitude: d.latitude,
        longitude: d.longitude,
        batteryLevel: d.batteryLevel ?? 0,
        accuracy: 0,
        networkType: "-",
        lastLocationTime: d.timestamp ?? d.receivedAt ?? new Date().toISOString(),
        signalStatus: d.signalStatus,
        status: d.signalStatus === "ORANGE"
          ? "NOT_UPDATED"
          : "POST_DISASTER_UPDATED"
      }));

      setData((prev) => ({
        disasterArea: prev?.disasterArea ?? baseMapData.disasterArea,

        // Yıkım noktalarını ekranda sabit tutar
        debrisReports:
          baseMapData.debrisReports && baseMapData.debrisReports.length > 0
            ? baseMapData.debrisReports
            : prev?.debrisReports ?? [],

        // Analiz alanlarını da korur
        priorityAreas:
          baseMapData.priorityAreas && baseMapData.priorityAreas.length > 0
            ? baseMapData.priorityAreas
            : prev?.priorityAreas ?? [],

        devices: mappedDevices
      }));
    } catch (err) {
      console.error(err);
      setError("Harita verisi yüklenemedi. Backend çalışıyor mu kontrol et.");
    }
  }

  async function loadDisasters(selectId?: string) {
    const res = await api.get("/admin/disasters");
    const list: DisasterEvent[] = res.data.disasters ?? [];
    setDisasters(list);
    const savedId = localStorage.getItem("selectedDisasterId");

    const savedExists = savedId && list.some((item) => item.id === savedId);

    const nextId =
      selectId ||
      disasterId ||
      (savedExists ? savedId : "") ||
      list[0]?.id ||
      "";
    if (nextId) {
      setDisasterId(nextId);
      localStorage.setItem("selectedDisasterId", nextId);
      await load(nextId, layers.outside);
    }
  }

  // 🔥 2. useEffect FIX (çok kritik)

  useEffect(() => {
    loadDisasters().catch(() => {
      load();
    });

    const interval = setInterval(() => {
      load(disasterId, layers.outside);
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function analyze() {
    if (!disasterId) return;
    setError("");
    setNotice("");

    try {
      await api.post(`/admin/disasters/${disasterId}/analyze`);
      await load(disasterId, layers.outside);
      setNotice("Analiz çalıştırıldı. Öncelikli kontrol alanları manuel hasar/yıkım girdilerine göre güncellendi.");
      setViewMode("region");
    } catch (err) {
      setError(getErrorMessage(err, "Analiz çalıştırılamadı."));
    }
  }

  // 🔥 3. BUTON FIX

  async function requestDeviceUpdate() {
    if (!data) return;

    setRequesting(true);
    setError("");
    setNotice("");

    try {
      await fetch("http://localhost:8080/api/location/request-update-in-area", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          centerLatitude: data.disasterArea.centerLatitude,
          centerLongitude: data.disasterArea.centerLongitude,
          radiusMeters: data.disasterArea.radiusMeters
        })
      });

      await load(disasterId, layers.outside);

      setNotice("Sadece seçili deprem bölgesindeki cihazlardan anlık güncelleme istendi.");
      setViewMode("region");
    } catch (err) {
      setError("Deprem bölgesindeki cihazlardan veri güncellemesi istenemedi.");
    } finally {
      setRequesting(false);
    }
  }

  function handleMapPick(lat: number, lng: number) {
    setNotice("");
    setError("");

    if (pickMode === "region") {
      setRegionDraft({
        latitude: lat,
        longitude: lng,
        title: `Manuel Deprem Bölgesi - ${new Date().toLocaleDateString("tr-TR")}`,
        radiusMeters: 5000,
        eventTime: defaultEventTimeInput()
      });
      setDraft(null);
      return;
    }

    if (pickMode === "debris") {
      setDraft({
        latitude: lat,
        longitude: lng,
        title: "Manuel hasar/yıkım girdisi",
        description: "Yetkili kullanıcı tarafından haritadan manuel girildi.",
        radiusMeters: 120,
        buildingName: "",
        street: "",
        neighborhood: "",
        damageLevel: "COLLAPSED"
      });
      setRegionDraft(null);
    }
  }

  function pickFromLayer(event: LeafletMouseEvent) {
    if (pickMode === "none") return;
    event.originalEvent?.stopPropagation();
    handleMapPick(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6)));
  }

  async function submitRegion(event: FormEvent) {
    event.preventDefault();
    if (!regionDraft) return;

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const eventTime = new Date(regionDraft.eventTime);
      if (Number.isNaN(eventTime.getTime())) {
        throw new Error("Geçerli bir afet zamanı gir.");
      }

      const res = await api.post("/admin/disasters", {
        title: regionDraft.title,
        disasterType: "EARTHQUAKE",
        eventTime: eventTime.toISOString(),
        centerLatitude: regionDraft.latitude,
        centerLongitude: regionDraft.longitude,
        radiusMeters: regionDraft.radiusMeters
      });

      const created: DisasterEvent = res.data.disaster;
      setDisasters((items) => [created, ...items]);
      setDisasterId(created.id);
      localStorage.setItem("selectedDisasterId", created.id);
      setRegionDraft(null);
      setDraft(null);
      setPickMode("none");
      setViewMode("region");

      setData((prev) => ({
        disasterArea: created,
        devices: prev?.devices ?? [],
        debrisReports: [],
        priorityAreas: []
      }));

      //await load(created.id, layers.outside);
      setNotice("Deprem bölgesi oluşturuldu. Şimdi bu bölge içinde manuel hasar/yıkım noktası girebilir ve analiz çalıştırabilirsin.");
    } catch (err) {
      setError(getErrorMessage(err, "Deprem bölgesi oluşturulamadı."));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitDraft(event: FormEvent) {
    event.preventDefault();
    if (!draft || !disasterId) return;

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      await api.post(`/admin/disasters/${disasterId}/debris-reports`, draft);
      setDraft(null);
      setPickMode("none");
      setNotice("Manuel hasar/yıkım girdisi kaydedildi. Öncelik alanı üretmek için Analiz Çalıştır butonuna bas.");
    } catch (err) {
      setError(getErrorMessage(err, "Hasar/yıkım girdisi kaydedilemedi."));
    } finally {
      setSubmitting(false);
    }
  }

  function toggleOutside(checked: boolean) {
    const nextLayers = { ...layers, outside: checked };
    setLayers(nextLayers);
    if (disasterId) {
      load(disasterId, checked).catch((err) => setError(getErrorMessage(err, "Harita verisi yenilenemedi.")));
    }
  }

  const counts = useMemo(() => {
    if (!data) return { updated: 0, notUpdated: 0, outside: 0 };
    return data.devices.reduce((acc, device) => {
      if (device.status === "POST_DISASTER_UPDATED") acc.updated += 1;
      if (device.status === "NOT_UPDATED") acc.notUpdated += 1;
      if (device.status === "OUTSIDE_AREA") acc.outside += 1;
      return acc;
    }, { updated: 0, notUpdated: 0, outside: 0 });
  }, [data]);

  const visibleDevices = useMemo(() => {
    if (!data) return [];
    return data.devices.filter((device) => {
      if (device.status === "POST_DISASTER_UPDATED") return layers.updated;
      if (device.status === "NOT_UPDATED") return layers.notUpdated;
      if (device.status === "OUTSIDE_AREA") return layers.outside;
      return true;
    });
  }, [data, layers]);

  // 🔥 4. RENK FIX (en kritik yer)

  function colorForDevice(device: any) {
    return device.signalStatus === "ORANGE" ? "#f97316" : "#22c55e";
  }

  function labelForDevice(status: MapDevice["status"]) {
    if (status === "POST_DISASTER_UPDATED") return "Afet sonrası veri güncellendi";
    if (status === "NOT_UPDATED") return "Afet sonrası veri güncellenmedi";
    return "Seçili afet alanı dışında kalan veritabanı kaydı";
  }

  function setMode(mode: PickMode) {
    setError("");
    setNotice("");

    if (mode === "region") {
      setRegionDraft(null);
      setDraft(null);
      setViewMode("world");
    }

    setPickMode((current) => current === mode ? "none" : mode);
  }

  if (!data) return <div>Harita yükleniyor...</div>;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Harita Analiz</h1>
          <p className="mt-2 max-w-4xl text-slate-600">
            Konum kayıtları PostgreSQL device_locations tablosundan okunur. Sistem deprem bölgesini otomatik seçmez. Önce haritadan deprem bölgesi belirle. Cihazlardan anlık durum güncellemesi isteyebilirsin; mobil push henüz eklenmediği için panel yeni veri oluşturmaz.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-xl border border-slate-300 px-4 py-3"
            value={disasterId}
            onChange={(event) => {
              const nextId = event.target.value;
              setDisasterId(nextId);
              setDraft(null);
              setRegionDraft(null);
              setPickMode("none");
              setViewMode("region");
              load(nextId, layers.outside).catch((err) => setError(getErrorMessage(err, "Harita verisi alınamadı.")));
            }}
          >
            {disasters.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>

          <button
            onClick={() => setMode("region")}
            className={`rounded-xl px-5 py-3 font-semibold ${pickMode === "region" ? "bg-blue-700 text-white" : "bg-white text-slate-950 ring-1 ring-slate-300"}`}
          >
            {pickMode === "region" ? "Deprem Bölgesi Seçiliyor" : "Deprem Bölgesi Belirle"}
          </button>

          <button
            onClick={() => setMode("debris")}
            className={`rounded-xl px-5 py-3 font-semibold ${pickMode === "debris" ? "bg-red-600 text-white" : "bg-white text-slate-950 ring-1 ring-slate-300"}`}
          >
            {pickMode === "debris" ? "Hasar/Yıkım Noktası Seçiliyor" : "Hasar/Yıkım Gir"}
          </button>

          <button disabled={requesting} onClick={requestDeviceUpdate} className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:bg-slate-400">
            {requesting ? "İsteniyor..." : "Cihazlardan Anlık Güncelleme İste"}
          </button>

          <button onClick={analyze} className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white">Analiz Çalıştır</button>
        </div>
      </div>

      <div className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200">
        <b>Not:</b> Hasar/yıkım bilgisi otomatik üretilmez. Gri noktalar seçili afet alanı dışında kalan veritabanı konum kayıtlarıdır. Anlık güncelleme isteği demo ortamında yeni veri oluşturmaz. “Afet sonrası veri güncellenmedi” kesin tehlike anlamına gelmez.
      </div>

      {notice && <div className="mb-4 rounded-2xl bg-blue-50 p-4 text-sm font-medium text-blue-950 ring-1 ring-blue-200">{notice}</div>}
      {error && <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-950 ring-1 ring-red-200">{error}</div>}

      <div className="mb-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-5">
        <label className="rounded-xl bg-white p-3 shadow-sm">
          <input type="checkbox" className="mr-2" checked={layers.updated} onChange={(event) => setLayers({ ...layers, updated: event.target.checked })} />
          <span className="inline-block h-3 w-3 rounded-full bg-green-500" /> Bölge içinde güncellendi ({counts.updated})
        </label>
        <label className="rounded-xl bg-white p-3 shadow-sm">
          <input type="checkbox" className="mr-2" checked={layers.notUpdated} onChange={(event) => setLayers({ ...layers, notUpdated: event.target.checked })} />
          <span className="inline-block h-3 w-3 rounded-full bg-yellow-400" /> Bölge içinde güncellenmedi ({counts.notUpdated})
        </label>
        <label className="rounded-xl bg-white p-3 shadow-sm">
          <input type="checkbox" className="mr-2" checked={layers.outside} onChange={(event) => toggleOutside(event.target.checked)} />
          <span className="inline-block h-3 w-3 rounded-full bg-slate-500" /> Afet alanı dışı kayıt ({counts.outside})
        </label>
        <label className="rounded-xl bg-white p-3 shadow-sm">
          <input type="checkbox" className="mr-2" checked={layers.debris} onChange={(event) => setLayers({ ...layers, debris: event.target.checked })} />
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" /> Manuel hasar/yıkım ({data.debrisReports.length})
        </label>
        <label className="rounded-xl bg-white p-3 shadow-sm">
          <input type="checkbox" className="mr-2" checked={layers.priority} onChange={(event) => setLayers({ ...layers, priority: event.target.checked })} />
          <span className="inline-block h-3 w-3 rounded-full bg-purple-600" /> Öncelik alanı ({data.priorityAreas.length})
        </label>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <button onClick={() => setViewMode("world")} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300">Dünya Görünümü</button>
        <button onClick={() => setViewMode("region")} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300">Seçili Bölgeye Git</button>
      </div>

      {pickMode === "region" && (
        <div className="mb-4 rounded-2xl bg-blue-50 p-4 text-sm font-medium text-blue-950 ring-1 ring-blue-200">
          Haritada deprem/afet bölgesi merkezini seç. Bu işlem otomatik afet tespiti değildir; yalnızca panel kullanıcısının operasyon alanı tanımıdır.
        </div>
      )}

      {pickMode === "debris" && (
        <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-950 ring-1 ring-red-200">
          Haritada doğrulanmış hasar/yıkım bilgisinin olduğu noktaya tıkla. Bu bilgi sistem tarafından otomatik üretilmez.
        </div>
      )}

      {regionDraft && (
        <form onSubmit={submitRegion} className="mb-4 grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-4">
          <div className="text-sm font-semibold text-slate-700 md:col-span-4">
            Seçilen deprem bölgesi merkezi: {regionDraft.latitude.toFixed(6)}, {regionDraft.longitude.toFixed(6)}
          </div>
          <input className="rounded-xl border p-3 md:col-span-2" value={regionDraft.title} onChange={(event) => setRegionDraft({ ...regionDraft, title: event.target.value })} placeholder="Afet bölgesi adı" />
          <input className="rounded-xl border p-3" type="number" min={100} max={100000} value={regionDraft.radiusMeters} onChange={(event) => setRegionDraft({ ...regionDraft, radiusMeters: Number(event.target.value) })} placeholder="Yarıçap metre" />
          <input className="rounded-xl border p-3" type="datetime-local" value={regionDraft.eventTime} onChange={(event) => setRegionDraft({ ...regionDraft, eventTime: event.target.value })} />
          <div className="flex gap-3 md:col-span-4">
            <button disabled={submitting} className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-60">Deprem Bölgesini Oluştur</button>
            <button type="button" onClick={() => setRegionDraft(null)} className="rounded-xl bg-slate-100 px-5 py-3 font-semibold text-slate-700">Vazgeç</button>
          </div>
        </form>
      )}

      {draft && (
        <form onSubmit={submitDraft} className="mb-4 grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-4">
          <div className="text-sm font-semibold text-slate-700 md:col-span-4">Seçilen hasar/yıkım koordinatı: {draft.latitude.toFixed(6)}, {draft.longitude.toFixed(6)}</div>
          <input className="rounded-xl border p-3" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Başlık" />
          <input className="rounded-xl border p-3" value={draft.buildingName} onChange={(event) => setDraft({ ...draft, buildingName: event.target.value })} placeholder="Bina adı" />
          <input className="rounded-xl border p-3" value={draft.street} onChange={(event) => setDraft({ ...draft, street: event.target.value })} placeholder="Sokak" />
          <input className="rounded-xl border p-3" value={draft.neighborhood} onChange={(event) => setDraft({ ...draft, neighborhood: event.target.value })} placeholder="Mahalle" />
          <input className="rounded-xl border p-3" type="number" min={20} max={1000} value={draft.radiusMeters} onChange={(event) => setDraft({ ...draft, radiusMeters: Number(event.target.value) })} placeholder="Yarıçap metre" />
          <select className="rounded-xl border p-3" value={draft.damageLevel} onChange={(event) => setDraft({ ...draft, damageLevel: event.target.value as DraftDebris["damageLevel"] })}>
            <option value="COLLAPSED">COLLAPSED - yıkım girdisi</option>
            <option value="HIGH">HIGH - ağır hasar girdisi</option>
            <option value="MEDIUM">MEDIUM - orta hasar girdisi</option>
            <option value="LOW">LOW - düşük hasar girdisi</option>
            <option value="UNKNOWN">UNKNOWN - belirsiz hasar girdisi</option>
          </select>
          <textarea className="rounded-xl border p-3 md:col-span-2" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Açıklama" />
          <div className="flex gap-3 md:col-span-4">
            <button disabled={submitting} className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white disabled:opacity-60">Girdiyi Kaydet</button>
            <button type="button" onClick={() => setDraft(null)} className="rounded-xl bg-slate-100 px-5 py-3 font-semibold text-slate-700">Vazgeç</button>
          </div>
        </form>
      )}

      <div className="rounded-3xl bg-white p-4 shadow-sm">
        <MapContainer center={[20, 15]} zoom={2} scrollWheelZoom>
          <MapViewport disaster={data.disasterArea} viewMode={viewMode} />
          <MapClickHandler mode={pickMode} onPick={handleMapPick} />
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          <Circle
            center={[data.disasterArea.centerLatitude, data.disasterArea.centerLongitude]}
            radius={data.disasterArea.radiusMeters}
            pathOptions={{ color: "#2563eb", fillOpacity: 0.04, weight: 2 }}
            eventHandlers={pickMode !== "none" ? { click: pickFromLayer } : undefined}
          >
            <Popup>
              <b>Seçili deprem/afet analiz alanı</b><br />
              {data.disasterArea.title}<br />
              Yarıçap: {data.disasterArea.radiusMeters} m
            </Popup>
          </Circle>

          {visibleDevices.map((device) => (
            <Marker
              key={device.id}
              position={[device.latitude, device.longitude]}
              icon={dot(colorForDevice(device), device.status === "OUTSIDE_AREA" ? 7 : 14)}
              eventHandlers={pickMode !== "none" ? { click: pickFromLayer } : undefined}
            >
              <Popup>
                <b>{labelForDevice(device.status)}</b><br />
                Doğruluk: {Math.round(device.accuracy)} m<br />
                Pil: %{device.batteryLevel}<br />
                Ağ: {device.networkType}<br />
                Zaman: {new Date(device.lastLocationTime).toLocaleString("tr-TR")}
              </Popup>
            </Marker>
          ))}

          {layers.debris && data.debrisReports.map((report) => (
            <Circle
              key={report.id}
              center={[report.latitude, report.longitude]}
              radius={report.radiusMeters}
              pathOptions={{ color: report.damageLevel === "COLLAPSED" ? "#dc2626" : "#ef4444", fillOpacity: report.damageLevel === "COLLAPSED" ? 0.22 : 0.14, weight: 2 }}
              eventHandlers={pickMode !== "none" ? { click: pickFromLayer } : undefined}
            >
              <Popup>
                <b>{report.title}</b><br />
                Manuel harita girdisi<br />
                Hasar: {report.damageLevel}<br />
                Bina: {report.buildingName || "-"}<br />
                Bölge: {report.neighborhood || "-"} / {report.street || "-"}<br />
                Yarıçap: {report.radiusMeters} m
              </Popup>
            </Circle>
          ))}

          {layers.priority && data.priorityAreas.map((area) => (
            <Circle
              key={area.id}
              center={[area.centerLatitude, area.centerLongitude]}
              radius={area.radiusMeters + 35}
              pathOptions={{ color: area.priorityLevel === "Kritik" ? "#9333ea" : "#f97316", fillOpacity: 0.12, weight: 3 }}
              eventHandlers={pickMode !== "none" ? { click: pickFromLayer } : undefined}
            >
              <Popup>
                <b>{area.priorityLevel} Öncelikli Kontrol Alanı</b><br />
                Skor: {area.priorityScore}<br />
                Son konum kaydı: {area.preDisasterSignalCount}<br />
                Afet sonrası veri güncellendi: {area.postDisasterUpdatedCount}<br />
                Afet sonrası veri güncellenmedi: {area.notUpdatedCount}<br />
                Ortalama doğruluk: {Math.round(area.averageAccuracy)} m
              </Popup>
            </Circle>
          ))}

          {regionDraft && (
            <Circle center={[regionDraft.latitude, regionDraft.longitude]} radius={regionDraft.radiusMeters} pathOptions={{ color: "#1d4ed8", fillOpacity: 0.08, dashArray: "6 4", weight: 2 }}>
              <Popup>Kaydedilmemiş deprem/afet bölgesi</Popup>
            </Circle>
          )}

          {draft && (
            <Circle center={[draft.latitude, draft.longitude]} radius={draft.radiusMeters} pathOptions={{ color: "#111827", fillOpacity: 0.1, dashArray: "4 4" }}>
              <Popup>Kaydedilmemiş hasar/yıkım girdisi</Popup>
            </Circle>
          )}
        </MapContainer>
      </div>

      {data.debrisReports.length === 0 && (
        <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm">
          Bu seçili deprem bölgesinde henüz manuel hasar/yıkım girdisi yok. Öncelikli kontrol alanı üretmek için önce haritadan hasar/yıkım girdisi ekle, sonra Analiz Çalıştır butonuna bas.
        </div>
      )}
    </div>
  );
}
