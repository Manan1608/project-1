import axios from "axios";
import { UserContextProvider } from "./UserContext";
import Routes from "./Routes";

// Set axios defaults once at module load time
axios.defaults.baseURL = "http://localhost:4000";
axios.defaults.withCredentials = true;

function App() {
  return (
    <UserContextProvider>
      <Routes />
    </UserContextProvider>
  );
}

export default App;
