import { useEffect, useReducer, useRef, useCallback } from "react";
import { apiRequest } from "../../../../Services/API";
import toast from "react-hot-toast";
import {
  Bold, Italic, Underline, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight,
  Link2, Link2Off, RotateCcw, Trash2,
  Plus, Send, ChevronRight, ChevronDown,
  Search, X, Mail, Users, UserMinus,
} from "lucide-react";

type Group = { id: string; name: string; members: string[] };
type ApiUser = { email?: string | null; roles?: Record<string, string> };

type State = {
  groups: Group[];
  selectedGroupId: string;
  expandedGroupId: string;
  subject: string;
  newGroupName: string;
  newEmail: string;
  sending: boolean;
  searchTerm: string;
  selectedEmails: string[];
  addingGroup: boolean;
  showConfirm: boolean;
  importRole: string;
  importing: boolean;
};

type Action =
  | { type: "SET_FIELD"; field: keyof State; value: unknown }
  | { type: "SET_GROUPS"; groups: Group[] }
  | { type: "ADD_GROUP"; group: Group }
  | { type: "UPDATE_GROUP"; id: string; updates: Partial<Group> }
  | { type: "DELETE_GROUP"; id: string };

const initialState: State = {
  groups: [],
  selectedGroupId: "",
  expandedGroupId: "",
  subject: "",
  newGroupName: "",
  newEmail: "",
  sending: false,
  searchTerm: "",
  selectedEmails: [],
  addingGroup: false,
  showConfirm: false,
  importRole: "alumni",
  importing: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_GROUPS":
      return { ...state, groups: action.groups };
    case "ADD_GROUP":
      return { ...state, groups: [...state.groups, action.group] };
    case "UPDATE_GROUP":
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.id ? { ...g, ...action.updates } : g
        ),
      };
    case "DELETE_GROUP":
      return {
        ...state,
        groups: state.groups.filter((g) => g.id !== action.id),
        selectedGroupId:
          state.selectedGroupId === action.id ? "" : state.selectedGroupId,
        expandedGroupId:
          state.expandedGroupId === action.id ? "" : state.expandedGroupId,
      };
    default:
      return state;
  }
}

function ToolbarBtn({
  onAction,
  title,
  children,
}: {
  onAction: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onAction();
      }}
      title={title}
      className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
    >
      {children}
    </button>
  );
}

