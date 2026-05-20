  import { createRoot } from "react-dom/client";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { Toaster } from "sonner";
  import { ThemeProvider } from "./app/context/ThemeContext";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });

  createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              fontFamily: 'inherit',
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
  
