import { createContext, useEffect, useState } from "react";
import axios from "axios";

export const UserContext = createContext({});

export function UserContextProvider({ children }) {
  const [username, setUsername] = useState(null);
  const [id, setId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile on initial app load
  useEffect(() => {
    axios.get("/profile")
      .then(response => {
        if (response.data?.username && response.data?.userId) {
          setId(response.data.userId);
          setUsername(response.data.username);
        } else {
          setId(null);
          setUsername(null);
        }
      })
      .catch(err => {
        console.warn("Profile fetch failed:", err.response?.data || err.message);
        setId(null);
        setUsername(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Call this immediately after successful login/register
  function loginUser(userId, name) {
    setId(userId);
    setUsername(name);
  }

  return (
    <UserContext.Provider value={{
      username,
      setUsername,
      id,
      setId,
      loginUser,
      loading
    }}>
      {children}
    </UserContext.Provider>
  );
}