export default function EmailCenter() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    groups,
    selectedGroupId,
    expandedGroupId,
    subject,
    newGroupName,
    newEmail,
    sending,
    searchTerm,
    selectedEmails,
    addingGroup,
    showConfirm,
    importRole,
    importing,
  } = state;

  const editorRef = useRef<HTMLDivElement>(null);
  const set = (field: keyof State, value: unknown) =>
    dispatch({ type: "SET_FIELD", field, value });

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;
  const expandedGroup = groups.find((g) => g.id === expandedGroupId) ?? null;
  const filteredMembers = expandedGroup
    ? expandedGroup.members.filter((e) =>
        e.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  // Rich text commands
  const execCmd = useCallback((cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  }, []);

  const insertLink = () => {
    const url = prompt("Enter URL (include https://):");
    if (url) execCmd("createLink", url);
  };

  const formatBlock = (tag: string) => {
    document.execCommand("formatBlock", false, tag);
    editorRef.current?.focus();
  };

  // Data
  useEffect(() => {
    apiRequest("/api/groups")
      .then((list) => dispatch({ type: "SET_GROUPS", groups: list }))
      .catch(() => toast.error("Failed to load groups"));
  }, []);

  // Handlers
  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const group = await apiRequest("/api/groups", {
        method: "POST",
        json: { name: newGroupName, members: [] },
      });
      dispatch({ type: "ADD_GROUP", group });
      set("newGroupName", "");
      set("addingGroup", false);
      toast.success(`Group "${group.name}" created`);
    } catch {
      toast.error("Failed to create group");
    }
  };

  const handleAddEmail = async () => {
    if (!expandedGroupId || !newEmail.trim()) return;
    const group = groups.find((g) => g.id === expandedGroupId)!;
    const updated = [...(group.members || []), newEmail.trim()];
    try {
      await apiRequest(`/api/groups/${expandedGroupId}`, {
        method: "PUT",
        json: { members: updated },
      });
      dispatch({ type: "UPDATE_GROUP", id: expandedGroupId, updates: { members: updated } });
      set("newEmail", "");
      toast.success("Email added");
    } catch {
      toast.error("Failed to add email");
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      await apiRequest(`/api/groups/${id}`, { method: "DELETE" });
      dispatch({ type: "DELETE_GROUP", id });
      toast.success("Group deleted");
    } catch {
      toast.error("Failed to delete group");
    }
  };

  const handleImportFromRole = async () => {
    if (!expandedGroupId || !importRole) return;
    set("importing", true);
    try {
      const users = await apiRequest<ApiUser[]>("/api/users");
      const emails = users
        .filter((u) => {
          const role = u.roles?.women || u.roles?.men;
          return role === importRole && u.email;
        })
        .map((u) => u.email!.trim().toLowerCase());
      if (!emails.length) { toast.error(`No ${importRole} users with emails found`); return; }
      const group = groups.find((g) => g.id === expandedGroupId)!;
      const merged = Array.from(new Set([...(group.members || []), ...emails]));
      await apiRequest(`/api/groups/${expandedGroupId}`, {
        method: "PUT",
        json: { members: merged },
      });
      dispatch({ type: "UPDATE_GROUP", id: expandedGroupId, updates: { members: merged } });
      const added = merged.length - (group.members?.length ?? 0);
      toast.success(`Added ${added} ${importRole}${added !== 1 ? "s" : ""} (${merged.length} total)`);
    } catch {
      toast.error("Failed to import");
    } finally {
      set("importing", false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!expandedGroupId) return;
    const group = groups.find((g) => g.id === expandedGroupId)!;
    const updated = group.members.filter((m) => !selectedEmails.includes(m));
    try {
      await apiRequest(`/api/groups/${expandedGroupId}`, {
        method: "PUT",
        json: { members: updated },
      });
      dispatch({ type: "UPDATE_GROUP", id: expandedGroupId, updates: { members: updated } });
      set("selectedEmails", []);
      toast.success(`Removed ${selectedEmails.length} member(s)`);
    } catch {
      toast.error("Failed to remove members");
    }
  };

  const handleSend = async () => {
    if (!selectedGroup) return toast.error("Select a recipient group");
    if (!selectedGroup.members.length)
      return toast.error("This group has no members");
    if (!subject.trim()) return toast.error("Subject is required");
    const bodyHtml = editorRef.current?.innerHTML ?? "";
    if (!bodyHtml || editorRef.current?.textContent?.trim() === "")
      return toast.error("Email body cannot be empty");

    set("sending", true);
    set("showConfirm", false);
    try {
      await apiRequest("/api/email/group", {
        method: "POST",
        json: { recipients: selectedGroup.members, subject, body: bodyHtml },
      });
      toast.success(
        `Sent to "${selectedGroup.name}" (${selectedGroup.members.length} recipients)`
      );
      set("subject", "");
      if (editorRef.current) editorRef.current.innerHTML = "";
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      set("sending", false);
    }
  };

  // Render
  return (
    <div
      className="flex bg-gray-50 rounded-lg shadow-lg overflow-hidden border border-gray-200"
      style={{ minHeight: "640px" }}
    >
      {/* LEFT PANEL: Group Management */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-gray-500" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-widest">
              Groups
            </span>
          </div>
          <button
            onClick={() => set("addingGroup", !addingGroup)}
            title="New Group"
            className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
          >
            <Plus size={15} />
          </button>
        </div>

        {/* New group input */}
        {addingGroup && (
          <div className="px-3 py-2 bg-blue-50 border-b border-blue-100">
            <div className="flex gap-1">
              <input
                autoFocus
                type="text"
                placeholder="Group name..."
                value={newGroupName}
                onChange={(e) => set("newGroupName", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
                className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                onClick={handleAddGroup}
                className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded hover:bg-blue-700"
              >
                Add
              </button>
              <button
                onClick={() => {
                  set("addingGroup", false);
                  set("newGroupName", "");
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Group list */}
        <div className="flex-1 overflow-y-auto">
          {groups.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-400">
              <Mail size={28} className="mx-auto mb-2 opacity-25" />
              <p>No groups yet.</p>
              <p className="text-xs mt-1">Click + to create one.</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.id} className="border-b border-gray-100">
                {/* Group row */}
                <div
                  onClick={() => set("selectedGroupId", group.id)}
                  className={`flex items-center px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedGroupId === group.id
                      ? "bg-[#5E0009]/8 border-l-[3px] border-[#5E0009]"
                      : "border-l-[3px] border-transparent"
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      set(
                        "expandedGroupId",
                        expandedGroupId === group.id ? "" : group.id
                      );
                      set("searchTerm", "");
                      set("selectedEmails", []);
                    }}
                    className="p-0.5 mr-1 text-gray-400 hover:text-gray-700 shrink-0"
                  >
                    {expandedGroupId === group.id ? (
                      <ChevronDown size={13} />
                    ) : (
                      <ChevronRight size={13} />
                    )}
                  </button>
                  <Mail
                    size={13}
                    className={`mr-2 shrink-0 ${
                      selectedGroupId === group.id
                        ? "text-[#5E0009]"
                        : "text-gray-400"
                    }`}
                  />
                  <span
                    className={`flex-1 text-sm truncate ${
                      selectedGroupId === group.id
                        ? "font-semibold text-[#5E0009]"
                        : "text-gray-700"
                    }`}
                  >
                    {group.name}
                  </span>
                  <span className="ml-1 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">
                    {group.members?.length ?? 0}
                  </span>
                </div>

                {/* Expanded member panel */}
                {expandedGroupId === group.id && (
                  <div className="bg-gray-50 border-t border-gray-100 px-3 py-2.5 space-y-2">
                    {/* Add email */}
                    <div className="flex gap-1">
                      <input
                        type="email"
                        placeholder="Add email..."
                        value={newEmail}
                        onChange={(e) => set("newEmail", e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
                        className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-400"
                      />
                      <button
                        onClick={handleAddEmail}
                        className="text-xs bg-green-600 text-white px-2.5 py-1 rounded hover:bg-green-700 font-medium"
                      >
                        Add
                      </button>
                    </div>

                    {/* Import from role */}
                    <div className="flex gap-1">
                      <select
                        value={importRole}
                        onChange={(e) => set("importRole", e.target.value)}
                        className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none"
                      >
                        <option value="alumni">Alumni</option>
                        <option value="player">Players</option>
                        <option value="parent">Parents</option>
                        <option value="coach">Coaches</option>
                        <option value="admin">Admins</option>
                      </select>
                      <button
                        onClick={handleImportFromRole}
                        disabled={importing}
                        className="text-xs bg-[#5E0009] text-white px-2.5 py-1 rounded hover:bg-[#7a0012] disabled:opacity-50 whitespace-nowrap font-medium"
                      >
                        {importing ? "…" : "Import"}
                      </button>
                    </div>

                    {/* Search (only shown when worth it) */}
                    {group.members.length > 5 && (
                      <div className="relative">
                        <Search
                          size={10}
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="text"
                          placeholder="Search members..."
                          value={searchTerm}
                          onChange={(e) => set("searchTerm", e.target.value)}
                          className="w-full text-xs border border-gray-300 rounded pl-6 pr-2 py-1 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Members list */}
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      {filteredMembers.length > 0 ? (
                        filteredMembers.map((email, idx) => (
                          <label
                            key={idx}
                            className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-white cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedEmails.includes(email)}
                              onChange={() =>
                                set(
                                  "selectedEmails",
                                  selectedEmails.includes(email)
                                    ? selectedEmails.filter((e) => e !== email)
                                    : [...selectedEmails, email]
                                )
                              }
                              className="w-3 h-3 accent-[#5E0009]"
                            />
                            <span className="text-xs text-gray-600 truncate">
                              {email}
                            </span>
                          </label>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 py-1 px-1">
                          No members yet
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                      {selectedEmails.length > 0 ? (
                        <button
                          onClick={handleDeleteSelected}
                          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                        >
                          <UserMinus size={11} />
                          Remove {selectedEmails.length}
                        </button>
                      ) : (
                        <span />
                      )}
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 ml-auto"
                      >
                        <Trash2 size={11} />
                        Delete Group
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Compose */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Compose header */}
        <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-3">
          <Mail size={18} className="text-[#5E0009] shrink-0" />
          <h2 className="text-base font-semibold text-gray-800">
            Email Center — Women's Program
          </h2>
        </div>

        {/* To / Subject */}
        <div className="bg-white border-b border-gray-200">
          {/* To field */}
          <div className="flex items-center px-6 py-2.5 border-b border-gray-100 min-h-[42px]">
            <span className="w-16 text-sm font-medium text-gray-400 shrink-0">
              To:
            </span>
            {selectedGroup ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-[#5E0009]/10 text-[#5E0009] text-sm px-2.5 py-0.5 rounded-full font-medium">
                  <Users size={12} />
                  {selectedGroup.name}
                  <span className="bg-[#5E0009] text-white text-xs px-1.5 rounded-full leading-5">
                    {selectedGroup.members.length}
                  </span>
                </span>
                <button
                  onClick={() => set("selectedGroupId", "")}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <span className="text-sm text-gray-400 italic">
                ← Select a group from the left panel
              </span>
            )}
          </div>

          {/* Subject field */}
          <div className="flex items-center px-6 py-2.5">
            <span className="w-16 text-sm font-medium text-gray-400 shrink-0">
              Subject:
            </span>
            <input
              type="text"
              placeholder="Enter email subject..."
              value={subject}
              onChange={(e) => set("subject", e.target.value)}
              className="flex-1 text-sm focus:outline-none text-gray-800 placeholder-gray-300 bg-transparent"
            />
          </div>
        </div>

        {/* Formatting toolbar */}
        <div className="bg-gray-50 border-b border-gray-200 px-3 py-1.5 flex items-center gap-0.5 flex-wrap">
          <ToolbarBtn onAction={() => execCmd("bold")} title="Bold (Ctrl+B)">
            <Bold size={13} />
          </ToolbarBtn>
          <ToolbarBtn onAction={() => execCmd("italic")} title="Italic (Ctrl+I)">
            <Italic size={13} />
          </ToolbarBtn>
          <ToolbarBtn onAction={() => execCmd("underline")} title="Underline (Ctrl+U)">
            <Underline size={13} />
          </ToolbarBtn>

          <div className="w-px h-4 bg-gray-300 mx-1" />

          <ToolbarBtn onAction={() => execCmd("insertUnorderedList")} title="Bullet List">
            <List size={13} />
          </ToolbarBtn>
          <ToolbarBtn onAction={() => execCmd("insertOrderedList")} title="Numbered List">
            <ListOrdered size={13} />
          </ToolbarBtn>

          <div className="w-px h-4 bg-gray-300 mx-1" />

          <ToolbarBtn onAction={() => execCmd("justifyLeft")} title="Align Left">
            <AlignLeft size={13} />
          </ToolbarBtn>
          <ToolbarBtn onAction={() => execCmd("justifyCenter")} title="Align Center">
            <AlignCenter size={13} />
          </ToolbarBtn>
          <ToolbarBtn onAction={() => execCmd("justifyRight")} title="Align Right">
            <AlignRight size={13} />
          </ToolbarBtn>

          <div className="w-px h-4 bg-gray-300 mx-1" />

          <ToolbarBtn onAction={insertLink} title="Insert Link">
            <Link2 size={13} />
          </ToolbarBtn>
          <ToolbarBtn onAction={() => execCmd("unlink")} title="Remove Link">
            <Link2Off size={13} />
          </ToolbarBtn>

          <div className="w-px h-4 bg-gray-300 mx-1" />

          {/* Block format select */}
          <select
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              formatBlock(e.target.value);
              e.target.value = "p";
            }}
            defaultValue="p"
            className="text-xs border border-gray-300 rounded px-1.5 py-0.5 bg-white focus:outline-none cursor-pointer text-gray-600"
          >
            <option value="p">Normal</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>

          <div className="w-px h-4 bg-gray-300 mx-1" />

          <ToolbarBtn onAction={() => execCmd("removeFormat")} title="Clear Formatting">
            <RotateCcw size={13} />
          </ToolbarBtn>
        </div>

        {/* Editor area */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="h-full min-h-[280px] px-8 py-5 text-sm text-gray-800 leading-relaxed focus:outline-none"
            onFocus={(e) => {
              if (
                e.currentTarget.innerHTML === "" ||
                e.currentTarget.innerHTML === "<br>"
              ) {
                e.currentTarget.innerHTML = "";
              }
            }}
          />
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {selectedGroup
              ? `${selectedGroup.members.length} recipient(s) in "${selectedGroup.name}"`
              : "No group selected"}
          </span>
          <button
            onClick={() => set("showConfirm", true)}
            disabled={sending || !selectedGroup}
            className={`flex items-center gap-2 px-5 py-2 rounded text-sm font-medium text-white transition-colors shadow-sm ${
              sending || !selectedGroup
                ? "bg-gray-300 cursor-not-allowed shadow-none"
                : "bg-[#5E0009] hover:bg-[#7a0010]"
            }`}
          >
            <Send size={13} />
            {sending ? "Sending..." : "Send Email"}
          </button>
        </div>
      </div>

      {/* Send Confirmation Dialog */}
      {showConfirm && selectedGroup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-3">
              Confirm Send
            </h3>
            <div className="space-y-1 mb-5 text-sm text-gray-600">
              <p>
                Subject:{" "}
                <strong className="text-gray-800">
                  {subject || "(no subject)"}
                </strong>
              </p>
              <p>
                Recipients:{" "}
                <strong className="text-[#5E0009]">
                  {selectedGroup.name} ({selectedGroup.members.length}{" "}
                  {selectedGroup.members.length === 1 ? "person" : "people"})
                </strong>
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => set("showConfirm", false)}
                className="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-[#5E0009] text-white hover:bg-[#7a0010]"
              >
                <Send size={13} />
                Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
