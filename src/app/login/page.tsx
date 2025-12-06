"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Login from "../../components/Login";

const SESSION_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

export default function LoginPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Check if session is still valid
    if (typeof window !== "undefined") {
      const loginTimestamp = localStorage.getItem("loginTimestamp");
      const remembered = localStorage.getItem("rememberMe");
      
      // If remembered but no timestamp exists (old session), treat as expired
      if (remembered === "true" && !loginTimestamp) {
        localStorage.removeItem("rememberMe");
        return;
      }
      
      if (remembered === "true" && loginTimestamp) {
        const now = Date.now();
        const loginTime = parseInt(loginTimestamp, 10);
        const timeElapsed = now - loginTime;
        
        if (timeElapsed < SESSION_TIMEOUT) {
          router.replace("/");
        } else {
          // Session expired, clear storage
          localStorage.removeItem("rememberMe");
          localStorage.removeItem("loginTimestamp");
        }
      }
    }
  }, [router]);

  const handleLogin = () => router.replace("/");
  return <Login onLogin={handleLogin} />;
} 