const KEY = "hookshade_token";
export const getToken = () => (typeof window !== "undefined" ? localStorage.getItem(KEY) : null);
export const setToken = (t: string) => localStorage.setItem(KEY, t);
export const clearToken = () => localStorage.removeItem(KEY);
