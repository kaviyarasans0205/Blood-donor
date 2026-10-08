import { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { useApi, get } from '../../hooks/useApi';
import { PageHeader, SectionCard } from '../../components/ui/Cards';
import { LoadingScreen, ErrorState, EmptyState } from '../../components/ui/States';
import StatusBadge, { BloodGroupTag } from '../../components/ui/StatusBadge';
import { formatDate } from '../../utils/helpers';
import { BLOOD_GROUPS } from '../../services/bloodGroups';

// Fix default marker icons for bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function AdminDonorMap() {
  const [group, setGroup] = useState('');
  const [radius, setRadius] = useState('');
  const [eligibleOnly, setEligibleOnly] = useState(true);
  const [center] = useState([20.5937, 78.9629]); // India center

  const { data, loading, error, refetch } = useApi(
    () => get('/admin/donor-map', {
      params: {
        bloodGroup: group || undefined,
        eligibleOnly: eligibleOnly ? 'true' : 'false',
        radiusKm: radius || undefined,
        latitude: radius ? center[0] : undefined,
        longitude: radius ? center[1] : undefined,
      },
    }),
    [group, radius, eligibleOnly]
  );

  const points = data || [];

  const fitKey = useMemo(() => JSON.stringify([group, radius, eligibleOnly]), [group, radius, eligibleOnly]);

  if (loading) return <LoadingScreen label="Loading donor map…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Donor Map"
        subtitle={`${points.length} donors shown · names masked and contact details hidden for privacy`}
        actions={<button onClick={refetch} className="btn-secondary">↻ Refresh</button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className="input !w-44" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">All blood groups</option>
          {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="input !w-44" value={radius} onChange={(e) => setRadius(e.target.value)}>
          <option value="">Any radius</option>
          {[10, 25, 50, 100, 250].map((r) => <option key={r} value={r}>{r} km</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <input type="checkbox" checked={eligibleOnly} onChange={(e) => setEligibleOnly(e.target.checked)} className="h-4 w-4 rounded" />
          Eligible only
        </label>
        <span className="text-xs text-slate-500">
          Radius filters from map center — pan/zoom then change the radius to re-query.
        </span>
      </div>

      {points.length === 0 ? (
        <EmptyState icon="🗺️" title="No donors match these filters" description="Try clearing filters or widening the radius." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="card overflow-hidden lg:col-span-3" style={{ height: '600px' }}>
            <MapContainer
              key={fitKey}
              center={center}
              zoom={radius ? 8 : 4}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {radius && (
                <CircleMarker
                  center={center}
                  radius={Number(radius) * 1000}
                  pathOptions={{ color: '#3b82f6', weight: 1, fillOpacity: 0.05 }}
                />
              )}
              {points.map((p) => (
                <CircleMarker
                  key={p.donorId}
                  center={[p.latitude, p.longitude]}
                  radius={8}
                  pathOptions={{
                    color: '#fff',
                    weight: 2,
                    fillColor: p.eligibilityStatus === 'ineligible' ? '#94a3b8' : p.availability === 'available' ? '#10b981' : '#f59e0b',
                    fillOpacity: 1,
                  }}
                >
                  <Popup>
                    <div style={{ fontFamily: 'inherit', minWidth: 180 }}>
                      <p style={{ fontWeight: 700, marginBottom: 4 }}>{p.label} <span style={{ background: '#dc2626', color: '#fff', padding: '1px 6px', borderRadius: 4, fontSize: 11, marginLeft: 6 }}>{p.bloodGroup}</span></p>
                      <p style={{ fontSize: 12, margin: '2px 0' }}>City: {p.city || '—'}</p>
                      <p style={{ fontSize: 12, margin: '2px 0' }}>Eligibility: {p.eligibilityStatus}</p>
                      <p style={{ fontSize: 12, margin: '2px 0' }}>Availability: {p.availability}</p>
                      <p style={{ fontSize: 12, margin: '2px 0' }}>Last donation: {p.lastDonationDate ? formatDate(p.lastDonationDate) : 'Never'}</p>
                      {p.distanceKm != null && <p style={{ fontSize: 12, margin: '2px 0', fontWeight: 600 }}>Distance: {p.distanceKm} km</p>}
                      <p style={{ fontSize: 10, color: '#888', marginTop: 6 }}>Contact details are visible only in the donor detail view for authorized users.</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          <div className="space-y-3">
            <SectionCard title="Map legend">
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Available donor</li>
                <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500" /> Busy donor</li>
                <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-slate-400" /> Ineligible donor</li>
                <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-medical-500 ring-2 ring-medical-200" /> Radius circle</li>
              </ul>
            </SectionCard>

            <SectionCard title={`Donors shown (${points.length})`}>
              <div className="max-h-[340px] space-y-2 overflow-y-auto scrollbar-thin">
                {points.slice(0, 40).map((p) => (
                  <div key={p.donorId} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <BloodGroupTag group={p.bloodGroup} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{p.label}</p>
                        <p className="text-[11px] text-slate-400">{p.city || '—'}{p.distanceKm != null ? ` · ${p.distanceKm} km` : ''}</p>
                      </div>
                    </div>
                    <StatusBadge value={p.eligibilityStatus} />
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}