import api from "./axios";

export async function registerUser(userData) {
  const response = await api.post("/auth/register", {
    fullName: userData.fullName.trim(),
    username: userData.username.trim().toLowerCase(),
    email: userData.email.trim().toLowerCase(),
    password: userData.password,
  });

  return response.data;
}

export async function loginUser(credentials) {
  const response = await api.post("/auth/login", {
    email: credentials.email.trim().toLowerCase(),
    password: credentials.password,
  });

  return response.data;
}

export async function getCurrentUser() {
  const response = await api.get("/auth/me");
  return response.data;
}

export async function logoutUser() {
  const response = await api.post("/auth/logout");
  return response.data;
}

export async function requestPasswordReset(email) {
  const response = await api.post("/auth/forgot-password", {
    email: email.trim().toLowerCase(),
  });

  return response.data;
}
