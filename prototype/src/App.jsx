import { useEffect, useState } from 'react';
import MapView from './MapView.jsx';
import AdminView from './AdminView.jsx';

// Простейший хеш-роутинг: #/admin — админка, всё остальное — карта.
function route() {
  return window.location.hash.replace(/^#\/?/, '') === 'admin' ? 'admin' : 'map';
}

export default function App() {
  const [view, setView] = useState(route());

  useEffect(() => {
    const onHash = () => setView(route());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = v => { window.location.hash = v === 'admin' ? '#/admin' : '#/'; };

  return view === 'admin'
    ? <AdminView onGoMap={() => go('map')} />
    : <MapView onGoAdmin={() => go('admin')} />;
}
