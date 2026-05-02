import { useEffect, useState } from "react";
import { authService } from "../services/authService";
import { ApiError } from "../services/api";
import type { AuthUser } from "../types";

const parseError = (error: unknown) =>
  error instanceof Error ? error.message : "登入失敗。";

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCurrentUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        setUser(null);
      } else {
        setError(parseError(requestError));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCurrentUser();
  }, []);

  const loginWithHht = async (userNo: string, password: string) => {
    setError(null);
    try {
      const nextUser = await authService.loginWithHht({ userNo, password });
      setUser(nextUser);
      return nextUser;
    } catch (loginError) {
      setError(parseError(loginError));
      throw loginError;
    }
  };

  const linkInternal = async (userNo: string, password: string) => {
    setError(null);
    try {
      const nextUser = await authService.linkInternal({ userNo, password });
      setUser(nextUser);
      return nextUser;
    } catch (linkError) {
      setError(parseError(linkError));
      throw linkError;
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return {
    user,
    loading,
    error,
    reload: loadCurrentUser,
    loginWithHht,
    linkInternal,
    logout
  };
};
