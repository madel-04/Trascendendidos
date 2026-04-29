const base = "http://localhost:3000"

async function req(path, { method = "GET", token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  return { status: res.status, data }
}

function report(cond, label, detail = "") {
  if (cond) {
    console.log(`PASS | ${label}${detail ? ` | ${detail}` : ""}`)
  } else {
    console.log(`FAIL | ${label}${detail ? ` | ${detail}` : ""}`)
    process.exitCode = 1
  }
}

async function main() {
  const ts = Date.now().toString().slice(-6)
  const userA = {
    email: `chat${ts}a@test.com`,
    username: `chat_${ts}a`,
    password: "Test1234!ABcd",
  }
  const userB = {
    email: `chat${ts}b@test.com`,
    username: `chat_${ts}b`,
    password: "Test1234!ABcd",
  }

  const regA = await req("/api/auth/register", { method: "POST", body: userA })
  const regB = await req("/api/auth/register", { method: "POST", body: userB })
  report(regA.status === 200 || regA.status === 201, "Register user A", `status=${regA.status}`)
  report(regB.status === 200 || regB.status === 201, "Register user B", `status=${regB.status}`)

  const loginA = await req("/api/auth/login", {
    method: "POST",
    body: { email: userA.email, password: userA.password },
  })
  const loginB = await req("/api/auth/login", {
    method: "POST",
    body: { email: userB.email, password: userB.password },
  })

  const tokenA = loginA.data?.token
  const tokenB = loginB.data?.token

  report(!!tokenA, "Login user A returns token", `status=${loginA.status}`)
  report(!!tokenB, "Login user B returns token", `status=${loginB.status}`)

  const fr = await req("/api/social/friend-request", {
    method: "POST",
    token: tokenA,
    body: { username: userB.username },
  })
  report(fr.status === 200 || fr.status === 201, "Send friend request A->B", `status=${fr.status}`)

  const overviewB = await req("/api/social/overview", { token: tokenB })
  const incoming = overviewB.data?.incomingRequests || []
  const pendingReq = incoming.find((item) => item?.user?.username === userA.username)
  report(!!pendingReq?.requestId, "B sees incoming friend request")

  const accept = await req(`/api/social/friend-request/${pendingReq.requestId}/accept`, {
    method: "POST",
    token: tokenB,
  })
  report(accept.status === 200, "B accepts friend request", `status=${accept.status}`)

  const sendMsg = await req(`/api/chat/conversation/${encodeURIComponent(userB.username)}/messages`, {
    method: "POST",
    token: tokenA,
    body: { content: "hola advanced chat" },
  })
  const messageId = sendMsg.data?.message?.id
  report(sendMsg.status === 201, "A sends chat message to B", `status=${sendMsg.status}`)
  report(!!messageId, "Message id returned")

  const historyB = await req(`/api/chat/conversation/${encodeURIComponent(userA.username)}/messages?limit=20`, {
    token: tokenB,
  })
  report(historyB.status === 200, "B loads chat history", `messages=${historyB.data?.messages?.length ?? 0}`)

  const markRead = await req(`/api/chat/conversation/${encodeURIComponent(userA.username)}/read`, {
    method: "POST",
    token: tokenB,
  })
  const updated = markRead.data?.updated || []
  report(markRead.status === 200, "B marks messages as read", `updated=${updated.length}`)

  const historyA = await req(`/api/chat/conversation/${encodeURIComponent(userB.username)}/messages?limit=20`, {
    token: tokenA,
  })
  const msgBack = (historyA.data?.messages || []).find((m) => String(m.id) === String(messageId))
  report(!!msgBack, "A sees sent message in history")
  report(!!msgBack?.readAt, "Read receipt persisted", `readAt=${msgBack?.readAt || "null"}`)

  const typingOn = await req(`/api/chat/conversation/${encodeURIComponent(userB.username)}/typing`, {
    method: "POST",
    token: tokenA,
    body: { typing: true },
  })
  const typingOff = await req(`/api/chat/conversation/${encodeURIComponent(userB.username)}/typing`, {
    method: "POST",
    token: tokenA,
    body: { typing: false },
  })
  report(typingOn.status === 200, "Typing ON endpoint", `status=${typingOn.status}`)
  report(typingOff.status === 200, "Typing OFF endpoint", `status=${typingOff.status}`)

  const invite = await req(`/api/chat/conversation/${encodeURIComponent(userB.username)}/invite-to-game`, {
    method: "POST",
    token: tokenA,
  })
  report(invite.status === 201, "Invite to game from chat", `status=${invite.status}`)

  const block = await req(`/api/chat/conversation/${encodeURIComponent(userB.username)}/block`, {
    method: "POST",
    token: tokenA,
  })
  report(block.status === 200, "Block user from chat", `status=${block.status}`)

  const sendAfterBlock = await req(`/api/chat/conversation/${encodeURIComponent(userB.username)}/messages`, {
    method: "POST",
    token: tokenA,
    body: { content: "deberia fallar por bloqueo" },
  })
  report(sendAfterBlock.status === 403, "Chat blocked after block action", `status=${sendAfterBlock.status}`)

  console.log("\nManual advanced chat test completed")
}

main().catch((err) => {
  console.error("FAIL | Unexpected script error", err)
  process.exit(1)
})
