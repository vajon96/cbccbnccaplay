import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    try {
      sessionStorage.removeItem("cbcc_lazy_reload_ts");
    } catch {
      // ignore
    }
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let isFirestoreError = false;
      let isModuleLoadError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            isFirestoreError = true;
            errorMessage = `Firestore Error: ${parsed.error} (${parsed.operationType} on ${parsed.path})`;
          }
        }
      } catch {
        errorMessage = this.state.error?.message || errorMessage;
      }

      const lowerMsg = errorMessage.toLowerCase();
      if (
        lowerMsg.includes("dynamically imported module") ||
        lowerMsg.includes("importing a module script failed") ||
        lowerMsg.includes("chunkloaderror") ||
        lowerMsg.includes("loading chunk")
      ) {
        isModuleLoadError = true;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#00152e] p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-2xl">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-[#002147]" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {isModuleLoadError ? "Portal Update Available" : "Oops! Something went wrong"}
            </h2>
            <p className="text-slate-600 mb-6 text-sm leading-relaxed">
              {isModuleLoadError
                ? "The portal was updated or the connection was interrupted while loading this page. Reload to get the latest version."
                : isFirestoreError
                ? "There was a problem communicating with the database."
                : "We encountered an unexpected error while processing your request."}
            </p>

            <div className="bg-slate-100 rounded-2xl p-4 mb-6 text-left border border-slate-200">
              <p className="text-xs font-mono text-slate-800 break-words">{errorMessage}</p>
            </div>

            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 bg-[#002147] hover:bg-[#0B2545] text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-lg cursor-pointer"
            >
              <RefreshCcw className="w-4 h-4" />
              {isModuleLoadError ? "Reload Portal" : "Try Again"}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
