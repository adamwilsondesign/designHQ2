import { Role } from './mockData';

// Role model. The same matrix is enforced server-side in firestore.rules and
// storage.rules; this file only decides what the UI offers.
//
//   Super Admin (Adam)   everything, including the personal modules
//   Admin (Louie)        every professional module, no personal modules
//   Regular User         dashboard and their own assignments only

export const SUPER_ADMIN_EMAIL = 'adamwilson@lazertechnologies.com';

export type ModuleId =
  | 'dashboard'
  | 'overview'
  | 'staff'
  | 'allocation'
  | 'projects'
  | 'revenue'
  | 'proposals'
  | 'meetings'
  | 'execUpdate'
  | 'social'
  | 'calendar'
  | 'jobSearch'
  | 'profile'
  | 'admin';

const PROFESSIONAL: Role[] = ['Super Admin', 'Admin'];
const PERSONAL: Role[] = ['Super Admin'];
const EVERYONE: Role[] = ['Super Admin', 'Admin', 'Regular User'];

export const MODULE_ACCESS: Record<ModuleId, Role[]> = {
  dashboard: EVERYONE,
  overview: PROFESSIONAL,
  staff: PROFESSIONAL,
  allocation: PROFESSIONAL,
  projects: PROFESSIONAL,
  revenue: PROFESSIONAL,
  proposals: PROFESSIONAL,
  meetings: PROFESSIONAL,
  execUpdate: PROFESSIONAL,
  social: PERSONAL,
  calendar: PERSONAL,
  jobSearch: PERSONAL,
  profile: PERSONAL,
  admin: ['Super Admin'],
};

export const canAccess = (role: Role, module: ModuleId) => MODULE_ACCESS[module].includes(role);

export const isProfessional = (role: Role) => PROFESSIONAL.includes(role);
export const isSuperAdmin = (role: Role) => role === 'Super Admin';
