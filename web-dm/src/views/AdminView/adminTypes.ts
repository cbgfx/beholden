export interface Campaign {
  id: string;
  name: string;
  playerCount: number;
  updatedAt: number;
}

export interface Member {
  id: string;
  role: "dm" | "player";
  user: { id: string; username: string; name: string; isAdmin: boolean };
}

export interface User {
  id: string;
  username: string;
  name: string;
  isAdmin: boolean;
  createdAt: number;
  updatedAt: number;
}
