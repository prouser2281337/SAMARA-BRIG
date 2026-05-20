import { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, ChevronLeft, ChevronRight, Navigation, Clock, Route, Home, Phone, Wrench, ArrowRight, ArrowDown } from 'lucide-react';
import { routesApi } from '../api';
import { Loader } from '../components/ui/loader';

const formatDateISO = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const formatDateRu = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};

const DG_API_KEY = '46e494a8-7f75-4320-9a5d-d145a1d6932c';

declare global {
  interface Window {
    DG: any;
  }
}

const FALLBACK_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function getPointMarkerHtml(num: number, color: string, title: string, highlighted: boolean): string {
  const ring = highlighted
    ? `<div style="position:absolute;top:-4px;left:-4px;width:calc(100% + 8px);height:calc(100% + 8px);border:3px solid ${color};border-radius:50%;opacity:0.4;animation:pulse-ring 1.5s ease-out infinite"></div>`
    : '';
  return `<div style="position:relative;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">` +
    `<div style="background:${highlighted ? color : '#fff'};color:${highlighted ? '#fff' : '#1e293b'};font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;border:1.5px solid ${color};white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis;text-align:center">${title}</div>` +
    `<div style="width:2px;height:6px;background:${color}"></div>` +
    `<div style="position:relative;width:20px;height:20px">` +
    `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>` +
    `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700">${num}</div>` +
    ring +
    `</div>` +
    `</div>`;
}

function getGarageMarkerHtml(): string {
  return `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4))">` +
    `<div style="background:#1e293b;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;white-space:nowrap">ГАРАЖ</div>` +
    `<div style="width:2px;height:6px;background:#1e293b"></div>` +
    `<div style="width:26px;height:26px;border-radius:50%;background:#1e293b;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3)">` +
    `<svg viewBox="0 0 24 24" fill="white" width="14" height="14"><path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z"/></svg>` +
    `</div>` +
    `</div>`;
}

function getTravelTimeLabelHtml(minutes: number, color: string): string {
  if (minutes < 1) return '';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  const text = h > 0 ? `${h}ч ${m}мин` : `${m} мин`;
  return `<div style="background:${color};color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3)">${text}</div>`;
}

function getDirectionArrowHtml(color: string): string {
  return `<div style="width:18px;height:18px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.25)">` +
    `<svg viewBox="0 0 24 24" fill="white" width="11" height="11"><path d="M5 12h14M12 5l7 7-7 7"/></svg>` +
    `</div>`;
}

const pulseKeyframes = `@keyframes pulse-ring{0%{transform:scale(1);opacity:.4}100%{transform:scale(1.5);opacity:0}}`;

