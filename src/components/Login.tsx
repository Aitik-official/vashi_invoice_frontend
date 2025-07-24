"use client";
import React, { useState, useEffect } from "react";

const USERID = "admin_01";
const PASSWORD = "admin@123";

const Login = ({ onLogin }: { onLogin: () => void }) => {
  const [userid, setUserid] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Autofill if remembered
    if (typeof window !== "undefined") {
      const remembered = localStorage.getItem("rememberMe");
      if (remembered === "true") {
        onLogin();
      }
    }
  }, [onLogin]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (userid === USERID && password === PASSWORD) {
      if (remember) {
        localStorage.setItem("rememberMe", "true");
      } else {
        localStorage.removeItem("rememberMe");
      }
      onLogin();
    } else {
      setError("Invalid userid or password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 fixed inset-0 z-50">
      <form
        onSubmit={handleLogin}
        className="bg-white shadow-xl rounded-lg p-8 w-full max-w-sm flex flex-col gap-4 border border-gray-200"
      >
        <h2 className="text-2xl font-bold text-orange-700 mb-2 text-center">Login</h2>
        <div>
          <label className="block text-sm font-semibold mb-1 text-gray-700">User ID</label>
          <input
            type="text"
            value={userid}
            onChange={e => setUserid(e.target.value)}
            className="w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1 text-gray-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900"
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
          <label htmlFor="remember" className="text-sm text-gray-700">Remember Me</label>
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

export default Login; 