import { apiCall } from "./api";

// Get profile
export const getProfile = async () => {
  const res = await apiCall("/auth/profile/", { method: "GET" });
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
};

// Updata profile
export const updateProfile = async (data) => {
  const res = await apiCall("/auth/profile/update/", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update profile");
  return res.json();
};
