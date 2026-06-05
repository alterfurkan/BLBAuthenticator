import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(30);
  const [disableCode, setDisableCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get2faStatus()
      .then((status) => setTotpEnabled(status.enabled))
      .catch(() => setError('Durum alınamadı'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!totpEnabled) return;

    const fetchCode = () => {
      api
        .getCurrentCode()
        .then(({ code: c, remaining: r }) => {
          setCode(c);
          setRemaining(r);
        })
        .catch(() => setCode(null));
    };

    fetchCode();
    const interval = setInterval(fetchCode, 1000);
    return () => clearInterval(interval);
  }, [totpEnabled]);

  const handleDisable = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      await api.disable2fa(disableCode);
      setMessage('2FA devre dışı bırakıldı');
      setTotpEnabled(false);
      setDisableCode('');
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'İşlem başarısız');
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>BLB Authenticator</h1>
          <p className="muted">{user?.email}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => { logout(); navigate('/login'); }}>
          Çıkış
        </button>
      </header>

      <main className="dashboard-main">
        {loading ? (
          <p className="muted">Yükleniyor...</p>
        ) : totpEnabled ? (
          <div className="card">
            <h2>Aktif Doğrulama Kodu</h2>
            <p className="muted">Google Authenticator ile aynı mantıkta TOTP kodu</p>

            <div className="totp-display">
              <span className="totp-code">{code ?? '------'}</span>
              <div className="totp-timer">
                <div
                  className="totp-timer-bar"
                  style={{ width: `${(remaining / 30) * 100}%` }}
                />
              </div>
              <span className="muted">{remaining}s</span>
            </div>

            <form onSubmit={handleDisable} className="form inline-form">
              <label>
                2FA Kapat (kod girin)
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                />
              </label>
              <button type="submit" className="btn-danger" disabled={disableCode.length !== 6}>
                2FA Kapat
              </button>
            </form>
          </div>
        ) : (
          <div className="card">
            <h2>2FA Henüz Etkin Değil</h2>
            <p className="muted">
              Hesabınızı korumak için iki faktörlü doğrulamayı etkinleştirin.
            </p>
            <button type="button" onClick={() => navigate('/setup-2fa')}>
              2FA Kurulumuna Başla
            </button>
          </div>
        )}

        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </main>
    </div>
  );
}
