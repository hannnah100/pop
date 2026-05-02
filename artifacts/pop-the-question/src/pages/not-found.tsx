import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home as HomeIcon } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex-1 w-full flex items-center justify-center p-6">
      <Card className="w-full max-w-md mx-4 bg-card/85 backdrop-blur-md border-border">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-black font-display tracking-tight text-foreground">404 Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            That page doesn't exist (yet). Let's get you back to the action.
          </p>

          <Link href="/">
            <Button className="mt-6 w-full">
              <HomeIcon className="w-4 h-4 mr-2" /> Back Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
