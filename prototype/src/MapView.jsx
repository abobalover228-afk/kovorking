import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { api } from './api.js';

const MINSK = [53.9085, 27.5750];
const KIND_LABEL = { free: 'Бесплатно', paid: 'Платно' };
const FEATURES = [
  { key: 'open24', label: '24/7' },
  { key: 'wifi', label: 'Wi-Fi' },
  { key: 'sockets', label: 'Розетки' },
  { key: 'quiet', label: 'Тихо' }
];

function markerIcon(kind, active) {
  const isFree = kind === 'free';
  const color = isFree ? '#2F7A52' : '#5A6FA8';
  const scale = active ? 1.12 : 1;
  const z = active ? 1200 : 100;
  const glyph = isFree
    ? '<path d="M14 4a5.6 5.6 0 0 0-5.6 5.6c0 3.5 5.6 9.4 5.6 9.4s5.6-5.9 5.6-9.4A5.6 5.6 0 0 0 14 4zm0 7.6a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" fill="#fff"/>'
    : '<path d="M9 4h4v5h3l-5 8-5-8h3V4z" fill="#fff"/>';
  return L.divIcon({
    className: 'pin',
    html: `<div class="pin-body${active ? ' is-active' : ''}" style="transform:scale(${scale});z-index:${z};">
      <svg viewBox="0 0 28 38" width="32" height="42" style="display:block;filter:drop-shadow(0 5px 10px rgba(26,26,24,.28))">
        <path d="M14 0C6.27 0 0 6.27 0 14c0 9.2 12.6 22.6 13.2 23.3.5.5.8.7.8.7s14-14.1 14-24C28 6.27 21.73 0 14 0z"
          fill="${color}" stroke="#fff" stroke-width="2.4"/>
        ${glyph}
      </svg>
    </div>`,
    iconSize: [32, 42],
    iconAnchor: [16, 40],
    popupAnchor: [0, -38]
  });
}

