import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { ADMIN_EMAIL, db, handleFirestoreError, OperationType } from '../firebase';
import type {
  AuditLog,
  AuthorizedUser,
  Resident,
  Tardiness,
  Visit,
  VisitAccessStatus,
} from '../types';
import {
  generateNumericId,
  isTimestampInMonthYear,
  type ParsedImportResident,
  SPANISH_MONTHS,
} from '../utils/formatters';

export async function verifyAndSyncAuthorizedUser(
  firebaseUser: User
): Promise<AuthorizedUser | null> {
  const emailLower = (firebaseUser.email || '').trim().toLowerCase();
  if (!emailLower) return null;

  const userDocPath = `authorized_users/${emailLower}`;
  const userRef = doc(db, 'authorized_users', emailLower);
  const now = Date.now();

  try {
    const snap = await getDoc(userRef);

    if (emailLower === ADMIN_EMAIL) {
      if (!snap.exists()) {
        const adminProfile: AuthorizedUser = {
          email: emailLower,
          displayName: firebaseUser.displayName || 'Administrador Gavilán 181',
          role: 'ADMINISTRADOR',
          slotId: '0',
          uid: firebaseUser.uid,
          photoUrl: firebaseUser.photoURL || '',
          addedBy: 'SYSTEM',
          addedAtMillis: now,
          lastActiveMillis: now,
        };
        await setDoc(userRef, adminProfile);
        return adminProfile;
      } else {
        const existing = snap.data() as AuthorizedUser;
        const updates = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || existing.displayName || 'Administrador',
          photoUrl: firebaseUser.photoURL || existing.photoUrl || '',
          role: 'ADMINISTRADOR' as const,
          slotId: '0',
          lastActiveMillis: now,
        };
        await updateDoc(userRef, updates);
        return { ...existing, ...updates };
      }
    }

    if (!snap.exists()) {
      return null;
    }

    const existing = snap.data() as AuthorizedUser;
    if (existing.role !== 'ADMINISTRADOR' && existing.role !== 'CAPTURISTA') {
      return null;
    }

    const updates = {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName || existing.displayName || emailLower,
      photoUrl: firebaseUser.photoURL || existing.photoUrl || '',
      lastActiveMillis: now,
    };
    await updateDoc(userRef, updates);
    return { ...existing, ...updates };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userDocPath);
  }
}

async function writeAuditLogEntry(params: {
  actor: AuthorizedUser;
  actionType: string;
  entityType: string;
  entityId: number;
  title: string;
  details: string;
}): Promise<void> {
  const logId = generateNumericId();
  const docId = `log_${logId}`;
  const payload: AuditLog = {
    id: logId,
    timestampMillis: Date.now(),
    userName: params.actor.displayName || params.actor.email,
    userRole: params.actor.role,
    actionType: params.actionType,
    entityType: params.entityType,
    entityId: params.entityId,
    title: params.title,
    details: params.details,
  };
  try {
    await setDoc(doc(db, 'audit_logs', docId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `audit_logs/${docId}`);
  }
}

// ---------- CAPTURISTA SLOTS (ADMIN ONLY) ----------

export async function assignCapturistaSlot(
  slotId: string,
  rawEmail: string,
  actor: AuthorizedUser
): Promise<void> {
  const emailLower = rawEmail.trim().toLowerCase();
  if (!emailLower || !emailLower.includes('@')) {
    throw new Error('Ingresa un correo electrónico válido.');
  }
  if (emailLower === ADMIN_EMAIL) {
    throw new Error('Ese correo ya corresponde al Administrador principal.');
  }
  if (!['1', '2', '3', '4', '5'].includes(slotId)) {
    throw new Error('Slot de capturista inválido.');
  }

  const now = Date.now();
  const slotPath = `capturista_slots/${slotId}`;
  const authUserPath = `authorized_users/${emailLower}`;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'capturista_slots', slotId), {
      email: emailLower,
      slotId,
      assignedAtMillis: now,
    });
    batch.set(doc(db, 'authorized_users', emailLower), {
      email: emailLower,
      displayName: emailLower.split('@')[0],
      role: 'CAPTURISTA',
      slotId,
      uid: '',
      photoUrl: '',
      addedBy: actor.email,
      addedAtMillis: now,
      lastActiveMillis: 0,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${slotPath} | ${authUserPath}`);
  }

  await writeAuditLogEntry({
    actor,
    actionType: 'ASSIGN_CAPTURISTA',
    entityType: 'CAPTURISTA_SLOT',
    entityId: Number(slotId),
    title: `Capturista asignado (Slot ${slotId})`,
    details: `Se autorizó a ${emailLower} en el slot ${slotId}.`,
  });
}

export async function removeCapturistaSlot(
  slotId: string,
  email: string,
  actor: AuthorizedUser
): Promise<void> {
  const emailLower = email.trim().toLowerCase();
  const slotPath = `capturista_slots/${slotId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'capturista_slots', slotId));
    if (emailLower && emailLower !== ADMIN_EMAIL) {
      batch.delete(doc(db, 'authorized_users', emailLower));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, slotPath);
  }

  await writeAuditLogEntry({
    actor,
    actionType: 'REMOVE_CAPTURISTA',
    entityType: 'CAPTURISTA_SLOT',
    entityId: Number(slotId),
    title: `Capturista removido (Slot ${slotId})`,
    details: `Se revocó el acceso de ${emailLower} del slot ${slotId}.`,
  });
}

