"use client";

import { siGithub } from "simple-icons";

import { SimpleIcon } from "@/components/simple-icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const REPOS = [
  {
    name: "next-shadcn-admin-dashboard",
    url: "https://github.com/arhamkhnz/next-shadcn-admin-dashboard",
  },
  { name: "arhamkhnz", url: "https://github.com/arhamkhnz" },
];

export function GitHubRepositoriesMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <SimpleIcon icon={siGithub} className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">GitHub</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {REPOS.map((repo) => (
          <DropdownMenuItem key={repo.url} asChild>
            <a href={repo.url} target="_blank" rel="noreferrer">
              {repo.name}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
