import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Setup2faPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    api
      .setup2fa()
      .then((data) => {
        setSecret(data.secret);
        setQrCode(data.qrCodeDataUrl);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Kurulum başlatılamadı');
      })
      .finally(() => setInitializing(false));
  }, []);

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.confirm2fa(code);
      await refreshUser();
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Doğrulama başarısız');
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <div className="page-center">
        <p className="muted">2FA kurulumu hazırlanıyor...</p>
      </div>
    );
  }

  return (
    <div className="setup-page">
      <div className="card setup-card">
        <h1>2FA Kurulumu</h1>
        <p className="muted">
          Google Authenticator veya benzeri bir uygulama ile QR kodu tarayın.
        </p>

        {qrCode && (
          <div className="qr-wrap">
            <img src={qrCode} alt="2FA QR Code" width={256} height={256} />
          </div>
        )}

        <div className="secret-box">
          <span className="label">Manuel secret</span>
          <code>{secret}</code>
        </div>

        <form onSubmit={handleConfirm} className="form">
          <label>
            Uygulamadaki 6 haneli kodu girin
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="button-row">
            <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard')}>
              İptal
            </button>
            <button type="submit" disabled={loading || code.length !== 6}>
              {loading ? 'Etkinleştiriliyor...' : '2FA Etkinleştir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
