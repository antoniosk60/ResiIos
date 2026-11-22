export type UserRole = 'ADMINISTRADOR' | 'CAPTURISTA';

export interface AuthorizedUser {
  email: string;
  displayName: string;
  role: UserRole;
  slotId: string; // "0" for admin, "1".."5" for capturistas
  uid: string;
  photoUrl: string;
  addedBy: string;
  addedAtMillis: number;
  lastActiveMillis: number;
}

export interface CapturistaSlot {
  email: string;
  slotId: string; // "1".."5"
  assignedAtMillis: number;
}

export interface Resident {
  id: number;
  fullName: string;
  houseNumber: string;
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
  registeredDateMillis: number;
  createdBy: string;
  lastModifiedBy: string;
  lastModifiedDateMillis: number;
}

export type VisitAccessStatus = 'PERMITIDO' | 'SIN_CLAVE_MOROSO';

export interface Visit {
  id: number;
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
  entryTimestampMillis: number;
  exitTimestampMillis: number | null;
  registeredBy: string;
  notes: string;
}

export interface Tardiness {
  id: number;
  residentId: number;
  residentName: string;
  houseNumber: string;
  timestampMillis: number;
  reason: string;
  vehiclePlate: string;
  registeredBy: string;
  notes: string;
}

export interface AuditLog {
  id: number;
  timestampMillis: number;
  userName: string;
  userRole: string;
  actionType: string;
  entityType: string;
  entityId: number;
  title: string;
  details: string;
}

export type AppTab = 'access' | 'visits' | 'tardiness' | 'residents' | 'admin';
