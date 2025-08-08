import { useState, useContext, useEffect } from "react";
import axios from "axios";
import { UserContext } from "./UserContext.jsx";
import { useNavigate } from "react-router-dom";

export default function RegisterAndLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("register"); // renamed for clarity
  const { loginUser, username: contextUsername } = useContext(UserContext);
  const navigate = useNavigate();

  async function handleSubmit(ev) {
    ev.preventDefault();
    try {
      const { data } = await axios.post(
        mode === "register" ? "/register" : "/login",
        { username, password }
      );

      // Update global context with user info
      loginUser(data.id, data.username);

      // Clear form after successful login/register
      setUsername("");
      setPassword("");
    } catch (err) {
      alert(err.response?.data?.error || "Something went wrong");
    }
  }

  // Navigate to chat page once user is logged in (contextUsername updates)
  useEffect(() => {
    if (contextUsername) {
      navigate("/chat");
    }
  }, [contextUsername, navigate]);

  return (
    <div className="bg-blue-50 h-screen flex items-center">
      <form className="w-64 mx-auto mb-12" onSubmit={handleSubmit}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          type="text"
          placeholder="Username"
          className="block w-full rounded-sm p-2 mb-2 border"
          required
          autoComplete="username"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password"
          className="block w-full rounded-sm p-2 mb-2 border"
          required
          autoComplete={mode === "register" ? "new-password" : "current-password"}
        />
        <button className="bg-blue-500 text-white block w-full rounded-sm p-2">
          {mode === "register" ? "Register" : "Login"}
        </button>

        <div className="text-center mt-2">
          {mode === "register" ? (
            <div>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="underline text-blue-700"
              >
                Login here
              </button>
            </div>
          ) : (
            <div>
              Don’t have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("register")}
                className="underline text-blue-700"
              >
                Register here
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
