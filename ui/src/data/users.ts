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
    name: "Arham Khan",
    email: "arham@example.com",
    avatar: "https://avatars.githubusercontent.com/u/65284893?v=4",
    role: "administrator",
  },
  {
    id: "2",
    name: "Ammar Khan",
    email: "ammar@example.com",
    avatar: "https://avatars.githubusercontent.com/u/65284893?v=4",
    role: "admin",
  },
];

export const rootUser = users[0];