export function RoutesMap() {
  const [selectedDate, setSelectedDate] = useState(formatDateISO(new Date()));
  const [selectedBrigadeIdx, setSelectedBrigadeIdx] = useState<number | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const polylinesRef = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  const { data: routesData, isLoading } = useQuery({
    queryKey: ['routes', selectedDate],
    queryFn: () => routesApi.getRoutes(selectedDate),
    enabled: !!selectedDate,
  });

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = pulseKeyframes;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  useEffect(() => {
    if (window.DG) {
      setMapReady(true);
      return;
    }
    if (document.getElementById('dg-map-script')) {
      const check = window.setInterval(() => {
        if (window.DG) {
          clearInterval(check);
          setMapReady(true);
        }
      }, 200);
      return () => clearInterval(check);
    }
    const script = document.createElement('script');
    script.id = 'dg-map-script';
    script.src = `https://maps.api.2gis.ru/2.0/loader.js?pkg=full&key=${DG_API_KEY}`;
    script.onload = () => {
      window.setTimeout(() => setMapReady(true), 500);
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstanceRef.current) return;
    window.DG.then(() => {
      const map = window.DG.map(mapRef.current, {
        center: [53.207, 50.134],
        zoom: 12,
      });
      mapInstanceRef.current = map;
    });
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !routesData?.brigades) return;

    window.DG.then(() => {
      const map = mapInstanceRef.current;
      polylinesRef.current.forEach((p) => p && p.remove && p.remove());
      polylinesRef.current = [];
      markersRef.current.forEach((m) => m && m.remove && m.remove());
      markersRef.current = [];

      const garage = routesData.garage || { lat: 53.209294, lng: 50.125493, name: 'Гараж', address: 'г. Самара, ул. Молодогвардейская, 244' };
      const bounds: any[] = [[garage.lat, garage.lng]];

      const garageIcon = window.DG.divIcon({
        className: 'garage-marker',
        html: getGarageMarkerHtml(),
        iconSize: [40, 55],
        iconAnchor: [20, 50],
      });
      const garageMarker = window.DG.marker([garage.lat, garage.lng], { icon: garageIcon }).addTo(map);
      garageMarker.bindPopup(`<div style="font-size:13px;line-height:1.5"><b>ГАРАЖ</b><br/>${garage.address || 'г. Самара, ул. Молодогвардейская, 244'}</div>`);
      markersRef.current.push(garageMarker);

      routesData.brigades.forEach((brigade: any, idx: number) => {
        const col = brigade.brigade?.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
        const isSelected = selectedBrigadeIdx === null || selectedBrigadeIdx === idx;
        const opacity = isSelected ? 0.85 : 0.2;
        const weight = isSelected ? 4 : 2;

        if (brigade.legs?.length > 0) {
          brigade.legs.forEach((leg: any, legIdx: number) => {
            const legDurationMin = (leg.duration || 0) / 60;
            const isReturnLeg = legIdx === brigade.legs.length - 1 && brigade.points?.length >= 2;

            if (leg.geometry) {
              const pts = decodePolyline(leg.geometry);
              if (pts.length > 1) {
                const pl = window.DG.polyline(pts, {
                  color: isReturnLeg ? col : col,
                  weight,
                  opacity,
                  dashArray: isReturnLeg ? '6, 10' : '10, 8',
                }).addTo(map);
                polylinesRef.current.push(pl);
                if (isSelected) pts.forEach((p) => bounds.push(p));
              }
            } else if (leg.from?.lat && leg.to?.lat) {
              const pl = window.DG.polyline(
                [[leg.from.lat, leg.from.lng], [leg.to.lat, leg.to.lng]],
                { color: col, weight: weight - 1, opacity: opacity * 0.7, dashArray: '6, 8' }
              ).addTo(map);
              polylinesRef.current.push(pl);
            }

            if (legDurationMin >= 1 && isSelected) {
              let midLat: number, midLng: number;
              if (leg.geometry) {
                const pts = decodePolyline(leg.geometry);
                const mid = pts[Math.floor(pts.length / 2)];
                midLat = mid ? mid[0] : (leg.from.lat + leg.to.lat) / 2;
                midLng = mid ? mid[1] : (leg.from.lng + leg.to.lng) / 2;
              } else {
                midLat = (leg.from.lat + leg.to.lat) / 2;
                midLng = (leg.from.lng + leg.to.lng) / 2;
              }

              const ttIcon = window.DG.divIcon({
                className: 'travel-time-label',
                html: getTravelTimeLabelHtml(legDurationMin, col),
                iconSize: [70, 20],
                iconAnchor: [35, -8],
              });
              const ttMarker = window.DG.marker([midLat, midLng], { icon: ttIcon }).addTo(map);
              markersRef.current.push(ttMarker);

              const fromName = legIdx === 0 ? 'Гараж' : (brigade.points?.[legIdx - 1]?.client || leg.from?.name || '');
              const toName = isReturnLeg ? 'Гараж' : (brigade.points?.[legIdx]?.client || leg.to?.name || '');
              const arrowIcon = window.DG.divIcon({
                className: 'direction-arrow',
                html: getDirectionArrowHtml(col),
                iconSize: [18, 18],
                iconAnchor: [9, 9],
              });

              const nearEndIdx = leg.geometry
                ? (() => { const pts = decodePolyline(leg.geometry); return Math.min(pts.length - 1, Math.floor(pts.length * 0.75)); })()
                : -1;
              if (nearEndIdx >= 0) {
                const pts = decodePolyline(leg.geometry);
                const nearEnd = pts[nearEndIdx];
                if (nearEnd) {
                  const arrowM = window.DG.marker([nearEnd[0], nearEnd[1]], { icon: arrowIcon }).addTo(map);
                  markersRef.current.push(arrowM);
                }
              }
            }
          });
        }

        brigade.points?.forEach((pt: any, pIdx: number) => {
          if (!pt.lat || !pt.lng) return;
          const pointKey = `${idx}-${pIdx}`;
          const isHighlighted = hoveredPoint === pointKey || (selectedBrigadeIdx === idx);
          const ptOpacity = isSelected ? 1 : 0.3;

          const title = pt.client || pt.work_type || `Заявка ${pIdx + 1}`;
          const icon = window.DG.divIcon({
            className: 'object-marker',
            html: getPointMarkerHtml(pIdx + 1, col, title, isHighlighted),
            iconSize: isHighlighted ? [50, 65] : [40, 55],
            iconAnchor: [20, 52],
          });
          const m = window.DG.marker([pt.lat, pt.lng], { icon }).addTo(map);

          const startT = pt.start_time?.slice(11, 16) || '';
          const endT = pt.end_time?.slice(11, 16) || '';
          m.bindPopup(`<div style="font-size:13px;line-height:1.6;min-width:200px">` +
            `<div style="font-weight:700;font-size:14px;margin-bottom:4px;color:${col}">${pt.client}</div>` +
            `<div style="color:#64748b">${pt.work_type}</div>` +
            `<div style="margin-top:6px">📍 ${pt.address}</div>` +
            (pt.phone ? `<div style="margin-top:2px">📞 ${pt.phone}</div>` : '') +
            `<div style="margin-top:4px">🕐 ${startT} — ${endT}</div>` +
            (pt.description ? `<div style="margin-top:4px;color:#475569;font-size:12px">📝 ${pt.description}</div>` : '') +
            `</div>`);
          markersRef.current.push(m);

          if (isSelected) bounds.push([pt.lat, pt.lng]);
        });
      });

      if (bounds.length > 1) {
        const latlngs = bounds.map((b) => window.DG.latLng(b[0], b[1]));
        map.fitBounds(window.DG.latLngBounds(latlngs), { padding: [50, 50] });
      }
    });
  }, [mapReady, routesData, selectedBrigadeIdx, hoveredPoint]);

  const changeDate = (delta: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + delta);
    setSelectedDate(formatDateISO(date));
  };

  const garage = routesData?.garage;

  const brigades = routesData?.brigades || [];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Route className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Маршруты бригад</h1>
          </div>
          <p className="text-muted-foreground">Планер маршрутов на {formatDateRu(selectedDate)}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => changeDate(-1)}
            className="p-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={() => changeDate(1)}
            className="p-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-96">
          <Loader text="Загрузка маршрутов..." />
        </div>
      )}

      {garage && (
        <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
            <Home className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-semibold text-foreground text-sm">База (гараж)</div>
            <div className="text-xs text-muted-foreground">{garage.address || 'г. Самара, ул. Молодогвардейская, 244'}</div>
          </div>
        </div>
      )}

      {brigades.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedBrigadeIdx(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              selectedBrigadeIdx === null
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card border-border text-foreground hover:bg-muted'
            }`}
          >
            Все бригады
          </button>
          {brigades.map((b: any, i: number) => {
            const col = b.brigade?.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length];
            return (
              <button
                key={i}
                onClick={() => setSelectedBrigadeIdx(selectedBrigadeIdx === i ? null : i)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all flex items-center gap-2 ${
                  selectedBrigadeIdx === i
                    ? 'text-white border-transparent'
                    : 'bg-card border-border text-foreground hover:bg-muted'
                }`}
                style={selectedBrigadeIdx === i ? { background: col, borderColor: col } : {}}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: col }} />
                {b.brigade?.name || `Бригада ${i + 1}`}
              </button>
            );
          })}
        </div>
      )}

      {brigades.length > 0 && (
        <div className={`grid gap-4 ${selectedBrigadeIdx !== null ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {brigades.filter((_: any, i: number) => selectedBrigadeIdx === null || selectedBrigadeIdx === i).map((b: any, i: number) => {
            const realIdx = selectedBrigadeIdx !== null ? selectedBrigadeIdx : i;
            const col = b.brigade?.color || FALLBACK_COLORS[realIdx % FALLBACK_COLORS.length];
            const totalTravelMin = Math.round((b.totalDuration || 0) / 60);
            const totalKm = ((b.totalLength || 0) / 1000).toFixed(1);
            const hasMultiPoints = b.points?.length >= 2;
            const returnLeg = hasMultiPoints ? b.legs?.[b.legs.length - 1] : null;
            const returnMin = returnLeg ? Math.round((returnLeg.duration || 0) / 60) : 0;

            return (
              <div
                key={realIdx}
                className="bg-card border border-border rounded-2xl overflow-hidden"
                style={{ borderTop: `3px solid ${col}` }}
              >
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full shadow-sm" style={{ background: col }} />
                      <span className="font-bold text-foreground text-base">{b.brigade?.name || 'Бригада'}</span>
                    </div>
                    {b.brigade?.car_model && (
                      <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">{b.brigade.car_model}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5" />
                      <span>{totalKm} км</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{totalTravelMin} мин в пути</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-4 h-4 rounded bg-slate-700 flex items-center justify-center">
                        <Home className="w-2.5 h-2.5 text-white" />
                      </div>
                      <span className="font-medium">Гараж</span>
                      {b.legs?.[0] && (
                        <span className="ml-auto text-[11px] font-semibold" style={{ color: col }}>
                          ~{Math.round((b.legs[0].duration || 0) / 60)} мин
                        </span>
                      )}
                    </div>

                    {b.points?.map((p: any, pi: number) => {
                      const pointKey = `${realIdx}-${pi}`;
                      const travelLeg = b.legs?.[pi];
                      const travelMin = travelLeg ? Math.round((travelLeg.duration || 0) / 60) : 0;
                      const startT = p.start_time?.slice(11, 16) || '';
                      const endT = p.end_time?.slice(11, 16) || '';

                      return (
                        <div key={pi}>
                          <div className="flex items-center gap-1.5 ml-1.5 text-xs text-muted-foreground">
                            <ArrowDown className="w-3 h-3" style={{ color: col }} />
                            {travelMin > 0 && <span className="font-semibold" style={{ color: col }}>~{travelMin} мин</span>}
                          </div>
                          <div
                            className="ml-4 border-l-2 pl-3 py-2 rounded-r-lg cursor-pointer transition-all hover:bg-muted/40"
                            style={{ borderColor: col }}
                            onMouseEnter={() => setHoveredPoint(pointKey)}
                            onMouseLeave={() => setHoveredPoint(null)}
                          >
                            <div className="flex items-start gap-2">
                              <div
                                className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold mt-0.5"
                                style={{ background: col }}
                              >
                                {pi + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-foreground text-sm leading-tight">{p.client}</div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                  <Wrench className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{p.work_type}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                  <MapPin className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{p.address}</span>
                                </div>
                                {p.description && (
                                  <div className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{p.description}</div>
                                )}
                                <div className="flex items-center gap-2 mt-1 text-[11px]">
                                  <span className="font-medium" style={{ color: col }}>{startT} — {endT}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {hasMultiPoints && returnLeg && (
                      <>
                        <div className="flex items-center gap-1.5 ml-1.5 text-xs text-muted-foreground">
                          <ArrowDown className="w-3 h-3" style={{ color: col }} />
                          {returnMin > 0 && <span className="font-semibold" style={{ color: col }}>~{returnMin} мин</span>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-4 h-4 rounded bg-slate-700 flex items-center justify-center">
                            <Home className="w-2.5 h-2.5 text-white" />
                          </div>
                          <span className="font-medium">Возврат в гараж</span>
                        </div>
                      </>
                    )}

                    {!hasMultiPoints && b.legs?.length > b.points?.length && (
                      <>
                        <div className="flex items-center gap-1.5 ml-1.5 text-xs text-muted-foreground">
                          <ArrowDown className="w-3 h-3" style={{ color: col }} />
                          {b.legs?.[1] && (
                            <span className="font-semibold" style={{ color: col }}>
                              ~{Math.round((b.legs[1].duration || 0) / 60)} мин
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-4 h-4 rounded bg-slate-700 flex items-center justify-center">
                            <Home className="w-2.5 h-2.5 text-white" />
                          </div>
                          <span className="font-medium">Возврат в гараж</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && brigades.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground">
          Нет назначений на {formatDateRu(selectedDate)}. Сначала распределите заявки на странице планирования.
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
        <div ref={mapRef} className="w-full h-[600px] lg:h-[700px]" />
      </div>
    </div>
  );
}

function decodePolyline(geometry: string): [number, number][] {
  if (!geometry) return [];
  const pairs = geometry.trim().split(/\s+/);
  const pts: [number, number][] = [];
  for (const pair of pairs) {
    const [latStr, lngStr] = pair.split(',');
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (!isNaN(lat) && !isNaN(lng)) pts.push([lat, lng]);
  }
  return pts;
}