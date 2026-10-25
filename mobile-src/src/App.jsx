import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, getToken, getUserName, setSession } from './api.js';
import { Icon, Toast } from './components/ui.jsx';
import Login from './screens/Login.jsx';
import Tickets from './screens/Tickets.jsx';
import Add from './screens/Add.jsx';
import Accounts from './screens/Accounts.jsx';
import Refunds from './screens/Refunds.jsx';
import Generator from './screens/Generator.jsx';

const TABS = [
  { id: 'tickets', label: 'Tickets', icon: 'tickets' },
  { id: 'add', label: 'Add', icon: 'add' },
  { id: 'accounts', label: 'Accounts', icon: 'accounts' },
  { id: 'refunds', label: 'Refunds', icon: 'refunds' },
  { id: 'generator', label: 'E-Ticket', icon: 'generator' }
];

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [tab, setTab] = useState('tickets');
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = useCallback((text, type = 'success') => {
    setToast({ text, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const loadFlights = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setFlights(await api.getFlights());
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    setFlights([]);
    setAuthed(false);
  }, []);

  useEffect(() => {
    window.addEventListener('auth-expired', logout);
    return () => window.removeEventListener('auth-expired', logout);
  }, [logout]);

  useEffect(() => {
    if (authed) loadFlights();
  }, [authed, loadFlights]);

  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  const props = { flights, loading, loadError, reload: loadFlights, notify };

  return (
    <div className="app">
      <header className="topbar">
        <img src="logo.png" alt="Faroway Holidays" />
        <div className="who">
          <span>{getUserName()}</span>
          <button className="linkbtn" onClick={logout}>Sign out</button>
        </div>
      </header>
      <main className="screen" key={tab}>
        {tab === 'tickets' && <Tickets {...props} />}
        {tab === 'add' && <Add {...props} onSaved={() => setTab('tickets')} />}
        {tab === 'accounts' && <Accounts {...props} />}
        {tab === 'refunds' && <Refunds {...props} />}
        {tab === 'generator' && <Generator {...props} />}
      </main>
      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)} aria-current={tab === t.id}>
            <Icon name={t.icon} />
            {t.label}
          </button>
        ))}
      </nav>
      <Toast toast={toast} />
    </div>
  );
}
