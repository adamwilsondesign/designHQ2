export type Role = 'Super Admin' | 'Admin' | 'Regular User';

export interface User {
  email: string;
  name: string;
  role: Role;
  avatar: string;
}

export const MOCK_USERS: Record<string, User> = {
  'adamwilson@lazertechnologies.com': {
    email: 'adamwilson@lazertechnologies.com',
    name: 'Adam Wilson',
    role: 'Super Admin',
    avatar: 'https://i.pravatar.cc/150?u=adam',
  },
  'operations@lazertechnologies.com': {
    email: 'operations@lazertechnologies.com',
    name: 'Ops Manager',
    role: 'Admin',
    avatar: 'https://i.pravatar.cc/150?u=ops',
  },
  'designer@lazertechnologies.com': {
    email: 'designer@lazertechnologies.com',
    name: 'Lead Designer',
    role: 'Regular User',
    avatar: 'https://i.pravatar.cc/150?u=designer',
  },
};

export interface StaffMember {
  id: string;
  name: string;
  personalEmail?: string;
  lazerEmail?: string;
  location: string;
  timezone: string;
  employmentType: string;
  hourlyCost: number;
  skills: string[];
}

export interface Project {
  id: string;
  client: string;
  lob: string;
  type: string;
  clientLocation: string;
  status: 'Open' | 'Closed' | 'Lost';
  totalHours: number;
  billedRate: number;
  totalValue: number;
  startDate: string;
  finishDate: string;
  assignedStaffIds: string[];
  staffAllocations?: Record<string, number>; // Maps staff ID to allocation percentage (0-100)
  designSourced?: boolean;
  designClosed?: boolean;
}

export interface Sale {
  id: string;
  client: string;
  lob: string;
  type: string;
  clientLocation: string;
  status: 'Open' | 'In Negotiation' | 'Closed' | 'Lost';
  projectedValue: number;
  projectedHours: number;
  projectedRate: number;
  lastContactDate: string;
  projectedCloseDate?: string;
  designSourced?: boolean;
  designClosed?: boolean;
}

// We start with empty arrays to allow real data entry
export const MOCK_STAFF: StaffMember[] = [];
export const MOCK_PROJECTS: Project[] = [];
export const MOCK_SALES: Sale[] = [];
