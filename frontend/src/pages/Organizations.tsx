import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

type OrganizationRole = "owner" | "admin" | "member";
type JoinRequestStatus = "pending" | "approved" | "rejected" | "cancelled" | null;
type PageTab = "create" | "search" | "mine";
type SearchRequestStatus = "all" | "none" | "pending" | "rejected" | "cancelled";
type SearchSortBy = "created_at" | "name";
type SearchOrder = "asc" | "desc";

type OrganizationItem = {
  id: number;
  name: string;
  description: string | null;
  owner: { id: number; username: string };
  totalMembers: number;
  createdAt?: string;
  viewer: {
    isMember: boolean;
    role: OrganizationRole | null;
    requestStatus: JoinRequestStatus;
    canApply: boolean;
    canManage: boolean;
    canReviewRequests: boolean;
  };
};

type MemberItem = {
  userId: number;
  username: string;
  role: OrganizationRole;
  joinedAt?: string;
};

type RequestItem = {
  userId: number;
  username: string;
  status: JoinRequestStatus;
  createdAt: string;
  updatedAt: string;
};

type OrganizationChatMessage = {
  id: number;
  author: {
    id: number;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  content: string;
  createdAt: string;
};

type OrganizationDetail = {
  organization: OrganizationItem;
  members: MemberItem[];
  requests: RequestItem[];
};

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function Organizations() {
  const { token, user } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PageTab>("mine");
  const [myOrganizations, setMyOrganizations] = useState<OrganizationItem[]>([]);
  const [searchResults, setSearchResults] = useState<OrganizationItem[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchPage, setSearchPage] = useState(0);
  const [searchLimit, setSearchLimit] = useState(4);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState<SearchRequestStatus>("all");
  const [searchSortBy, setSearchSortBy] = useState<SearchSortBy>("created_at");
  const [searchOrder, setSearchOrder] = useState<SearchOrder>("asc");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OrganizationDetail | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [showEditForm, setShowEditForm] = useState(false);
  const [openMemberMenuId, setOpenMemberMenuId] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<OrganizationChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedOrganization = detail?.organization ?? null;
  const viewer = selectedOrganization?.viewer ?? null;

  const canEditOrganization = viewer?.canManage ?? false;
  const canManageMembers = viewer?.canManage ?? false;
  const canChangeRoles = viewer?.role === "owner";
  const canReviewRequests = viewer?.canReviewRequests ?? false;

  const searchSummary = useMemo(() => {
    if (searchTotal === 0) return t("ORG_SEARCH_SUMMARY_EMPTY");
    const start = searchPage * searchLimit + 1;
    const end = Math.min(searchPage * searchLimit + searchResults.length, searchTotal);
    return t("ORG_SEARCH_SUMMARY", { start, end, total: searchTotal });
  }, [searchLimit, searchPage, searchResults.length, searchTotal, t]);

  function getRoleLabel(role: OrganizationRole | null | undefined): string {
    if (role === "owner") return t("ORG_ROLE_OWNER");
    if (role === "admin") return t("ORG_ROLE_ADMIN");
    if (role === "member") return t("ORG_ROLE_MEMBER");
    return t("ORG_NO_ACCESS");
  }

  function getRequestStatusLabel(status: JoinRequestStatus): string {
    if (status === "pending") return t("ORG_REQUEST_PENDING");
    if (status === "approved") return t("ORG_REQUEST_APPROVED");
    if (status === "rejected") return t("ORG_REQUEST_REJECTED");
    if (status === "cancelled") return t("ORG_REQUEST_CANCELLED");
    return t("ORG_REQUEST_NONE");
  }

  async function loadSearchResultsWithQuery(
    queryText: string,
    nextPage = 0,
    overrides?: {
      ownerFilter?: string;
      requestStatusFilter?: SearchRequestStatus;
      searchSortBy?: SearchSortBy;
      searchOrder?: SearchOrder;
    }
  ) {
    if (!token || !user?.id) return;
    const nextOwnerFilter = overrides?.ownerFilter ?? ownerFilter;
    const nextRequestStatusFilter = overrides?.requestStatusFilter ?? requestStatusFilter;
    const nextSearchSortBy = overrides?.searchSortBy ?? searchSortBy;
    const nextSearchOrder = overrides?.searchOrder ?? searchOrder;

    const params = new URLSearchParams({
      limit: String(searchLimit),
      offset: String(nextPage * searchLimit),
      sortBy: nextSearchSortBy,
      order: nextSearchOrder,
      excludeMemberId: String(user.id),
    });
    if (queryText.trim()) params.set("q", queryText.trim());
    if (nextOwnerFilter.trim()) params.set("ownerUsername", nextOwnerFilter.trim());
    if (nextRequestStatusFilter !== "all") params.set("requestStatus", nextRequestStatusFilter);

    const response = await fetch(`${API}/api/organizations?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "No se pudieron cargar los resultados");

    setSearchResults(json.items ?? []);
    setSearchTotal(json.total ?? 0);
    setSearchPage(nextPage);
  }

  async function loadSearchResults(nextPage = searchPage) {
    await loadSearchResultsWithQuery(searchQuery, nextPage);
  }

  async function loadMyOrganizations() {
    if (!token || !user?.id) return;

    const params = new URLSearchParams({
      memberId: String(user.id),
      limit: "100",
      offset: "0",
      order: "desc",
    });

    const response = await fetch(`${API}/api/organizations?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "No se pudieron cargar tus organizaciones");

    setMyOrganizations(json.items ?? []);
  }

  async function loadOrganizationDetail(organizationId: number) {
    if (!token) return;

    const response = await fetch(`${API}/api/organizations/${organizationId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "No se pudo cargar la organizacion");

    setDetail(json);
    setEditName(json.organization?.name ?? "");
    setEditDescription(json.organization?.description ?? "");
  }

  function clearOrganizationDetail() {
    setSelectedOrganizationId(null);
    setDetail(null);
    setShowEditForm(false);
    setOpenMemberMenuId(null);
    setChatMessages([]);
    setChatDraft("");
  }

  function switchTab(nextTab: PageTab) {
    setActiveTab(nextTab);
    clearOrganizationDetail();
  }

  function openOrganizationDetail(organizationId: number) {
    setSelectedOrganizationId(organizationId);
    setDetail(null);
    setShowEditForm(false);
    setOpenMemberMenuId(null);
  }

  function canOpenMemberMenu(member: MemberItem): boolean {
    if (!viewer?.role || member.role === "owner") return false;
    if (viewer.role === "owner") return true;
    return viewer.role === "admin" && member.role === "member";
  }

  useEffect(() => {
    loadMyOrganizations().catch((error) => {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("CONNECTION_ERROR") });
    });
  }, [token, user?.id, t]);

  useEffect(() => {
    if (activeTab !== "mine") return;
    loadMyOrganizations().catch((error) => {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("CONNECTION_ERROR") });
    });
  }, [activeTab, token, user?.id, t]);

  useEffect(() => {
    if (!selectedOrganizationId || activeTab === "create") return;
    loadOrganizationDetail(selectedOrganizationId).catch((error) => {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("CONNECTION_ERROR") });
    });
  }, [selectedOrganizationId, activeTab, token, t]);

  useEffect(() => {
    if (!token || !selectedOrganizationId || !viewer?.isMember) return;

    let cancelled = false;

    const loadChatMessages = async () => {
      try {
        const response = await fetch(`${API}/api/organizations/${selectedOrganizationId}/messages?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "No se pudo cargar el chat");
        if (!cancelled) {
          setChatMessages(json.messages ?? []);
        }
      } catch (_error) {
        if (!cancelled) {
          setChatMessages([]);
        }
      }
    };

    void loadChatMessages();
    const interval = window.setInterval(() => {
      void loadChatMessages();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedOrganizationId, token, viewer?.isMember]);

  useEffect(() => {
    if (activeTab !== "search" || selectedOrganizationId) return;
    loadSearchResults(0).catch((error) => {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("CONNECTION_ERROR") });
    });
  }, [activeTab, selectedOrganizationId, token, user?.id, searchLimit, ownerFilter, requestStatusFilter, searchSortBy, searchOrder, searchQuery, t]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!token) return;

    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/organizations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo crear la organizacion");

      setName("");
      setDescription("");
      await loadMyOrganizations();
      clearOrganizationDetail();
      setActiveTab("mine");
      setMessage({ type: "success", text: t("ORG_CREATE_SUCCESS") });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("CONNECTION_ERROR") });
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyToOrganization(organizationId: number) {
    if (!token) return;

    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/organizations/${organizationId}/apply`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo enviar la solicitud");

      await loadSearchResults(searchPage);
      if (selectedOrganizationId === organizationId) {
        await loadOrganizationDetail(organizationId);
      }
      setMessage({ type: "success", text: t("ORG_APPLY_SUCCESS") });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("CONNECTION_ERROR") });
    } finally {
      setLoading(false);
    }
  }

  async function handleLeaveOrganization() {
    if (!token || !selectedOrganization || !viewer?.isMember) return;
    if (!window.confirm(t("ORG_LEAVE_CONFIRM"))) return;

    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/organizations/${selectedOrganization.id}/leave`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo salir de la organizacion");

      await loadMyOrganizations();
      await loadSearchResults(searchPage).catch(() => undefined);
      clearOrganizationDetail();
      setMessage({ type: "success", text: json.message || t("ORG_LEAVE_SUCCESS") });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("CONNECTION_ERROR") });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateOrganization(event: FormEvent) {
    event.preventDefault();
    if (!token || !selectedOrganizationId) return;

    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/organizations/${selectedOrganizationId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || undefined,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo actualizar la organizacion");

      await loadMyOrganizations();
      await loadSearchResults(searchPage).catch(() => undefined);
      await loadOrganizationDetail(selectedOrganizationId);
      setShowEditForm(false);
      setMessage({ type: "success", text: t("ORG_UPDATE_SUCCESS") });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("CONNECTION_ERROR") });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateMemberRole(member: MemberItem, role: "admin" | "member") {
    if (!token || !selectedOrganizationId) return;

    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/organizations/${selectedOrganizationId}/members/${member.userId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo actualizar el rol");

      setOpenMemberMenuId(null);
      await loadMyOrganizations();
      await loadSearchResults(searchPage).catch(() => undefined);
      await loadOrganizationDetail(selectedOrganizationId);
      setMessage({ type: "success", text: t("ORG_ROLE_UPDATED", { username: member.username }) });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("CONNECTION_ERROR") });
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveMember(member: MemberItem) {
    if (!token || !selectedOrganizationId) return;
    if (!window.confirm(t("ORG_REMOVE_MEMBER_CONFIRM", { username: member.username }))) return;

    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/organizations/${selectedOrganizationId}/members/${member.userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo eliminar el miembro");

      setOpenMemberMenuId(null);
      await loadMyOrganizations();
      await loadSearchResults(searchPage).catch(() => undefined);
      await loadOrganizationDetail(selectedOrganizationId);
      setMessage({ type: "success", text: t("ORG_MEMBER_REMOVED") });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("CONNECTION_ERROR") });
    } finally {
      setLoading(false);
    }
  }

  async function handleReviewRequest(requestItem: RequestItem, action: "approve" | "reject") {
    if (!token || !selectedOrganizationId) return;

    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/organizations/${selectedOrganizationId}/requests/${requestItem.userId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || `No se pudo ${action === "approve" ? "aprobar" : "rechazar"} la solicitud`);

      await loadMyOrganizations();
      await loadSearchResults(searchPage).catch(() => undefined);
      await loadOrganizationDetail(selectedOrganizationId);
      setMessage({
        type: "success",
        text: action === "approve"
          ? t("ORG_REQUEST_APPROVED_SUCCESS", { username: requestItem.username })
          : t("ORG_REQUEST_REJECTED_SUCCESS", { username: requestItem.username }),
      });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("CONNECTION_ERROR") });
    } finally {
      setLoading(false);
    }
  }

  async function handleSendChatMessage(event: FormEvent) {
    event.preventDefault();
    if (!token || !selectedOrganizationId || !viewer?.isMember || !chatDraft.trim()) return;

    setChatLoading(true);
    try {
      const response = await fetch(`${API}/api/organizations/${selectedOrganizationId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: chatDraft.trim() }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo enviar el mensaje");

      setChatDraft("");
      setChatMessages((prev) => [...prev, json.message]);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("CONNECTION_ERROR") });
    } finally {
      setChatLoading(false);
    }
  }

  function renderOrganizationDetail() {
    if (!selectedOrganizationId) return null;

    if (!selectedOrganization || selectedOrganization.id !== selectedOrganizationId) {
          return (
        <div className="profile-panel">
          <h2>{t("LOADING")}</h2>
        </div>
      );
    }

    const backLabel = activeTab === "mine" ? t("ORG_BACK_TO_MINE") : t("ORG_BACK_TO_SEARCH");

    return (
      <>
        <div className="profile-panel">
          <div className="organization-head">
            <div>
              <h2>{selectedOrganization.name}</h2>
              <p>{selectedOrganization.description || t("ORG_NO_DESCRIPTION")}</p>
            </div>
            <div className="organization-meta">
              <span>{t("ORG_OWNER_LABEL")}: @{selectedOrganization.owner.username}</span>
              <span>{t("ORG_MEMBERS_LABEL")}: {selectedOrganization.totalMembers}</span>
              <span>{t("ORG_YOUR_ROLE")}: {getRoleLabel(viewer?.role)}</span>
            </div>
          </div>

          <div className="organizations-detail-actions">
            <button className="btn-premium tertiary" type="button" onClick={clearOrganizationDetail}>
              {backLabel}
            </button>
            {canEditOrganization ? (
              <button className="btn-premium secondary" type="button" onClick={() => setShowEditForm((current) => !current)}>
                {showEditForm ? t("ORG_CLOSE_EDIT") : t("ORG_OPEN_EDIT")}
              </button>
            ) : null}
            {!viewer?.isMember && viewer?.canApply ? (
              <button className="btn-premium" type="button" onClick={() => void handleApplyToOrganization(selectedOrganization.id)} disabled={loading}>
                {t("ORG_APPLY")}
              </button>
            ) : null}
            {viewer?.isMember ? (
              <button className="btn-premium tertiary" type="button" onClick={() => void handleLeaveOrganization()} disabled={loading}>
                {t("ORG_LEAVE")}
              </button>
            ) : null}
          </div>

          {!viewer?.isMember && viewer?.requestStatus === "pending" ? (
            <div className="organization-info-panel">
              {t("ORG_PENDING_HELP")}
            </div>
          ) : null}

          {!viewer?.isMember && viewer?.requestStatus === "rejected" ? (
            <div className="organization-info-panel muted">
              {t("ORG_REJECTED_HELP")}
            </div>
          ) : null}
        </div>

        {viewer?.isMember ? (
          <>
            {showEditForm && canEditOrganization ? (
              <form className="profile-panel" onSubmit={handleUpdateOrganization}>
                <h2>{t("ORG_EDIT")}</h2>
                <label>
                  <span>{t("ORG_NAME")}</span>
                  <input value={editName} onChange={(event) => setEditName(event.target.value)} required minLength={3} maxLength={120} />
                </label>
                <label>
                  <span>{t("ORG_DESCRIPTION")}</span>
                  <textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} rows={4} maxLength={400} />
                </label>
                <div className="split-actions">
                  <button className="btn-premium" type="submit" disabled={loading}>{t("SAVE_CHANGES")}</button>
                </div>
              </form>
            ) : null}

            <div className="profile-panel">
              <div className="organization-head">
                <h2>{t("ORG_MEMBERS_TITLE")}</h2>
                <span>{detail?.members.length ?? 0} {t("ORG_TOTAL")}</span>
              </div>
              <div className="organizations-members">
                {(detail?.members ?? []).map((member) => {
                  const menuOpen = openMemberMenuId === member.userId;
                  const showMenu = canOpenMemberMenu(member);

                  return (
                    <article key={member.userId} className="organization-member-row">
                      <div className="organization-member-main">
                        <div>
                          <strong>@{member.username}</strong>
                        </div>
                        <span>{t("ORG_SINCE")}: {formatDate(member.joinedAt)}</span>
                      </div>
                      <div className="organization-member-side">
                        <span className="organization-role-pill">{getRoleLabel(member.role)}</span>
                        {showMenu ? (
                          <div className="organization-menu-wrap">
                            <button
                              className="organization-menu-trigger"
                              type="button"
                              onClick={() => setOpenMemberMenuId(menuOpen ? null : member.userId)}
                            >
                              ...
                            </button>
                            {menuOpen ? (
                              <div className="organization-menu">
                                {canChangeRoles && member.role === "member" ? (
                                  <button className="organization-menu-item" type="button" onClick={() => void handleUpdateMemberRole(member, "admin")}>
                                    {t("ORG_MAKE_ADMIN")}
                                  </button>
                                ) : null}
                                {canChangeRoles && member.role === "admin" ? (
                                  <button className="organization-menu-item" type="button" onClick={() => void handleUpdateMemberRole(member, "member")}>
                                    {t("ORG_MAKE_MEMBER")}
                                  </button>
                                ) : null}
                                {canManageMembers ? (
                                  <button className="organization-menu-item danger" type="button" onClick={() => void handleRemoveMember(member)}>
                                    {t("ORG_REMOVE_FROM_ORG")}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="profile-panel">
              <div className="organization-head">
                <div>
                  <h2>Chat</h2>
                  <p>Habla con los miembros de la organizacion.</p>
                </div>
                <span>{chatMessages.length} mensajes</span>
              </div>
              <div className="organization-chat-list">
                {chatMessages.length === 0 ? (
                  <p className="muted">Todavia no hay mensajes en esta organizacion.</p>
                ) : (
                  chatMessages.map((chatMessage) => (
                    <article key={chatMessage.id} className="organization-chat-message">
                      <div className="organization-chat-message-head">
                        <strong>@{chatMessage.author.username}</strong>
                        <span>{formatDate(chatMessage.createdAt)}</span>
                      </div>
                      <p>{chatMessage.content}</p>
                    </article>
                  ))
                )}
              </div>
              <form className="organization-chat-form" onSubmit={handleSendChatMessage}>
                <textarea
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Escribe un mensaje para la organizacion"
                />
                <button className="btn-premium" type="submit" disabled={chatLoading || !chatDraft.trim()}>
                  {chatLoading ? "Enviando..." : "Enviar mensaje"}
                </button>
              </form>
            </div>

            {canReviewRequests ? (
              <div className="profile-panel">
                <div className="organization-head">
                  <h2>{t("ORG_ACCESS_REQUESTS")}</h2>
                  <span>{detail?.requests.length ?? 0} {t("ORG_PENDING_PLURAL")}</span>
                </div>
                {detail?.requests.length ? (
                  <div className="organizations-members">
                    {detail.requests.map((requestItem) => (
                      <article key={requestItem.userId} className="organization-member-row">
                        <div className="organization-member-main">
                          <div>
                            <strong>@{requestItem.username}</strong>
                            <span>{t("ORG_REQUESTED_AT")}: {formatDate(requestItem.createdAt)}</span>
                          </div>
                          <span>{getRequestStatusLabel(requestItem.status)}</span>
                        </div>
                        <div className="organization-actions">
                          <button className="btn-premium" type="button" onClick={() => void handleReviewRequest(requestItem, "approve")} disabled={loading}>
                            {t("ACCEPT")}
                          </button>
                          <button className="btn-premium tertiary" type="button" onClick={() => void handleReviewRequest(requestItem, "reject")} disabled={loading}>
                            {t("REJECT")}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="muted">{t("ORG_NO_PENDING_REQUESTS")}</p>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <div className="profile-panel">
            <h2>{t("ORG_RESTRICTED_TITLE")}</h2>
            <p>{t("ORG_RESTRICTED_BODY")}</p>
          </div>
        )}
      </>
    );
  }

  return (
    <section className="glass-panel play-hub-panel play-hub-panel-enter page-hub-panel organizations-shell">
      <div className="page-hub-layout page-stack">
      <div className="hero-card">
        <h1>{t("ORG_PAGE_TITLE")}</h1>
        <p>{t("ORG_PAGE_SUBTITLE")}</p>
      </div>

      <div className="profile-tabs">
        <button className={`tab-btn ${activeTab === "mine" ? "active" : ""}`} type="button" onClick={() => switchTab("mine")}>
          {t("ORG_MY_TAB")}
        </button>
        <button className={`tab-btn ${activeTab === "search" ? "active" : ""}`} type="button" onClick={() => switchTab("search")}>
          {t("ORG_SEARCH_TAB")}
        </button>
        <button className={`tab-btn ${activeTab === "create" ? "active" : ""}`} type="button" onClick={() => switchTab("create")}>
          {t("ORG_CREATE_TAB")}
        </button>
      </div>

      {message ? <div className={`profile-message ${message.type}`}>{message.text}</div> : null}

      <div key={activeTab} className="profile-tab-stage profile-tab-stage-enter">
      {activeTab === "create" ? (
        <form className="profile-panel" onSubmit={handleCreate}>
          <h2>{t("ORG_CREATE_TAB")}</h2>
          <label>
            <span>{t("ORG_NAME")}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required minLength={3} maxLength={120} />
          </label>
          <label>
            <span>{t("ORG_DESCRIPTION")}</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} maxLength={400} />
          </label>
          <button className="btn-premium" type="submit" disabled={loading}>{t("ORG_CREATE_ACTION")}</button>
        </form>
      ) : null}

      {activeTab === "search" ? (
        <>
          {selectedOrganizationId ? (
            renderOrganizationDetail()
          ) : (
            <div className="profile-panel">
              <div className="organizations-search-head">
                <div>
                  <h2>{t("ORG_SEARCH_TITLE")}</h2>
                  <p>{t("ORG_SEARCH_SUBTITLE")}</p>
                </div>
                <span>{searchSummary}</span>
              </div>

              <div className="organizations-filter-grid">
                <label>
                  <span>{t("ORG_SEARCH_LABEL")}</span>
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t("ORG_SEARCH_PLACEHOLDER")} />
                </label>
                <label>
                  <span>{t("ORG_RESULTS_PER_PAGE")}</span>
                  <select value={searchLimit} onChange={(event) => setSearchLimit(Number(event.target.value))}>
                    <option value="4">4</option>
                    <option value="8">8</option>
                    <option value="12">12</option>
                  </select>
                </label>
                <div className="organizations-inline-actions">
                  <button
                    className="btn-premium tertiary"
                    type="button"
                    onClick={() => setShowAdvancedFilters((current) => !current)}
                  >
                    {t("ORG_ADVANCED_FILTERS")}
                  </button>
                  <button
                    className="btn-premium secondary"
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setOwnerFilter("");
                      setRequestStatusFilter("all");
                      setSearchSortBy("created_at");
                      setSearchOrder("asc");
                      void loadSearchResultsWithQuery("", 0, {
                        ownerFilter: "",
                        requestStatusFilter: "all",
                        searchSortBy: "created_at",
                        searchOrder: "asc",
                      });
                    }}
                    disabled={loading}
                  >
                    {t("ORG_CLEAR_ACTION")}
                  </button>
                </div>
              </div>

              {showAdvancedFilters ? (
                <div className="organization-advanced-filters">
                  <div className="organizations-filter-grid">
                    <label>
                      <span>{t("ORG_OWNER_FILTER")}</span>
                      <input
                        value={ownerFilter}
                        onChange={(event) => setOwnerFilter(event.target.value)}
                        placeholder={t("ORG_OWNER_FILTER_PLACEHOLDER")}
                      />
                    </label>
                    <label>
                      <span>{t("ORG_REQUEST_FILTER")}</span>
                      <select value={requestStatusFilter} onChange={(event) => setRequestStatusFilter(event.target.value as SearchRequestStatus)}>
                        <option value="all">{t("ORG_FILTER_ALL")}</option>
                        <option value="none">{t("ORG_REQUEST_NONE")}</option>
                        <option value="pending">{t("ORG_REQUEST_PENDING")}</option>
                        <option value="rejected">{t("ORG_REQUEST_REJECTED")}</option>
                        <option value="cancelled">{t("ORG_REQUEST_CANCELLED")}</option>
                      </select>
                    </label>
                    <label>
                      <span>{t("ORG_SORT_BY")}</span>
                      <select value={searchSortBy} onChange={(event) => setSearchSortBy(event.target.value as SearchSortBy)}>
                        <option value="created_at">{t("ORG_SORT_CREATED")}</option>
                        <option value="name">{t("ORG_SORT_NAME")}</option>
                      </select>
                    </label>
                    <label>
                      <span>{t("ORG_SORT_DIRECTION")}</span>
                      <select value={searchOrder} onChange={(event) => setSearchOrder(event.target.value as SearchOrder)}>
                        <option value="desc">{t("ORG_SORT_DESC")}</option>
                        <option value="asc">{t("ORG_SORT_ASC")}</option>
                      </select>
                    </label>
                  </div>
                </div>
              ) : null}

              <div className="organizations-list organizations-list-grid">
                {searchResults.map((organization) => (
                  <article key={organization.id} className="organization-card static">
                    <strong>{organization.name}</strong>
                    <span>{t("ORG_OWNER_LABEL")}: @{organization.owner.username}</span>
                    <span>{organization.description || t("ORG_NO_DESCRIPTION")}</span>
                    <span>{organization.totalMembers} {t("ORG_MEMBERS_SHORT")}</span>
                    <div className="organization-actions">
                      <button className="btn-premium" type="button" onClick={() => openOrganizationDetail(organization.id)}>
                        {t("ORG_VIEW")}
                      </button>
                      {organization.viewer.canApply ? (
                        <button className="btn-premium secondary" type="button" onClick={() => void handleApplyToOrganization(organization.id)} disabled={loading}>
                          {t("ORG_APPLY")}
                        </button>
                      ) : null}
                      {!organization.viewer.isMember && organization.viewer.requestStatus === "pending" ? (
                        <span className="organization-badge">{t("ORG_REQUEST_PENDING")}</span>
                      ) : null}
                      {!organization.viewer.isMember && organization.viewer.requestStatus === "rejected" ? (
                        <span className="organization-badge muted">{t("ORG_REQUEST_REJECTED")}</span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>

              {searchResults.length === 0 ? <p className="muted">{t("ORG_NO_RESULTS")}</p> : null}

              <div className="split-actions">
                <button className="btn-premium tertiary" type="button" disabled={searchPage === 0 || loading} onClick={() => void loadSearchResults(searchPage - 1)}>
                  {t("ORG_PREVIOUS")}
                </button>
                <button
                  className="btn-premium secondary"
                  type="button"
                  disabled={loading || searchPage * searchLimit + searchResults.length >= searchTotal}
                  onClick={() => void loadSearchResults(searchPage + 1)}
                >
                  {t("ORG_NEXT")}
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}

      {activeTab === "mine" ? (
        <>
          {selectedOrganizationId ? (
            renderOrganizationDetail()
          ) : (
            <div className="profile-panel">
              <div className="organization-head">
                <div>
                  <h2>{t("ORG_MY_TITLE")}</h2>
                  <p>{t("ORG_MY_SUBTITLE")}</p>
                </div>
                <span>{myOrganizations.length}</span>
              </div>

              {myOrganizations.length > 0 ? (
                <div className="organizations-scroll-list">
                  <div className="organizations-list organizations-list-grid">
                    {myOrganizations.map((organization) => (
                      <article key={organization.id} className="organization-card static">
                        <strong>{organization.name}</strong>
                        <span>{t("ORG_OWNER_LABEL")}: @{organization.owner.username}</span>
                        <span>{organization.description || t("ORG_NO_DESCRIPTION")}</span>
                        <span>{organization.totalMembers} {t("ORG_MEMBERS_SHORT")}</span>
                        <span>{t("ORG_YOUR_ROLE")}: {getRoleLabel(organization.viewer.role)}</span>
                        <button className="btn-premium" type="button" onClick={() => openOrganizationDetail(organization.id)}>
                          {t("ORG_ENTER")}
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="muted">{t("ORG_EMPTY_MINE")}</p>
              )}
            </div>
          )}
        </>
      ) : null}
      </div>
      </div>
    </section>
  );
}