// ---------- RESIDENTS ----------

export interface ResidentInput {
  fullName: string;
  building: string;
  apartment: string;
  accessCode: string;
  blockOrSection: string;
  phone: string;
  email: string;
  vehiclePlates: string;
  notes: string;
  isMoroso: boolean;
  isActive: boolean;
}

export async function createResident(
  input: ResidentInput,
  actor: AuthorizedUser
): Promise<Resident> {
  const id = generateNumericId();
  const now = Date.now();
  const docId = `res_${id}`;
  const houseNumber = `${input.building.trim()} ${input.apartment.trim()}`.trim();

  const resident: Resident = {
    id,
    fullName: input.fullName.trim(),
    houseNumber,
    building: input.building.trim(),
    apartment: input.apartment.trim(),
    accessCode: input.accessCode.trim(),
    blockOrSection: input.blockOrSection.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    vehiclePlates: input.vehiclePlates.trim().toUpperCase(),
    notes: input.notes.trim(),
    isMoroso: input.isMoroso,
    isActive: input.isActive,
    registeredDateMillis: now,
    createdBy: actor.email,
    lastModifiedBy: actor.email,
    lastModifiedDateMillis: now,
  };

  try {
    await setDoc(doc(db, 'residents', docId), resident);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `residents/${docId}`);
  }

  await writeAuditLogEntry({
    actor,
    actionType: 'CREATE_RESIDENT',
    entityType: 'RESIDENT',
    entityId: id,
    title: `Residente creado: ${resident.fullName}`,
    details: `${resident.building} Depto ${resident.apartment} · Clave: ${resident.accessCode || 'N/A'} · Moroso: ${resident.isMoroso ? 'Sí' : 'No'}`,
  });

  return resident;
}

export async function updateResident(
  existing: Resident,
  input: ResidentInput,
  actor: AuthorizedUser
): Promise<void> {
  const docId = `res_${existing.id}`;
  const now = Date.now();
  const houseNumber = `${input.building.trim()} ${input.apartment.trim()}`.trim();

  const updatedFields = {
    fullName: input.fullName.trim(),
    houseNumber,
    building: input.building.trim(),
    apartment: input.apartment.trim(),
    accessCode: input.accessCode.trim(),
    blockOrSection: input.blockOrSection.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    vehiclePlates: input.vehiclePlates.trim().toUpperCase(),
    notes: input.notes.trim(),
    isMoroso: input.isMoroso,
    isActive: input.isActive,
    lastModifiedBy: actor.email,
    lastModifiedDateMillis: now,
  };

  try {
    await updateDoc(doc(db, 'residents', docId), updatedFields);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `residents/${docId}`);
  }

  await writeAuditLogEntry({
    actor,
    actionType: 'UPDATE_RESIDENT',
    entityType: 'RESIDENT',
    entityId: existing.id,
    title: `Residente actualizado: ${updatedFields.fullName}`,
    details: `${updatedFields.building} Depto ${updatedFields.apartment} · Moroso: ${updatedFields.isMoroso ? 'Sí' : 'No'} · Activo: ${updatedFields.isActive ? 'Sí' : 'No'}`,
  });
}

