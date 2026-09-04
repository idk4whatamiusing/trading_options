import { siGithub } from "simple-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleIcon } from "@/components/simple-icon";

export function SupportCard() {
  return (
    <Card className="gap-2 py-3 shadow-none">
      <CardHeader className="px-3">
        <CardTitle className="text-sm">Paper Trading Only</CardTitle>
        <p className="text-xs text-muted-foreground">Alpaca MCP · CF Workers AI</p>
      </CardHeader>
      <CardContent className="flex gap-2 px-3">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" asChild>
          <a href="https://github.com/anomalyco/opencode" target="_blank" rel="noreferrer">
            <SimpleIcon icon={siGithub} className="size-3.5" />
            GitHub
          </a>
        </Button>
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" asChild>
          <a href="/dashboard" rel="noreferrer">
            Docs
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
