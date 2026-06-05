import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

type AddMode = 'generate' | 'manual';

export default function AddEntryPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AddMode>('generate');
  const [label, setLabel] = useState('');
  const [issuer, setIssuer] = useState('');
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [code, setCode] = useState('');
  const [readyToConfirm, setReadyToConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetPreview = () => {
    setSecret('');
    setQrCode('');
    setReadyToConfirm(false);
    setCode('');
    setError('');
  };

  const switchMode = (next: AddMode) => {
    setMode(next);
    resetPreview();
  };

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError('Hesap adı gerekli');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data = await api.generateEntry(label.trim(), issuer.trim());
      setSecret(data.secret);
      setQrCode(data.qrCodeDataUrl);
      setReadyToConfirm(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'QR oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleManualContinue = (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !secret.trim()) {
      setError('Hesap adı ve secret gerekli');
      return;
    }
    setError('');
    setReadyToConfirm(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('6 haneli kod gerekli');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await api.createEntry(label.trim(), issuer.trim(), secret.trim(), code);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kayıt eklenemedi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-page">
      <div className="card setup-card setup-card-wide">
        <h1>Hesap Ekle</h1>
        <p className="muted">
          Servislerinizin 2FA kodlarını Google Authenticator gibi tek kasada toplayın.
        </p>

        <div className="mode-tabs">
          <button
            type="button"
            className={mode === 'generate' ? 'tab active' : 'tab'}
            onClick={() => switchMode('generate')}
          >
            QR ile yeni
          </button>
          <button
            type="button"
            className={mode === 'manual' ? 'tab active' : 'tab'}
            onClick={() => switchMode('manual')}
          >
            Secret ile ekle
          </button>
        </div>

        <div className="form">
          <label>
            Hesap adı
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="GitHub"
              disabled={readyToConfirm && mode === 'generate'}
            />
          </label>
          <label>
            Servis / Issuer (isteğe bağlı)
            <input
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="github.com"
              disabled={readyToConfirm && mode === 'generate'}
            />
          </label>

          {mode === 'manual' && !readyToConfirm && (
            <label>
              Secret anahtar (Base32)
              <input
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="JBSWY3DPEHPK3PXP..."
                autoComplete="off"
              />
            </label>
          )}

          {mode === 'generate' && !readyToConfirm && (
            <button type="button" onClick={handleGenerate} disabled={loading || !label.trim()}>
              {loading ? 'Oluşturuluyor...' : 'QR Kod Oluştur'}
            </button>
          )}

          {mode === 'manual' && !readyToConfirm && (
            <button type="button" onClick={handleManualContinue} disabled={!label.trim() || !secret.trim()}>
              Devam
            </button>
          )}
        </div>

        {readyToConfirm && (
          <>
            {qrCode && (
              <div className="qr-wrap">
                <img src={qrCode} alt="QR Code" width={256} height={256} />
                <p className="muted qr-hint">Telefon uygulamanızla tarayabilirsiniz</p>
              </div>
            )}

            <div className="secret-box">
              <span className="label">Secret</span>
              <code>{secret}</code>
            </div>

            <form onSubmit={handleCreate} className="form">
              <label>
                Doğrulama kodu (6 hane)
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                />
              </label>
              {error && <p className="error">{error}</p>}
              <div className="button-row">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    if (mode === 'generate') resetPreview();
                    else navigate('/dashboard');
                  }}
                >
                  {mode === 'generate' ? 'Geri' : 'İptal'}
                </button>
                <button type="submit" disabled={loading || code.length !== 6}>
                  {loading ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </>
        )}

        {!readyToConfirm && error && <p className="error">{error}</p>}
        {!readyToConfirm && (
          <button type="button" className="btn-secondary btn-back" onClick={() => navigate('/dashboard')}>
            Dashboard'a dön
          </button>
        )}
      </div>
    </div>
  );
}
