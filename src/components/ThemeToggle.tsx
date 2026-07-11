import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as "light" | "dark") || "light";
    }
    return "light";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="h-9 w-9 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
    >
      {theme === "light" ? (
        <Moon className="h-4 w-4 transition-transform active:rotate-45" />
      ) : (
        <Sun className="h-4 w-4 text-amber-500 transition-transform active:scale-95" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
