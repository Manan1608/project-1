import { useContext, useState } from "react";
import axios from "axios";
import { UserContext } from "./UserContext.jsx";

export default function RegisterAndLoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginOrRegister, setIsLoginOrRegister] = useState('http://locahost:3000');
  const { setUsername: setLoggedInUsername, setId } = useContext(UserContext);

  async function handleSubmit(ev) {
  ev.preventDefault();
  const url = isLoginOrRegister === 'register' ? 'register' : 'login';
  try {
    const { data } = await axios.post(url, { username, password });
    setLoggedInUsername(username);
    setId(data.id);
    alert(`Success! Logged in as ${username} (ID: ${data.id})`);
  } catch (error) {
    console.error(error);
    alert(error.response?.data?.error || "Login/Registration failed");
  }
}



  return (
    <div className="bg-blue-50 h-screen flex items-center">
      <form className="w-64 mx-auto mb-12" onSubmit={handleSubmit}>
        <input
          value={username}
          onChange={ev => setUsername(ev.target.value)}
          type="text"
          placeholder="username"
          className="block w-full rounded-sm p-2 mb-2 border"
        />
        <input
          value={password}
          onChange={ev => setPassword(ev.target.value)}
          type="password"
          placeholder="password"
          className="block w-full rounded-sm p-2 mb-2 border"
        />
        <button className="bg-blue-500 text-white block w-full rounded-sm p-2">
          {isLoginOrRegister === 'register' ? 'Register' : 'Login'}
        </button>
        <div className="text-center mt-2">
          {isLoginOrRegister === 'register' ? (
            <div>
              Already a member?
              <button type="button" className="ml-1 text-blue-500" onClick={() => setIsLoginOrRegister('login')}>
                Login here
              </button>
            </div>
          ) : (
            <div>
              Don't have an account?
              <button type="button" className="ml-1 text-blue-500" onClick={() => setIsLoginOrRegister('register')}>
                Register
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
