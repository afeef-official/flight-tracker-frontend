import React, { useState } from 'react';
import { api, setSession } from '../api.js';
import { Field, Spinner } from '../components/ui.jsx';

export default function Login({ onDone }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token, user } = await api.login(username.trim(), password);
      setSession(token, user.displayName);
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form onSubmit={submit}>
        <img src="logo.png" alt="Faroway Holidays" />
        <p className="sub" style={{ textAlign: 'center', marginBottom: 18 }}>Sign in to Flight Operations</p>
        <Field label="Username">
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" required />
        </Field>
        <Field label="Password">
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        {error && <p className="error">{error}</p>}
        <button className="btn block" disabled={busy}>{busy ? <Spinner /> : null}Sign In</button>
      </form>
    </div>
  );
}
