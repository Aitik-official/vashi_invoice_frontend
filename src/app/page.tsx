"use client";
import { useEffect, useState } from "react";
import Dashboard from '../components/Dashboard';
import Login from '../components/Login';

export default function HomePage() {
  const [auth, setAuth] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const remembered = localStorage.getItem("rememberMe");
      if (remembered === "true") {
        setAuth(true);
      }
    }
  }, []);

  const handleLogin = () => setAuth(true);
  const handleLogout = () => {
    localStorage.removeItem("rememberMe");
    setAuth(false);
  };

  return (
    <>
      {!auth && <Login onLogin={handleLogin} />}
      {auth && <Dashboard onLogout={handleLogout} />}
    </>
  );
}
