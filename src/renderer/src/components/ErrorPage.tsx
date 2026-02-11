import { useRouteError, isRouteErrorResponse, Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorPage() {
  const error = useRouteError();
  console.error(error);

  let errorMessage = "An unexpected error has occurred.";

  if (isRouteErrorResponse(error)) {
    // error is type `ErrorResponse`
    errorMessage = error.statusText || error.data?.message || "Unknown Error";
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground p-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">Oops! Something went wrong</h1>
        <p className="text-muted-foreground">
          {errorMessage}
        </p>
        <div className="flex gap-2 mt-4">
            <Button asChild variant="outline">
                <Link to="/">Go Home</Link>
            </Button>
            <Button onClick={() => window.location.reload()}>
                Reload Application
            </Button>
        </div>
        <div className="mt-8 p-4 bg-muted rounded-lg text-left w-full overflow-auto max-h-[200px] border border-border">
            <code className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                {String(error)}
            </code>
        </div>
      </div>
    </div>
  );
}
