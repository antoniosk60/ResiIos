import React, { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  X,
  AlertOctagon,
} from 'lucide-react';
import {
  createResident,
  deleteResident,
  importResidentsBatch,
  toggleResidentMoroso,
  updateResident,
} from '../services/firestoreService';
import type { AuthorizedUser, Resident } from '../types';
import {
  downloadResidentsTemplateCsv,
  normalizeText,
  parseResidentsSpreadsheet,
  type ParsedImportResident,
} from '../utils/formatters';

interface ResidentsViewProps {
  residents: Resident[];
  actor: AuthorizedUser;
}

type PaymentFilter = 'TODOS' | 'AL_CORRIENTE' | 'MOROSOS';

export const ResidentsView: React.FC<ResidentsViewProps> = ({
  residents,
  actor,
}) => {
  const isAdmin = actor.role === 'ADMINISTRADOR';
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('TODOS');

  // Create / Edit Modal
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [building, setBuilding] = useState('');
  const [apartment, setApartment] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [blockOrSection, setBlockOrSection] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [vehiclePlates, setVehiclePlates] = useState('');
  const [notes, setNotes] = useState('');
  const [isMoroso, setIsMoroso] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation
  const [residentToDelete, setResidentToDelete] = useState<Resident | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import Excel/CSV modal
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [parsedImport, setParsedImport] = useState<ParsedImportResident[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const filteredResidents = useMemo(() => {
    const q = normalizeText(search);
    return residents
      .filter((r) => {
        if (paymentFilter === 'AL_CORRIENTE' && r.isMoroso) return false;
        if (paymentFilter === 'MOROSOS' && !r.isMoroso) return false;
        if (!q) return true;
        return [
          r.fullName,
          r.building,
          r.apartment,
          r.accessCode,
          r.vehiclePlates,
          r.phone,
        ].some((f) => normalizeText(f || '').includes(q));
      })
      .sort(
        (a, b) =>
          a.building.localeCompare(b.building, 'es') ||
          a.apartment.localeCompare(b.apartment, 'es', { numeric: true })
      );
  }, [residents, search, paymentFilter]);

  const openCreateModal = () => {
    setEditingResident(null);
    setFullName('');
    setBuilding('');
    setApartment('');
    setAccessCode('');
    setBlockOrSection('');
    setPhone('');
    setEmail('');
    setVehiclePlates('');
    setNotes('');
    setIsMoroso(false);
    setIsActive(true);
    setFormError(null);
    setShowFormModal(true);
  };

  const openEditModal = (r: Resident) => {
    setEditingResident(r);
    setFullName(r.fullName);
    setBuilding(r.building);
    setApartment(r.apartment);
    setAccessCode(r.accessCode);
    setBlockOrSection(r.blockOrSection);
    setPhone(r.phone);
    setEmail(r.email);
    setVehiclePlates(r.vehiclePlates);
    setNotes(r.notes);
    setIsMoroso(r.isMoroso);
    setIsActive(r.isActive);
    setFormError(null);
    setShowFormModal(true);
  };

  const handleSaveResident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !building.trim() || !apartment.trim()) {
      setFormError('Nombre completo, edificio y departamento son obligatorios.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        fullName,
        building,
        apartment,
        accessCode,
        blockOrSection,
        phone,
        email,
        vehiclePlates,
        notes,
        isMoroso,
        isActive,
      };
      if (editingResident) {
        await updateResident(editingResident, payload, actor);
      } else {
        await createResident(payload, actor);
      }
      setShowFormModal(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Error al guardar el residente.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteResident = async () => {
    if (!residentToDelete) return;
    setDeleting(true);
    try {
      await deleteResident(residentToDelete, actor);
      setResidentToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError(null);
    setImportSuccess(null);
    try {
      const rows = await parseResidentsSpreadsheet(file);
      setParsedImport(rows);
      setShowImportModal(true);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'No se pudo leer el archivo.'
      );
      setParsedImport([]);
      setShowImportModal(true);
    }
  };

  const handleConfirmImport = async () => {
    if (parsedImport.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      const count = await importResidentsBatch(parsedImport, actor);
      setImportSuccess(`Se importaron ${count} residentes correctamente.`);
      setParsedImport([]);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Error al importar residentes.'
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Directorio de Residentes
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {residents.length} unidades registradas ·{' '}
            {residents.filter((r) => r.isMoroso).length} morosos
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4" />
              Importar Excel/CSV
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Nuevo Residente
            </button>
          </div>
        )}
      </div>

      {/* Search & Filter */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar residente, edificio, depto, clave o placas..."
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-300 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-900 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              ['TODOS', 'Todos'],
              ['AL_CORRIENTE', 'Al corriente (Sí paga)'],
              ['MOROSOS', 'Morosos'],
            ] as [PaymentFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPaymentFilter(key)}
              className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                paymentFilter === key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Resident List */}
      {filteredResidents.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-800">
            No se encontraron residentes
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredResidents.map((resident) => (
            <article
              key={resident.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 truncate">
                      {resident.fullName}
                    </h3>
                    <p className="text-xs text-slate-600">
                      {resident.building} · Depto. {resident.apartment}
                      {resident.blockOrSection ? ` · ${resident.blockOrSection}` : ''}
                    </p>
                  </div>
                  <div
                    className={`inline-flex items-center gap-1 text-xs font-bold shrink-0 ${
                      resident.isMoroso ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    {resident.isMoroso ? (
                      <AlertOctagon className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>{resident.isMoroso ? 'Moroso' : 'Sí paga'}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    Clave:{' '}
                    <strong className="font-mono text-slate-900">
                      {resident.accessCode || '—'}
                    </strong>
                  </span>
                  {resident.vehiclePlates && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{resident.vehiclePlates}</span>
                    </>
                  )}
                  {resident.phone && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{resident.phone}</span>
                    </>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleResidentMoroso(resident, actor)}
                    className={`min-h-[40px] flex-1 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      resident.isMoroso
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        : 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100'
                    }`}
                  >
                    {resident.isMoroso ? 'Marcar Al Corriente' : 'Marcar Moroso'}
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(resident)}
                    className="min-h-[40px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => setResidentToDelete(resident)}
                    aria-label={`Eliminar a ${resident.fullName}`}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Modal: Crear / Editar Residente (Admin only) */}
      {showFormModal && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm sm:p-4"
          onClick={() => setShowFormModal(false)}
        >
          <div
            className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 pb-safe shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mb-3 sm:hidden" />

            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingResident ? 'Editar Residente' : 'Nuevo Residente'}
              </h3>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResident} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej. Ana Sofía Ramírez"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Edificio *
                  </label>
                  <input
                    type="text"
                    required
                    value={building}
                    onChange={(e) => setBuilding(e.target.value)}
                    placeholder="Torre A"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:border-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Departamento *
                  </label>
                  <input
                    type="text"
                    required
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value)}
                    placeholder="204"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Clave de acceso
                  </label>
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="Ej. 4821"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 font-mono text-sm focus:border-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sección / Bloque
                  </label>
                  <input
                    type="text"
                    value={blockOrSection}
                    onChange={(e) => setBlockOrSection(e.target.value)}
                    placeholder="Opcional"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="55 1234 5678"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 font-mono text-sm focus:border-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Placas
                  </label>
                  <input
                    type="text"
                    value={vehiclePlates}
                    onChange={(e) => setVehiclePlates(e.target.value.toUpperCase())}
                    placeholder="ABC-123-A"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 font-mono text-sm uppercase focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="residente@correo.com"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notas
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsMoroso(!isMoroso)}
                  className={`min-h-[48px] rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                    isMoroso
                      ? 'bg-red-600 border-red-600 text-white'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  }`}
                >
                  {isMoroso ? 'Estatus: MOROSO' : 'Estatus: SÍ PAGA'}
                </button>

                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`min-h-[48px] rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                    isActive
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-amber-50 border-amber-300 text-amber-800'
                  }`}
                >
                  {isActive ? 'Unidad: ACTIVA' : 'Unidad: INACTIVA'}
                </button>
              </div>

              {formError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-medium">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-[48px] rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-all"
              >
                {saving
                  ? 'Guardando...'
                  : editingResident
                  ? 'Guardar Cambios'
                  : 'Crear Residente'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Eliminar Residente */}
      {residentToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          onClick={() => setResidentToDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900">
              Eliminar residente
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              ¿Eliminar permanentemente a{' '}
              <strong className="text-slate-900">{residentToDelete.fullName}</strong>{' '}
              ({residentToDelete.building} {residentToDelete.apartment})?
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setResidentToDelete(null)}
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteResident}
                disabled={deleting}
                className="min-h-[44px] rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Importación Excel/CSV */}
      {showImportModal && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm sm:p-4"
          onClick={() => setShowImportModal(false)}
        >
          <div
            className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 pb-safe shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-slate-700" />
                <h3 className="text-lg font-bold text-slate-900">
                  Importar Residentes (Excel / CSV)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
              <span>
                Columnas esperadas: Nombre completo, Edificio, Departamento, Clave de acceso, Teléfono, Placas, Estatus pago (Sí/No o Moroso).
              </span>
              <button
                type="button"
                onClick={downloadResidentsTemplateCsv}
                className="min-h-[36px] inline-flex items-center gap-1.5 font-semibold text-slate-900 underline"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar plantilla CSV
              </button>
            </div>

            {importError && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-medium">
                {importError}
              </div>
            )}

            {importSuccess && (
              <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-semibold">
                {importSuccess}
              </div>
            )}

            {parsedImport.length > 0 && (
              <>
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  Vista previa ({parsedImport.length} residentes listos para importar):
                </p>
                <div className="max-h-64 overflow-auto border border-slate-200 rounded-xl mb-4">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0">
                      <tr>
                        <th className="p-2.5">Nombre</th>
                        <th className="p-2.5">Edificio / Depto</th>
                        <th className="p-2.5">Clave</th>
                        <th className="p-2.5">Placas</th>
                        <th className="p-2.5">Estatus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedImport.slice(0, 50).map((row, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-medium text-slate-900">
                            {row.fullName}
                          </td>
                          <td className="p-2.5 text-slate-600">
                            {row.building} · {row.apartment}
                          </td>
                          <td className="p-2.5 font-mono">{row.accessCode || '—'}</td>
                          <td className="p-2.5 font-mono">{row.vehiclePlates || '—'}</td>
                          <td
                            className={`p-2.5 font-semibold ${
                              row.isMoroso ? 'text-red-600' : 'text-emerald-600'
                            }`}
                          >
                            {row.isMoroso ? 'Moroso' : 'Sí paga'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[48px] rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800"
                  >
                    Elegir otro archivo
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={importing}
                    className="min-h-[48px] rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {importing
                      ? 'Importando...'
                      : `Confirmar (${parsedImport.length})`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
