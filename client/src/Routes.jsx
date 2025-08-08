import RegisterAndLoginForm from "./RegisterAndLoginForm.jsx";
import { useContext } from "react";
import { UserContext } from "./UserContext.jsx";
import Chat from "./Chat";

export default function Routes() {
  const { username, loading } = useContext(UserContext);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-gray-500 text-lg">Loading...</p>
      </div>
    );
  }

  return username && username.trim() !== "" ? <Chat /> : <RegisterAndLoginForm />;
}
