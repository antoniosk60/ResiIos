import React, { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import {
  Clock,
  DoorOpen,
  LogOut,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { AccessVerificationView } from './components/AccessVerificationView';
import { AdminPanelView } from './components/AdminPanelView';
import { LoginScreen, RestrictedAccessScreen } from './components/AuthScreens';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineIndicator, PWAInstallButton } from './components/PWAControls';
import { ResidentsView } from './components/ResidentsView';
import { TardinessView } from './components/TardinessView';
import { VisitsView } from './components/VisitsView';
import { verifyAndSyncAuthorizedUser } from './services/firestoreService';
import type {
  AppTab,
  AuditLog,
  AuthorizedUser,
  CapturistaSlot,
  Resident,
  Tardiness,
  Visit,
} from './types';

function AppContent() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [actor, setActor] = useState<AuthorizedUser | null>(null);
  const [isRestricted, setIsRestricted] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AppTab>('access');

  // Real-time Firestore state
  const [residents, setResidents] = useState<Resident[]>([]);
  const [residentsLoading, setResidentsLoading] = useState(true);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [tardiness, setTardiness] = useState<Tardiness[]>([]);
  const [capturistaSlots, setCapturistaSlots] = useState<CapturistaSlot[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Quick-action bridges from Access Verification to Visits / Tardiness
  const [preselectedResident, setPreselectedResident] =
    useState<Resident | null>(null);
  const [visitComposerSignal, setVisitComposerSignal] = useState(0);
  const [tardinessComposerSignal, setTardinessComposerSignal] = useState(0);

  const [emblemFailed, setEmblemFailed] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setActor(null);
        setIsRestricted(false);
        setAuthReady(true);
        return;
      }

      try {
        setAuthLoading(true);
        const verified = await verifyAndSyncAuthorizedUser(user);
        if (verified) {
          setActor(verified);
          setIsRestricted(false);
        } else {
          setActor(null);
          setIsRestricted(true);
        }
      } catch (err) {
        setAuthError(
          err instanceof Error
            ? err.message
            : 'No se pudo verificar la autorización.'
        );
      } finally {
        setAuthLoading(false);
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Real-time Firestore listeners (only when authorized)
  useEffect(() => {
    if (!actor) return;

    setResidentsLoading(true);
    const unsubResidents = onSnapshot(
      collection(db, 'residents'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Resident);
        setResidents(list);
        setResidentsLoading(false);
      },
      (error) => {
        if (auth.currentUser) {
          handleFirestoreError(error, OperationType.LIST, 'residents');
        }
      }
    );

    const unsubVisits = onSnapshot(
      query(collection(db, 'visits'), orderBy('entryTimestampMillis', 'desc')),
      (snap) => {
        setVisits(snap.docs.map((d) => d.data() as Visit));
      },
      (error) => {
        if (auth.currentUser) {
          handleFirestoreError(error, OperationType.LIST, 'visits');
        }
      }
    );

    const unsubTardiness = onSnapshot(
      query(collection(db, 'tardiness'), orderBy('timestampMillis', 'desc')),
      (snap) => {
        setTardiness(snap.docs.map((d) => d.data() as Tardiness));
      },
      (error) => {
        if (auth.currentUser) {
          handleFirestoreError(error, OperationType.LIST, 'tardiness');
        }
      }
    );

    let unsubSlots: (() => void) | undefined;
    let unsubAudit: (() => void) | undefined;

    if (actor.role === 'ADMINISTRADOR') {
      unsubSlots = onSnapshot(
        collection(db, 'capturista_slots'),
        (snap) => {
          setCapturistaSlots(snap.docs.map((d) => d.data() as CapturistaSlot));
        },
        (error) => {
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.LIST, 'capturista_slots');
          }
        }
      );

      unsubAudit = onSnapshot(
        query(collection(db, 'audit_logs'), orderBy('timestampMillis', 'desc')),
        (snap) => {
          setAuditLogs(snap.docs.map((d) => d.data() as AuditLog));
        },
        (error) => {
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.LIST, 'audit_logs');
          }
        }
      );
    }

    return () => {
      unsubResidents();
      unsubVisits();
      unsubTardiness();
      unsubSlots?.();
      unsubAudit?.();
    };
  }, [actor]);

  const handleSignIn = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'No se pudo completar el inicio de sesión con Google.'
      );
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setActiveTab('access');
    await signOut(auth);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center mb-3">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-slate-700">
          Conectando con Gavilán 181...
        </p>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <LoginScreen
        onSignIn={handleSignIn}
        error={authError}
        loading={authLoading}
      />
    );
  }

  if (isRestricted || !actor) {
    return (
      <RestrictedAccessScreen
        email={firebaseUser.email || 'Cuenta desconocida'}
        onSignOut={handleSignOut}
      />
    );
  }

  const isAdmin = actor.role === 'ADMINISTRADOR';
  const navItems: { id: AppTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'access',
      label: 'Acceso',
      icon: <ShieldCheck className="w-5 h-5" />,
    },
    {
      id: 'visits',
      label: 'Visitas',
      icon: <DoorOpen className="w-5 h-5" />,
    },
    {
      id: 'tardiness',
      label: 'Retardos',
      icon: <Clock className="w-5 h-5" />,
    },
    {
      id: 'residents',
      label: 'Residentes',
      icon: <Users className="w-5 h-5" />,
    },
    ...(isAdmin
      ? [
          {
            id: 'admin' as AppTab,
            label: 'Admin',
            icon: <SlidersHorizontal className="w-5 h-5" />,
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-900 shrink-0 flex items-center justify-center">
            {!emblemFailed ? (
              <img
                src="/src/assets/images/gavilan_shield_emblem_1795281708661.jpg"
                alt="Gavilán 181"
                referrerPolicy="no-referrer"
                onError={() => setEmblemFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <ShieldCheck className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">
              Gavilán 181
            </p>
            <p className="text-xs text-slate-500 truncate">
              Seguridad Yaotecatl
            </p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-3">
          <PWAInstallButton />
          <div className="text-xs">
            <p className="font-semibold text-slate-900 truncate">
              {actor.displayName}
            </p>
            <p className="text-slate-500 truncate">
              {actor.role === 'ADMINISTRADOR'
                ? 'Administrador'
                : `Capturista · Slot ${actor.slotId}`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Mobile Top App Bar (compact <= 56px + safe area) */}
        <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 pt-safe">
          <div className="h-14 px-4 flex items-center justify-between gap-3">
            <span className="text-base font-bold text-slate-900 whitespace-nowrap shrink-0">
              Gavilán 181
            </span>

            <div className="flex items-center gap-2 shrink-0">
              <PWAInstallButton compact />
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Cerrar sesión"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <OfflineIndicator />

        {/* Page Container */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 pb-24 lg:pb-8">
          {/* Desktop Context Header */}
          <div className="hidden lg:flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Gavilán 181 — Seguridad Privada Yaotecatl
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {actor.displayName} ·{' '}
                {actor.role === 'ADMINISTRADOR'
                  ? 'Administrador'
                  : `Capturista (Slot ${actor.slotId})`}
              </p>
            </div>
          </div>

          {activeTab === 'access' && (
            <AccessVerificationView
              residents={residents}
              loading={residentsLoading}
              onStartVisitForResident={(resident) => {
                setPreselectedResident(resident);
                setActiveTab('visits');
                setVisitComposerSignal((n) => n + 1);
              }}
              onStartTardinessForResident={(resident) => {
                setPreselectedResident(resident);
                setActiveTab('tardiness');
                setTardinessComposerSignal((n) => n + 1);
              }}
            />
          )}

          {activeTab === 'visits' && (
            <VisitsView
              visits={visits}
              residents={residents}
              actor={actor}
              preselectedResident={preselectedResident}
              onClearPreselectedResident={() => setPreselectedResident(null)}
              openComposerSignal={visitComposerSignal}
            />
          )}

          {activeTab === 'tardiness' && (
            <TardinessView
              tardinessList={tardiness}
              residents={residents}
              actor={actor}
              preselectedResident={preselectedResident}
              onClearPreselectedResident={() => setPreselectedResident(null)}
              openComposerSignal={tardinessComposerSignal}
            />
          )}

          {activeTab === 'residents' && (
            <ResidentsView residents={residents} actor={actor} />
          )}

          {activeTab === 'admin' && isAdmin && (
            <AdminPanelView
              actor={actor}
              capturistaSlots={capturistaSlots}
              residents={residents}
              visits={visits}
              tardiness={tardiness}
              auditLogs={auditLogs}
            />
          )}
        </main>

        {/* Mobile Fixed Bottom Tab Bar */}
        <nav
          aria-label="Navegación principal"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
        >
          <div
            className={`grid h-16 items-center ${
              isAdmin ? 'grid-cols-5' : 'grid-cols-4'
            }`}
          >
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`min-h-[48px] h-full flex flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                    active ? 'text-slate-900 font-bold' : 'text-slate-500 font-medium'
                  }`}
                >
                  <span
                    className={`p-1 rounded-lg transition-colors ${
                      active ? 'bg-slate-900 text-white' : ''
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="text-[11px] leading-none truncate max-w-full">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