export async function toggleResidentMoroso(
  resident: Resident,
  actor: AuthorizedUser
): Promise<void> {
  const docId = `res_${resident.id}`;
  const nextMoroso = !resident.isMoroso;
  try {
    await updateDoc(doc(db, 'residents', docId), {
      isMoroso: nextMoroso,
      lastModifiedBy: actor.email,
      lastModifiedDateMillis: Date.now(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `residents/${docId}`);
  }

  await writeAuditLogEntry({
    actor,
    actionType: 'TOGGLE_MOROSO',
    entityType: 'RESIDENT',
    entityId: resident.id,
    title: `Cambio estatus de pago: ${resident.fullName}`,
    details: `${resident.building} Depto ${resident.apartment} cambió a ${nextMoroso ? 'MOROSO (Acceso denegado)' : 'AL CORRIENTE (Acceso autorizado)'}.`,
  });
}

export async function deleteResident(
  resident: Resident,
  actor: AuthorizedUser
): Promise<void> {
  const docId = `res_${resident.id}`;
  try {
    await deleteDoc(doc(db, 'residents', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `residents/${docId}`);
  }

  await writeAuditLogEntry({
    actor,
    actionType: 'DELETE_RESIDENT',
    entityType: 'RESIDENT',
    entityId: resident.id,
    title: `Residente eliminado: ${resident.fullName}`,
    details: `Se eliminó el registro de ${resident.building} Depto ${resident.apartment}.`,
  });
}

export async function importResidentsBatch(
  rows: ParsedImportResident[],
  actor: AuthorizedUser
): Promise<number> {
  const now = Date.now();
  const CHUNK_SIZE = 400;
  let importedCount = 0;

  try {
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const item of chunk) {
        const id = generateNumericId();
        const docId = `res_${id}`;
        const resident: Resident = {
          id,
          fullName: item.fullName,
          houseNumber: `${item.building} ${item.apartment}`.trim(),
          building: item.building,
          apartment: item.apartment,
          accessCode: item.accessCode,
          blockOrSection: item.blockOrSection,
          phone: item.phone,
          email: item.email,
          vehiclePlates: item.vehiclePlates,
          notes: item.notes,
          isMoroso: item.isMoroso,
          isActive: true,
          registeredDateMillis: now,
          createdBy: actor.email,
          lastModifiedBy: actor.email,
          lastModifiedDateMillis: now,
        };
        batch.set(doc(db, 'residents', docId), resident);
        importedCount += 1;
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'residents (batch import)');
  }

  await writeAuditLogEntry({
    actor,
    actionType: 'IMPORT_RESIDENTS',
    entityType: 'RESIDENT',
    entityId: now,
    title: `Importación masiva de residentes (${importedCount})`,
    details: `Se importaron ${importedCount} residentes desde archivo Excel/CSV.`,
  });

  return importedCount;
}

// ---------- VISITS ----------

export interface VisitInput {
  visitorName: string;
  visitorIdOrIne: string;
  visitorVehiclePlates: string;
  building: string;
  apartment: string;
  residentId: number;
  residentName: string;
  reason: string;
  isResidentMoroso: boolean;
  accessStatus: VisitAccessStatus;
  accessCodeUsed: string;
  notes: string;
}

export async function createVisit(
  input: VisitInput,
  actor: AuthorizedUser
): Promise<Visit> {
  const id = generateNumericId();
  const now = Date.now();
  const docId = `visit_${id}`;

  const visit: Visit = {
    id,
    visitorName: input.visitorName.trim(),
    visitorIdOrIne: input.visitorIdOrIne.trim(),
    visitorVehiclePlates: input.visitorVehiclePlates.trim().toUpperCase(),
    building: input.building.trim(),
    apartment: input.apartment.trim(),
    residentId: input.residentId,
    residentName: input.residentName.trim(),
    reason: input.reason.trim() || 'Visita',
    isResidentMoroso: input.isResidentMoroso,
    accessStatus: input.accessStatus,
    accessCodeUsed: input.accessCodeUsed.trim(),
    entryTimestampMillis: now,
    exitTimestampMillis: null,
    registeredBy: actor.displayName || actor.email,
    notes: input.notes.trim(),
  };

  try {
    await setDoc(doc(db, 'visits', docId), visit);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `visits/${docId}`);
  }

  await writeAuditLogEntry({
    actor,
    actionType: 'CREATE_VISIT',
    entityType: 'VISIT',
    entityId: id,
    title: `Entrada de visita: ${visit.visitorName}`,
    details: `Destino: ${visit.building} Depto ${visit.apartment} (${visit.residentName}) · Estatus: ${visit.accessStatus}`,
  });

  return visit;
}

export async function markVisitExit(
  visit: Visit,
  actor: AuthorizedUser
): Promise<void> {
  const docId = `visit_${visit.id}`;
  const exitMillis = Date.now();
  try {
    await updateDoc(doc(db, 'visits', docId), {
      exitTimestampMillis: exitMillis,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `visits/${docId}`);
  }

  await writeAuditLogEntry({
    actor,
    actionType: 'VISIT_EXIT',
    entityType: 'VISIT',
    entityId: visit.id,
    title: `Salida de visita: ${visit.visitorName}`,
    details: `Salió de ${visit.building} Depto ${visit.apartment}.`,
  });
}

// ---------- TARDINESS ----------

export interface TardinessInput {
  residentId: number;
  residentName: string;
  houseNumber: string;
  reason: string;
  vehiclePlate: string;
  notes: string;
}

export async function createTardiness(
  input: TardinessInput,
  actor: AuthorizedUser
): Promise<Tardiness> {
  const id = generateNumericId();
  const now = Date.now();
  const docId = `tard_${id}`;

  const tardiness: Tardiness = {
    id,
    residentId: input.residentId,
    residentName: input.residentName.trim(),
    houseNumber: input.houseNumber.trim(),
    timestampMillis: now,
    reason: input.reason.trim() || 'Retardo',
    vehiclePlate: input.vehiclePlate.trim().toUpperCase(),
    registeredBy: actor.displayName || actor.email,
    notes: input.notes.trim(),
  };

  try {
    await setDoc(doc(db, 'tardiness', docId), tardiness);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `tardiness/${docId}`);
  }

  await writeAuditLogEntry({
    actor,
    actionType: 'CREATE_TARDINESS',
    entityType: 'TARDINESS',
    entityId: id,
    title: `Retardo registrado: ${tardiness.residentName}`,
    details: `Unidad: ${tardiness.houseNumber} · Motivo: ${tardiness.reason} · Placas: ${tardiness.vehiclePlate || 'N/A'}`,
  });

  return tardiness;
}

export async function deleteTardiness(
  record: Tardiness,
  actor: AuthorizedUser
): Promise<void> {
  const docId = `tard_${record.id}`;
  try {
    await deleteDoc(doc(db, 'tardiness', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tardiness/${docId}`);
  }

  await writeAuditLogEntry({
    actor,
    actionType: 'DELETE_TARDINESS',
    entityType: 'TARDINESS',
    entityId: record.id,
    title: `Retardo eliminado: ${record.residentName}`,
    details: `Se eliminó el registro de retardo (${record.houseNumber} · ${record.reason}).`,
  });
}

// ---------- MONTHLY CLOSE (ADMIN ONLY) ----------

export async function executeMonthlyClosePurge(params: {
  monthIndex: number; // 0..11
  year: number;
  visits: Visit[];
  tardiness: Tardiness[];
  auditLogs: AuditLog[];
  actor: AuthorizedUser;
}): Promise<{ deletedVisits: number; deletedTardiness: number; deletedLogs: number }> {
  const { monthIndex, year, visits, tardiness, auditLogs, actor } = params;

  const targetVisits = visits.filter((v) =>
    isTimestampInMonthYear(v.entryTimestampMillis, monthIndex, year)
  );
  const targetTardiness = tardiness.filter((t) =>
    isTimestampInMonthYear(t.timestampMillis, monthIndex, year)
  );
  const targetLogs = auditLogs.filter((l) =>
    isTimestampInMonthYear(l.timestampMillis, monthIndex, year)
  );

  const refsToDelete = [
    ...targetVisits.map((v) => doc(db, 'visits', `visit_${v.id}`)),
    ...targetTardiness.map((t) => doc(db, 'tardiness', `tard_${t.id}`)),
    ...targetLogs.map((l) => doc(db, 'audit_logs', `log_${l.id}`)),
  ];

  const CHUNK_SIZE = 400;
  try {
    for (let i = 0; i < refsToDelete.length; i += CHUNK_SIZE) {
      const chunk = refsToDelete.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const ref of chunk) {
        batch.delete(ref);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'monthly_close_purge');
  }

  const monthLabel = `${SPANISH_MONTHS[monthIndex]} ${year}`;
  await writeAuditLogEntry({
    actor,
    actionType: 'MONTHLY_CLOSE',
    entityType: 'SYSTEM',
    entityId: generateNumericId(),
    title: `Cierre Mensual ejecutado (${monthLabel})`,
    details: `Se depuraron ${targetVisits.length} visitas, ${targetTardiness.length} retardos y ${targetLogs.length} registros de auditoría. El catálogo de residentes permaneció intacto.`,
  });

  return {
    deletedVisits: targetVisits.length,
    deletedTardiness: targetTardiness.length,
    deletedLogs: targetLogs.length,
  };
}
