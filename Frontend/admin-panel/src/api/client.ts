import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("akk_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      localStorage.removeItem("akk_token");
      localStorage.removeItem("akk_admin");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login?session=expired";
      }
    }
    return Promise.reject(error);
  }
);
