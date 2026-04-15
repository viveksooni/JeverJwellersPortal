export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
