import { UserRole } from '../types';

export const hasTeacherOperationsAccess = (role?: UserRole | null) =>
  role === 'teacher' || role === 'admin';
