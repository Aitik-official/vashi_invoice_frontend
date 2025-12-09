"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const USERID = "admin_01";
const PASSWORD = "admin@123";

const LoginPage = () => {
  const [userid, setUserid] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const SESSION_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (userid === USERID && password === PASSWORD) {
      if (typeof window !== "undefined") {
        // Store login timestamp for session timeout
        localStorage.setItem("loginTimestamp", Date.now().toString());
        
        if (remember) {
          localStorage.setItem("rememberMe", "true");
        } else {
          localStorage.removeItem("rememberMe");
        }
      }
      router.replace("/");
    } else {
      setError("Invalid username or password");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <img
        src="/inovice_formatting/logo_wbg.png"
        alt="Logo"
        className="w-40 h-auto mb-6 drop-shadow-lg"
        style={{ maxWidth: 180 }}
      />
      <form
        onSubmit={handleLogin}
        className="bg-white shadow-xl rounded-lg p-8 w-full max-w-sm flex flex-col gap-4 border border-gray-200"
      >
        <h2 className="text-2xl font-bold text-orange-700 mb-2 text-center">Login</h2>
        <div>
          <label className="block text-sm font-semibold mb-1">User ID</label>
          <input
            type="text"
            value={userid}
            onChange={e => setUserid(e.target.value)}
            className="w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-orange-400"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-orange-400"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="remember"
            checked={remember}
            onChange={e => setRemember(e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="remember" className="text-sm">Remember Me</label>
        </div>
        {error && <div className="text-red-600 text-sm text-center">{error}</div>}
        <button
          type="submit"
          className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded transition mt-2"
        >
          Login
        </button>
      </form>
    </div>
  );
};

export default LoginPage; 