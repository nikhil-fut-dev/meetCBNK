import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from "../services/api/authService";

const AuthContext = createContext(null);

function extractUser(data) {
  return data?.user ?? data?.data?.user ?? null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await getCurrentUser();
      setUser(extractUser(data));
      return extractUser(data);
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  async function login(credentials) {
    const data = await loginUser(credentials);
    const responseUser = extractUser(data);

    if (responseUser) {
      setUser(responseUser);
    } else {
      await refreshUser();
    }

    return data;
  }

  async function register(userData) {
    const data = await registerUser(userData);
    const responseUser = extractUser(data);

    if (responseUser) {
      setUser(responseUser);
    } else {
      await refreshUser();
    }

    return data;
  }

  async function logout() {
    try {
      await logoutUser();
    } finally {
      setUser(null);
    }
  }

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
