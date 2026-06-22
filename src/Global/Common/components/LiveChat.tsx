import { useEffect, useReducer, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import type { ChatMsg } from "../../../types/api";
import API_BASE from "../../../Services/API";

interface LiveChatProps {
  gameId: string;
  program: string;
  sessionToken: string | null; // null = free game viewer
  displayName: string;         // pre-set for key holders; empty for free viewers
  isModerator?: boolean;
  initialGuestName?: string;
}

interface LocalMsg extends ChatMsg {
  _localId?: string;
  _pending?: boolean;
}

interface State {
  messages: LocalMsg[];
  input: string;
  connected: boolean;
  guestName: string;
  guestNameSet: boolean;
}

type Action =
  | { type: "SET_HISTORY"; msgs: ChatMsg[] }
  | { type: "ADD_MSG"; msg: LocalMsg }
  | { type: "CONFIRM_MSG"; localId: string; confirmed: ChatMsg }
  | { type: "SET_INPUT"; value: string }
  | { type: "SET_CONNECTED"; value: boolean }
  | { type: "SET_GUEST_NAME"; value: string }
  | { type: "CONFIRM_GUEST_NAME" }
  | { type: "REMOVE_MSG"; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_HISTORY":
      return { ...state, messages: action.msgs };
    case "ADD_MSG":
      return { ...state, messages: [...state.messages, action.msg] };
    case "CONFIRM_MSG":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m._localId === action.localId
            ? { ...action.confirmed, _pending: false }
            : m
        ),
      };
    case "SET_INPUT":
      return { ...state, input: action.value };
    case "SET_CONNECTED":
      return { ...state, connected: action.value };
    case "SET_GUEST_NAME":
      return { ...state, guestName: action.value };
    case "CONFIRM_GUEST_NAME":
      return { ...state, guestNameSet: state.guestName.trim().length > 0 };
    case "REMOVE_MSG":
      return { ...state, messages: state.messages.filter((m) => m.id !== action.id) };
    default:
      return state;
  }
}

const _base = (API_BASE || "").replace(/\/+$/, "");
const WS_URL = `${_base}/ws`;
const BASE_URL = `${_base}/api/stream`;

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function LiveChat({
  gameId,
  program,
  sessionToken,
  displayName,
  isModerator = false,
  initialGuestName = "",
}: LiveChatProps) {
  const trimmedGuest = initialGuestName.trim();
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    messages: [],
    input: "",
    connected: false,
    guestName: initialGuestName,
    guestNameSet: trimmedGuest.length > 0,
  }));
  const { messages, input, connected, guestName, guestNameSet } = state;

  const clientRef = useRef<Client | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Maps `${displayName}:${message}` → localId for optimistic dedup
  const pendingMapRef = useRef<Map<string, string>>(new Map());

  const myName = sessionToken ? displayName : guestName;
  const canChat = !!sessionToken || (guestNameSet && !!guestName.trim());

  // Load history
  useEffect(() => {
    fetch(`${BASE_URL}/chat/${gameId}`, { headers: { "X-Program": program } })
      .then((r) => r.json())
      .then((msgs: ChatMsg[]) => dispatch({ type: "SET_HISTORY", msgs }))
      .catch(() => {});
  }, [gameId, program]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // WebSocket
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      onConnect: () => {
        dispatch({ type: "SET_CONNECTED", value: true });
        client.subscribe(`/topic/chat/${program}/${gameId}`, (frame) => {
          const msg: ChatMsg = JSON.parse(frame.body);
          const key = `${msg.displayName}:${msg.message}`;
          if (pendingMapRef.current.has(key)) {
            const localId = pendingMapRef.current.get(key)!;
            pendingMapRef.current.delete(key);
            dispatch({ type: "CONFIRM_MSG", localId, confirmed: msg });
          } else {
            dispatch({ type: "ADD_MSG", msg });
          }
        });
      },
      onDisconnect: () => dispatch({ type: "SET_CONNECTED", value: false }),
    });
    client.activate();
    clientRef.current = client;
    return () => { client.deactivate(); };
  }, [gameId, program]);

  const send = () => {
    const msg = input.trim();
    if (!msg || !myName || !clientRef.current?.connected) return;

    const localId = `local-${Date.now()}`;
    pendingMapRef.current.set(`${myName.trim()}:${msg}`, localId);

    dispatch({
      type: "ADD_MSG",
      msg: {
        id: localId,
        displayName: myName,
        message: msg,
        createdAt: new Date().toISOString(),
        _localId: localId,
        _pending: true,
      },
    });

    clientRef.current.publish({
      destination: `/app/chat/${program}/${gameId}`,
      body: sessionToken
        ? JSON.stringify({ sessionToken, message: msg })
        : JSON.stringify({ displayName: myName, message: msg }),
    });

    dispatch({ type: "SET_INPUT", value: "" });
  };

  const deleteMessage = async (id: string) => {
    if (!isModerator || !id || id.startsWith("local-")) return;
    try {
      const res = await fetch(`${BASE_URL}/chat/${id}`, {
        method: "DELETE",
        headers: { "X-Program": program },
      });
      if (!res.ok) return;
      dispatch({ type: "REMOVE_MSG", id });
    } catch {
      // ignore
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex flex-col h-full border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-[#5E0009] text-white px-3 py-2 text-sm font-semibold flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-gray-400"}`} />
        Live Chat
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50" style={{ minHeight: 0 }}>
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-4">No messages yet. Say hi!</p>
        )}
        {messages.map((m) => {
          const isMine = !!myName && m.displayName === myName;
          return (
            <div key={m._localId ?? m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMine ? "items-end" : "items-start"}`}>
                {!isMine && (
                  <span className="text-xs text-gray-500 px-1">{m.displayName}</span>
                )}
                <div
                  className={`rounded-2xl px-3 py-2 text-sm wrap-break-word leading-snug ${
                    isMine
                      ? "bg-[#5E0009] text-white rounded-tr-sm"
                      : "bg-white text-gray-900 border border-gray-200 rounded-tl-sm"
                  }`}
                >
                  {m.message}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 px-1">{formatTime(m.createdAt)}</span>
                  {isModerator && !m._localId && m.id && (
                    <button
                      type="button"
                      onClick={() => deleteMessage(m.id)}
                      className="text-[11px] text-gray-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {!canChat ? (
        /* Guest name setup */
        <div className="border-t border-gray-200 bg-white p-3 space-y-2">
          <p className="text-xs text-gray-500 text-center">Choose a name to join the chat</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={guestName}
              onChange={(e) => dispatch({ type: "SET_GUEST_NAME", value: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && dispatch({ type: "CONFIRM_GUEST_NAME" })}
              maxLength={30}
              placeholder="Your name…"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={() => dispatch({ type: "CONFIRM_GUEST_NAME" })}
              disabled={!guestName.trim()}
              className="px-3 py-2 text-sm bg-[#5E0009] text-white rounded disabled:opacity-40"
            >
              Join
            </button>
          </div>
        </div>
      ) : (
        <div className="flex border-t border-gray-200 bg-white items-center gap-1 px-2 py-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => dispatch({ type: "SET_INPUT", value: e.target.value })}
            onKeyDown={onKey}
            maxLength={300}
            placeholder={`Message as ${myName}…`}
            className="flex-1 px-2 py-1.5 text-sm outline-none"
          />
          <button
            onClick={send}
            disabled={!input.trim() || !connected}
            className="px-3 py-1.5 text-sm bg-[#5E0009] text-white rounded-full disabled:opacity-40 shrink-0"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
