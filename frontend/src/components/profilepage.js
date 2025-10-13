import React, { useEffect, useState } from "react";
import { getProfile, updateProfile } from "../utils/profileservice.js";
import './profilepage.css';
const ProfileForm = ({ onBack }) => {
  const [formData, setFormData] = useState({
    username: "",  
    display_name: "",
    preferred_system: "",
    timezone: "",
    bio: "",
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
  getProfile()
    .then((data) => {
      const profileData = data.profile || {};

      setFormData({
        username: data.username || "", // read-only
        display_name: profileData.display_name || "",
        preferred_system: profileData.preferred_system || "",
        timezone: profileData.timezone || "",
        bio: profileData.bio || "",
      });

      setLoading(false);
    })
    .catch((err) => {
      console.error("Failed to load profile:", err);
      setMessage("Failed to load profile");
      setLoading(false);
    });
}, []);



  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateProfile(formData)
      .then((data) => {
        setFormData(data);
        setMessage("Profile updated successfully!");
      })
      .catch(() => setMessage("Failed to update profile"));
  };

  if (loading) return <div>Loading profile...</div>;

  return (
    <div className="profile-container">
      <h2>Profile</h2>
      {message && <p>{message}</p>}
      <form onSubmit={handleSubmit}>

        <label>
            Username:
            <input type="text" name="username" value={formData.username} disabled />
        </label>
        <label>
          Display Name:
          <input type="text" name="display_name" value={formData.display_name} onChange={handleChange} />
        </label>

        <label>
          Preferred System:
          <select name="preferred_system" value={formData.preferred_system || ""} onChange={handleChange}>
            <option value="">Select</option>
            <option value="acol">Acol</option>
            <option value="standard_american">Standard American</option>
            <option value="precision">Precision</option>
          </select>
        </label>

        <label>
          Timezone:
          <input type="text" name="timezone" value={formData.timezone} onChange={handleChange} />
        </label>

        <label>
          Bio:
          <textarea name="bio" value={formData.bio} onChange={handleChange} />
        </label>

        <div>
          <button type="submit">Save</button>
          <button type="button" onClick={onBack}>Back</button>
        </div>
      </form>
    </div>
  );
};

export default ProfileForm;
