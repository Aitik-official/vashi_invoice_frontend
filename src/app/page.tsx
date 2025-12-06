"use client";
import { useEffect, useState } from "react";
import Dashboard from '../components/Dashboard';
import Login from '../components/Login';

const SESSION_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

export default function HomePage() {
  const [auth, setAuth] = useState(false);

  const checkSession = () => {
    if (typeof window !== "undefined") {
      const loginTimestamp = localStorage.getItem("loginTimestamp");
      const remembered = localStorage.getItem("rememberMe");
      
      // If remembered but no timestamp exists (old session), treat as expired
      if (remembered === "true" && !loginTimestamp) {
        localStorage.removeItem("rememberMe");
        setAuth(false);
        return false;
      }
      
      if (remembered === "true" && loginTimestamp) {
        const now = Date.now();
        const loginTime = parseInt(loginTimestamp, 10);
        const timeElapsed = now - loginTime;
        
        if (timeElapsed < SESSION_TIMEOUT) {
          setAuth(true);
          return true;
        } else {
          // Session expired (more than 4 hours)
          localStorage.removeItem("rememberMe");
          localStorage.removeItem("loginTimestamp");
          setAuth(false);
          return false;
        }
      }
    }
    return false;
  };

  useEffect(() => {
    checkSession();
    
    // Check session every minute
    const interval = setInterval(() => {
      if (!checkSession()) {
        clearInterval(interval);
      }
    }, 60000); // Check every minute

    // Check session on user activity (mouse move, click, keypress)
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const handleActivity = () => {
      if (!checkSession()) {
        activityEvents.forEach(event => {
          document.removeEventListener(event, handleActivity);
        });
      }
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    return () => {
      clearInterval(interval);
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, []);

  const handleLogin = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("loginTimestamp", Date.now().toString());
    }
    setAuth(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("rememberMe");
    localStorage.removeItem("loginTimestamp");
    setAuth(false);
  };

  return (
    <>
      {!auth && <Login onLogin={handleLogin} />}
      {auth && <Dashboard onLogout={handleLogout} />}
    </>
  );
}
