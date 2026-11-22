import React, { useState } from 'react';
import { LogOut, ShieldAlert, ShieldCheck } from 'lucide-react';
import { PWAInstallButton } from './PWAControls';

interface LoginScreenProps {
  onSignIn: () => Promise<void>;
  error: string | null;
  loading: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onSignIn,
  error,
  loading,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-6 pt-safe pb-safe">
      <div className="flex justify-end">
        <PWAInstallButton />
      </div>

      <main className="mx-auto w-full max-w-md bg-white border border-slate-200 rounded-3xl p-7 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center shadow-sm mb-5">
            {!imgFailed ? (
              <img
                src="/src/assets/images/gavilan_shield_emblem_1795281708661.jpg"
                alt="Escudo Gavilán 181 — Seguridad Privada Yaotecatl"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <ShieldCheck className="w-10 h-10 text-white" />
            )}
          </div>

          <p className="text-xs font-semibold text-slate-500 tracking-wide">
            Seguridad Privada Yaotecatl
          </p>
          <h1 className="mt-1.5 text-2xl font-bold text-slate-900 text-balance">
            Gavilán 181
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Control de acceso residencial, validación de claves, registro de visitas y bitácora de caseta.
          </p>
        </div>

        {error && (
          <div className="mt-5 rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={onSignIn}
          disabled={loading}
          className="mt-7 w-full min-h-[52px] inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 transition-all"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#FFFFFF"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#CBD5E1"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#94A3B8"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#E2E8F0"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {loading ? 'Verificando acceso...' : 'Iniciar sesión con Google'}
        </button>

        <p className="mt-4 text-center text-xs text-slate-500">
          Acceso exclusivo para personal autorizado de caseta y administración.
        </p>
      </main>

      <footer className="text-center text-xs text-slate-400">
        Sincronizado en tiempo real con caseta Android
      </footer>
    </div>
  );
};

interface RestrictedAccessScreenProps {
  email: string;
  onSignOut: () => Promise<void>;
}

export const RestrictedAccessScreen: React.FC<RestrictedAccessScreenProps> = ({
  email,
  onSignOut,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 pt-safe pb-safe">
      <div className="w-full max-w-md bg-white border border-red-200 rounded-3xl p-7 shadow-sm text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-5">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Acceso restringido</h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          La cuenta <span className="font-mono font-semibold text-slate-900">{email}</span> no está registrada en la lista de personal autorizado de Gavilán 181.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Solicita al Administrador que te asigne uno de los 5 cupos de Capturista o inicia sesión con otra cuenta autorizada.
        </p>

        <button
          type="button"
          onClick={onSignOut}
          className="mt-6 w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 active:scale-[0.98] transition-all"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};
