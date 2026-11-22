import React, { useState } from 'react';
import { Download, Share, PlusSquare, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
      >
        <Download className="w-4 h-4" />
        {compact ? 'Instalar' : 'Instalar App'}
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
        >
          <PlusSquare className="w-4 h-4 text-slate-700" />
          {compact ? 'Instalar' : 'Agregar a iPhone'}
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 pb-safe"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Instalar en iPhone (Safari)
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Úsala en pantalla completa como aplicación nativa en caseta.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
                  aria-label="Cerrar guía"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <ol className="mt-5 space-y-4 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-900">
                    1
                  </span>
                  <span className="pt-0.5">
                    Toca el botón{' '}
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                      Compartir <Share className="w-4 h-4 text-blue-600" />
                    </span>{' '}
                    en la barra inferior de Safari.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-900">
                    2
                  </span>
                  <span className="pt-0.5">
                    Desliza hacia abajo y selecciona{' '}
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                      Agregar a inicio <PlusSquare className="w-4 h-4 text-slate-800" />
                    </span>
                    .
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-900">
                    3
                  </span>
                  <span className="pt-0.5">
                    Confirma tocando <strong className="text-slate-900">Agregar</strong> en la esquina superior derecha.
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full min-h-[48px] rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="bg-amber-600 text-white px-4 py-2 text-xs font-medium flex items-center justify-center gap-2">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Sin conexión — Trabajando con caché local de Firestore. Los cambios se sincronizarán al reconectar.</span>
    </div>
  );
};
