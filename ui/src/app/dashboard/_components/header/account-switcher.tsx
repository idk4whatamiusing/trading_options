"use client";

import { ChevronsUpDown, LogOut } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGoogleSession } from "@/hooks/use-google-session";
import { getInitials } from "@/lib/utils";

// Single real Google-authenticated user - no multi-account switching, that
// was a leftover from the generic admin template this dashboard started
// from and doesn't apply to this app's auth model.
export function AccountSwitcher() {
  const { user, loading, logout } = useGoogleSession();

  if (!loading && !user) {
    return (
      <Button variant="ghost" size="sm" className="gap-2 px-2" asChild>
        <a href="/api/auth/google/start">Sign in</a>
      </Button>
    );
  }

  const name = user?.name ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2" disabled={loading}>
          <Avatar className="h-6 w-6 rounded-lg">
            <AvatarImage src={user?.picture || undefined} alt={name} />
            <AvatarFallback className="rounded-lg text-xs">{getInitials(name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium lg:inline-block">
            {name}
          </span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {user?.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()} className="gap-2">
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