export default function MapView({ onGoAdmin }) {
  const [places, setPlaces] = useState([]);
  const [status, setStatus] = useState('loading');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [features, setFeatures] = useState([]);
  const [selected, setSelected] = useState(null);

  const mapEl = useRef(null);
  const mapObj = useRef(null);
  const markersRef = useRef({});
  const selectedRef = useRef(null);

  useEffect(() => { selectedRef.current = selected; }, [selected]);

  useEffect(() => {
    let alive = true;
    api.places()
      .then(data => { if (alive) { setPlaces(data); setStatus('ok'); } })
      .catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (mapObj.current || !mapEl.current) return;
    const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true })
      .setView(MINSK, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    mapObj.current = map;
    return () => { map.remove(); mapObj.current = null; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return places.filter(p => {
      if (kind !== 'all' && p.kind !== kind) return false;
      for (const f of features) if (!p[f]) return false;
      if (q) {
        const hay = (p.name + ' ' + p.address + ' ' + p.note).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [places, kind, features, query]);

  useEffect(() => {
    const map = mapObj.current;
    if (!map) return;
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};
    filtered.forEach(p => {
      const m = L.marker([p.lat, p.lng], {
        icon: markerIcon(p.kind, selected && selected.id === p.id)
      }).addTo(map).on('click', () => setSelected(p));
      markersRef.current[p.id] = m;
    });
  }, [filtered, selected]);

  useEffect(() => {
    if (selected && mapObj.current) {
      mapObj.current.flyTo([selected.lat, selected.lng], 15, { duration: 0.6 });
    }
  }, [selected]);

  const toggleFeature = key =>
    setFeatures(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const freeCount = filtered.filter(p => p.kind === 'free').length;

  return (
    <div className="app">
      <aside className="panel">
        <div className="panel-head">
          <div className="brand">
            <div className="brand-mark">КСК</div>
            <div>
              <div className="brand-title">Карта студенческих коворкингов</div>
              <div className="brand-sub">Минск · прототип</div>
            </div>
          </div>
        </div>

        <div className="panel-nav">
          <button className="nav-btn on">Карта</button>
          <button className="nav-btn" onClick={onGoAdmin}>Админка</button>
        </div>

        <div className="search">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск: библиотека, HUB, Сурганова…"
            aria-label="Поиск мест"
          />
          {query && <button className="clear" onClick={() => setQuery('')} aria-label="Очистить">×</button>}
        </div>

        <div className="filters">
          <div className="chip-row">
            <button className={'chip' + (kind === 'all' ? ' on' : '')} onClick={() => setKind('all')}>Все</button>
            <button className={'chip' + (kind === 'free' ? ' on' : '')} onClick={() => setKind('free')}>Бесплатно</button>
            <button className={'chip' + (kind === 'paid' ? ' on' : '')} onClick={() => setKind('paid')}>Платно</button>
          </div>
          <div className="chip-row">
            {FEATURES.map(f => (
              <button
                key={f.key}
                className={'chip' + (features.includes(f.key) ? ' on' : '')}
                onClick={() => toggleFeature(f.key)}
              >{f.label}</button>
            ))}
          </div>
        </div>

        <div className="count">
          {status === 'loading' && 'Загрузка…'}
          {status === 'error' && 'Не удалось загрузить данные'}
          {status === 'ok' && <>Найдено <b>{filtered.length}</b>, из них бесплатных <b>{freeCount}</b></>}
        </div>

        <div className="list">
          {status === 'ok' && filtered.length === 0 && (
            <div className="state">Ничего не найдено.<br />Попробуйте убрать фильтры.</div>
          )}
          {filtered.map(p => (
            <button
              key={p.id}
              className={'item' + (selected && selected.id === p.id ? ' active' : '')}
              onClick={() => setSelected(p)}
            >
              <div className="item-top">
                <div className={'item-icon ' + p.kind}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    {p.kind === 'free' ? (
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
                        fill="#2F7A52" />
                    ) : (
                      <path d="M6 8h3V3h6v5h3l-6 8-6-8z" fill="#5A6FA8" />
                    )}
                  </svg>
                </div>
                <span className="item-name">{p.name}</span>
              </div>
              <div className="item-addr">{p.address}</div>
              <div className="item-tags">
                <span className={'tag ' + p.kind}>{KIND_LABEL[p.kind]}</span>
                {p.open24 ? <span className="tag">24/7</span> : null}
                {p.wifi ? <span className="tag">Wi-Fi</span> : null}
                {p.sockets ? <span className="tag">Розетки</span> : null}
                {p.quiet ? <span className="tag">Тихо</span> : null}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <main className="map-wrap">
        <div ref={mapEl} className="map" />
        {selected && (
          <div className="card">
            <button className="card-close" onClick={() => setSelected(null)} aria-label="Закрыть">×</button>
            <div className="card-kind">
              <span className={'dot ' + selected.kind} />
              {KIND_LABEL[selected.kind]}
            </div>
            <h2 className="card-title">{selected.name}</h2>
            <div className="card-addr">{selected.address}</div>

            <dl className="card-facts">
              <div><dt>Режим</dt><dd>{selected.hours || '—'}</dd></div>
              <div><dt>Вход</dt><dd>{selected.entry || '—'}</dd></div>
              {selected.seats > 0 && <div><dt>Мест</dt><dd>{selected.seats}</dd></div>}
            </dl>

            <div className="card-tags">
              {selected.open24 ? <span className="tag">24/7</span> : null}
              {selected.wifi ? <span className="tag">Wi-Fi</span> : null}
              {selected.sockets ? <span className="tag">Розетки</span> : null}
              {selected.quiet ? <span className="tag">Тихо</span> : null}
            </div>

            {selected.note && <p className="card-note">{selected.note}</p>}
            {selected.source && <div className="card-src">Источник: {selected.source}</div>}

            <div className="card-actions">
              <a
                className="btn btn-primary"
                href={`https://yandex.by/maps/?pt=${selected.lng},${selected.lat}&z=16&l=map`}
                target="_blank" rel="noreferrer"
              >Маршрут →</a>
              <a
                className="btn btn-ghost"
                href={`https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lng}#map=17/${selected.lat}/${selected.lng}`}
                target="_blank" rel="noreferrer"
              >На карте</a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
