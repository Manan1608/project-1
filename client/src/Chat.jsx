import { useEffect, useState, useRef, useContext } from "react";
import Avatar from "./Avatar.jsx";
import Logo from "./Logo.jsx";
import Contact from "./Contact.jsx";
import { uniqBy } from "lodash";
import axios from "axios";
import { UserContext } from "./UserContext.jsx";
import { useNavigate } from "react-router-dom";

export default function Chat() {
  const [ws, setWs] = useState(null);
  const [onlinePeople, setOnlinePeople] = useState({});
  const [offlinePeople, setOfflinePeople] = useState({});
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [newMessageText, setNewMessageText] = useState("");
  const [messages, setMessages] = useState([]);
  const divUnderMessages = useRef();

  const { id, username, loginUser } = useContext(UserContext);
  const navigate = useNavigate();

  useEffect(() => {
    connectToWs();
  }, []);

  function connectToWs() {
    const wsInstance = new WebSocket("ws://localhost:4000");
    setWs(wsInstance);
    wsInstance.addEventListener("message", handleMessage);
    wsInstance.addEventListener("close", () => {
      setTimeout(() => {
        console.log("Reconnecting...");
        connectToWs();
      }, 1000);
    });
  }

  function handleMessage(ev) {
    const messageData = JSON.parse(ev.data);

    if ("online" in messageData) {
      showOnlinePeople(messageData.online);
    } else if ("text" in messageData) {
      setMessages((prev) => {
        const withoutTemp = prev.filter(
          (m) =>
            !(
              m._id?.startsWith("temp-") &&
              m.sender === messageData.sender &&
              m.text === messageData.text
            )
        );
        return uniqBy([...withoutTemp, messageData], "_id");
      });
    }
  }

  function showOnlinePeople(peopleArray) {
    const people = {};
    peopleArray.forEach(({ userId, username }) => {
      people[userId] = username;
    });
    setOnlinePeople(people);
  }

  function sendMessage(ev, file = null) {
    ev.preventDefault();
    if (!selectedUserId || !newMessageText.trim()) return;

    const tempId = "temp-" + Date.now();

    const message = {
      _id: tempId,
      recipient: selectedUserId,
      text: newMessageText,
      file,
      sender: id,
    };

    // Optimistic UI update
    setMessages((prev) => [...prev, message]);

    ws.send(
      JSON.stringify({
        recipient: selectedUserId,
        text: newMessageText,
        file,
      })
    );

    setNewMessageText("");
  }

  useEffect(() => {
    const div = divUnderMessages.current;
    if (div) {
      div.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  useEffect(() => {
    if (selectedUserId) {
      axios.get("/messages/" + selectedUserId).then((res) => {
        setMessages(res.data);
      });
    }
  }, [selectedUserId]);

  useEffect(() => {
    axios.get("/people").then((res) => {
      const offline = res.data
        .filter((p) => p._id !== id)
        .filter((p) => !Object.keys(onlinePeople).includes(p._id));
      const offlinePeopleObj = {};
      offline.forEach((p) => {
        offlinePeopleObj[p._id] = p;
      });
      setOfflinePeople(offlinePeopleObj);
    });
  }, [onlinePeople, id]);

  // ====== UPDATED logout function ======
  function logout() {
    axios.post("/logout").then(() => {
      if (ws) {
        ws.close();
        setWs(null);
      }
      // Clear user context to logout globally
      loginUser(null, null);
      // Navigate back to login/register page
      navigate("/");
    });
  }

  const onlinePeopleExcludingOurUser = { ...onlinePeople };
  delete onlinePeopleExcludingOurUser[id];

  const messagesWithoutDupes = uniqBy(messages, "_id");

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="bg-white w-1/3 flex flex-col">
        <div className="flex-grow">
          <Logo />
          {Object.keys(onlinePeopleExcludingOurUser).map((userId) => (
            <Contact
              key={userId}
              id={userId}
              online={true}
              username={onlinePeopleExcludingOurUser[userId]}
              onClick={() => setSelectedUserId(userId)}
              selected={userId === selectedUserId}
            />
          ))}
          {Object.keys(offlinePeople).map((userId) => (
            <Contact
              key={userId}
              id={userId}
              online={false}
              username={offlinePeople[userId].username}
              onClick={() => setSelectedUserId(userId)}
              selected={userId === selectedUserId}
            />
          ))}
        </div>
        <div className="p-2 text-center">
          <span className="mr-2">{username}</span>
          <button
            onClick={logout}
            className="bg-blue-100 py-1 px-2 text-sm text-gray-500 border rounded-sm"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-col bg-blue-50 w-2/3 p-2">
        <div className="flex-grow">
          {!selectedUserId && (
            <div className="flex h-full items-center justify-center text-gray-400">
              &larr; Select a person from the sidebar
            </div>
          )}
          {!!selectedUserId && (
            <div className="relative h-full">
              <div className="overflow-y-scroll absolute top-0 left-0 right-0 bottom-2">
                {messagesWithoutDupes.map((message) => (
                  <div
                    key={message._id}
                    className={message.sender === id ? "text-right" : "text-left"}
                  >
                    <div
                      className={
                        "inline-block p-2 my-2 rounded-md text-sm " +
                        (message.sender === id
                          ? "bg-blue-500 text-white"
                          : "bg-white text-gray-500")
                      }
                    >
                      {message.text}
                    </div>
                  </div>
                ))}
                <div ref={divUnderMessages}></div>
              </div>
            </div>
          )}
        </div>

        {/* Input form */}
        {!!selectedUserId && (
          <form className="flex gap-2" onSubmit={sendMessage}>
            <input
              type="text"
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              placeholder="Type your message here"
              className="bg-white border p-2 flex-grow rounded-sm"
            />
            <button type="submit" className="bg-blue-500 p-2 text-white rounded-sm">
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
