export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
}

export const users: User[] = [
  {
    id: "1",
    name: "Paper Trader",
    email: "paper@alpaca.local",
    avatar: "https://avatars.githubusercontent.com/u/65284893?v=4",
    role: "trader",
  },
];

export const rootUser = users[0];
