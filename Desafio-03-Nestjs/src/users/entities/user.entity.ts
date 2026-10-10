import { UserRole } from '../enums/user-role.enum';

export class User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}
