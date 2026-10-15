import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const KIND_LABEL = { free: 'Бесплатно', paid: 'Платно' };

const EMPTY = {
  name: '', address: '', lat: '', lng: '', kind: 'free',
  hours: '', entry: '', seats: 0,
  wifi: 1, sockets: 1, quiet: 0, open24: 0,
  note: '', source: ''
};

function Toast({ toast }) {
  if (!toast) return null;
  return <div className={'toast ' + (toast.ok ? 'ok' : 'err')}>{toast.text}</div>;
}

export default function AdminView({ onGoMap }) {
  const [authed, setAuthed] = useState(!!getToken());
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [places, setPlaces] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState(null);

  const flash = (text, ok = true) => {
    setToast({ text, ok });
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(null), 2600);
  };

  const load = () => api.places().then(setPlaces).catch(() => flash('Не удалось загрузить данные', false));

  useEffect(() => {
    if (authed) load();
  }, [authed]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError('');
    try {
      const { token } = await api.login(password);
      setToken(token);
      setAuthed(true);
      setPassword('');
    } catch (err) {
      setLoginError(err.message);
    }
  }

  async function handleLogout() {
    try { await api.logout(); } catch { /* игнорируем */ }
    setToken('');
    setAuthed(false);
    setPlaces([]);
  }

  function resetForm() {
    setForm(EMPTY);
    setEditingId(null);
    setFormError('');
  }

  function startEdit(p) {
    setEditingId(p.id);
    setForm({
      name: p.name, address: p.address,
      lat: p.lat, lng: p.lng, kind: p.kind,
      hours: p.hours, entry: p.entry, seats: p.seats,
      wifi: p.wifi, sockets: p.sockets, quiet: p.quiet, open24: p.open24,
      note: p.note, source: p.source
    });
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const payload = { ...form, lat: Number(form.lat), lng: Number(form.lng), seats: Number(form.seats) };
      if (editingId) {
        await api.update(editingId, payload);
        flash('Место обновлено');
      } else {
        await api.create(payload);
        flash('Место добавлено');
      }
      resetForm();
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p) {
    if (!window.confirm(`Удалить «${p.name}»?`)) return;
    try {
      await api.remove(p.id);
      if (editingId === p.id) resetForm();
      flash('Место удалено');
      await load();
    } catch (err) {
      flash(err.message, false);
    }
  }

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggle = k => setForm(f => ({ ...f, [k]: f[k] ? 0 : 1 }));

  /* ----------------------------- логин ----------------------------- */

  if (!authed) {
    return (
      <div className="admin">
        <div className="login-card">
          <h1>Вход в админку</h1>
          <p>Управление местами на карте: добавление, редактирование, удаление.</p>
          <form onSubmit={handleLogin}>
            {loginError && <div className="form-error">{loginError}</div>}
            <div className="field">
              <label htmlFor="pw">Пароль администратора</label>
              <input
                id="pw" type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="admin" autoFocus
              />
            </div>
            <button className="btn btn-primary" type="submit" style={{ justifyContent: 'center' }}>
              Войти
            </button>
            <button className="btn btn-ghost" type="button" onClick={onGoMap} style={{ justifyContent: 'center' }}>
              ← Назад к карте
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ----------------------------- админка ----------------------------- */

  return (
    <div className="admin">
      <div className="admin-inner">
        <div className="admin-head">
          <div>
            <div className="admin-title">Админка · места на карте</div>
            <div className="admin-sub">Всего записей: {places.length}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={onGoMap}>Карта →</button>
            <button className="btn btn-ghost" onClick={handleLogout}>Выйти</button>
          </div>
        </div>

        <div className="admin-grid">
          <div className="table-card">
            <div className="table-card-head">
              <h2>Список мест</h2>
              <button className="btn btn-primary" onClick={resetForm}>+ Новое место</button>
            </div>
            <div className="table-scroll">
              <table className="adm">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Тип</th>
                    <th>Режим</th>
                    <th style={{ textAlign: 'right' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {places.length === 0 && (
                    <tr><td colSpan={4}><div className="empty">Пока нет мест. Добавьте первое →</div></td></tr>
                  )}
                  {places.map(p => (
                    <tr key={p.id} className={editingId === p.id ? 'editing' : ''}>
                      <td>
                        <div className="adm-name">{p.name}</div>
                        <div className="adm-addr">{p.address}</div>
                      </td>
                      <td><span className={'tag ' + p.kind}>{KIND_LABEL[p.kind]}</span></td>
                      <td style={{ fontSize: '.8rem', color: 'var(--ink-soft)' }}>{p.hours || '—'}</td>
                      <td>
                        <div className="adm-actions">
                          <button className="icon-btn" onClick={() => startEdit(p)} title="Редактировать">✎</button>
                          <button className="icon-btn del" onClick={() => handleDelete(p)} title="Удалить">🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="editor">
            <h2>{editingId ? 'Редактирование места' : 'Новое место'}</h2>
            <div className="hint">
              Координаты можно взять с Яндекс.Карт: правый клик по точке → «Что здесь» → скопировать широту и долготу.
            </div>

            <form onSubmit={handleSubmit}>
              {formError && <div className="form-error">{formError}</div>}

              <div className="field">
                <label>Название</label>
                <input value={form.name} onChange={e => upd('name', e.target.value)} placeholder="Коворкинг КБ-16" required />
              </div>

              <div className="field">
                <label>Адрес</label>
                <input value={form.address} onChange={e => upd('address', e.target.value)} placeholder="ул. Я. Коласа, 16" required />
              </div>

              <div className="row2">
                <div className="field">
                  <label>Широта</label>
                  <input value={form.lat} onChange={e => upd('lat', e.target.value)} placeholder="53.9222" required />
                </div>
                <div className="field">
                  <label>Долгота</label>
                  <input value={form.lng} onChange={e => upd('lng', e.target.value)} placeholder="27.6015" required />
                </div>
              </div>

              <div className="field">
                <label>Тип доступа</label>
                <select value={form.kind} onChange={e => upd('kind', e.target.value)}>
                  <option value="free">Бесплатно</option>
                  <option value="paid">Платно</option>
                </select>
              </div>

              <div className="field">
                <label>Режим работы</label>
                <input value={form.hours} onChange={e => upd('hours', e.target.value)} placeholder="Пн–Чт 10:00–20:00" />
              </div>

              <div className="field">
                <label>Условия входа</label>
                <input value={form.entry} onChange={e => upd('entry', e.target.value)} placeholder="Бесплатно по студенческому" />
              </div>

              <div className="field">
                <label>Число мест (необязательно)</label>
                <input type="number" min="0" value={form.seats} onChange={e => upd('seats', e.target.value)} placeholder="150" />
              </div>

              <div className="field">
                <label>Особенности</label>
                <div className="switches">
                  <button type="button" className={'switch' + (form.open24 ? ' on' : '')} onClick={() => toggle('open24')}>
                    <span className="box" /> 24/7
                  </button>
                  <button type="button" className={'switch' + (form.wifi ? ' on' : '')} onClick={() => toggle('wifi')}>
                    <span className="box" /> Wi-Fi
                  </button>
                  <button type="button" className={'switch' + (form.sockets ? ' on' : '')} onClick={() => toggle('sockets')}>
                    <span className="box" /> Розетки
                  </button>
                  <button type="button" className={'switch' + (form.quiet ? ' on' : '')} onClick={() => toggle('quiet')}>
                    <span className="box" /> Тихо
                  </button>
                </div>
              </div>

              <div className="field">
                <label>Примечание</label>
                <textarea value={form.note} onChange={e => upd('note', e.target.value)} placeholder="Три зоны, нужен студенческий билет…" />
              </div>

              <div className="field">
                <label>Источник данных</label>
                <input value={form.source} onChange={e => upd('source', e.target.value)} placeholder="library.bntu.by" />
              </div>

              <div className="editor-actions">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? 'Сохранение…' : editingId ? 'Сохранить изменения' : 'Добавить место'}
                </button>
                {editingId && (
                  <button className="btn btn-ghost" type="button" onClick={resetForm}>Отмена</button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
