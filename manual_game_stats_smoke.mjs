import { execFileSync } from "node:child_process";

const base = "http://localhost:3000";

async function req(path, { method = "GET", token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

function report(cond, label, detail = "") {
  if (cond) console.log(`PASS | ${label}${detail ? ` | ${detail}` : ""}`);
  else {
    console.log(`FAIL | ${label}${detail ? ` | ${detail}` : ""}`);
    process.exitCode = 1;
  }
}

function psql(sql) {
  execFileSync(
    "docker",
    ["compose", "exec", "-T", "db", "psql", "-U", "transcendence", "-d", "transcendence", "-c", sql],
    { stdio: "inherit" }
  );
}

async function main() {
  const ts = Date.now().toString().slice(-6);
  const userA = { email: `stats${ts}a@test.com`, username: `stats_${ts}a`, password: "Test1234!ABcd" };
  const userB = { email: `stats${ts}b@test.com`, username: `stats_${ts}b`, password: "Test1234!ABcd" };

  const regA = await req("/api/auth/register", { method: "POST", body: userA });
  const regB = await req("/api/auth/register", { method: "POST", body: userB });
  report(regA.status === 201, "Register user A", `status=${regA.status}`);
  report(regB.status === 201, "Register user B", `status=${regB.status}`);

  const loginA = await req("/api/auth/login", { method: "POST", body: { email: userA.email, password: userA.password } });
  const loginB = await req("/api/auth/login", { method: "POST", body: { email: userB.email, password: userB.password } });
  report(!!loginA.data?.token, "Login user A returns token");
  report(!!loginB.data?.token, "Login user B returns token");

  const friendRequest = await req("/api/social/friend-request", {
    method: "POST",
    token: loginA.data.token,
    body: { username: userB.username },
  });
  report(friendRequest.status === 201, "Send friend request", `status=${friendRequest.status}`);

  const overviewB = await req("/api/social/overview", { token: loginB.data.token });
  const pending = overviewB.data?.incomingRequests?.find((item) => item?.user?.username === userA.username);
  report(!!pending?.requestId, "B sees incoming request");

  const accept = await req(`/api/social/friend-request/${pending.requestId}/accept`, {
    method: "POST",
    token: loginB.data.token,
  });
  report(accept.status === 200, "Accept friend request", `status=${accept.status}`);

  const message = await req(`/api/chat/conversation/${encodeURIComponent(userB.username)}/messages`, {
    method: "POST",
    token: loginA.data.token,
    body: { content: "hola stats" },
  });
  report(message.status === 201, "Send chat message", `status=${message.status}`);

  const insertSql = `INSERT INTO game_matches (room_id, player1_id, player2_id, winner_id, reason, player1_score, player2_score, created_at, ended_at)
  VALUES (
    'smoke-${ts}',
    (SELECT id FROM users WHERE username = '${userA.username}'),
    (SELECT id FROM users WHERE username = '${userB.username}'),
    (SELECT id FROM users WHERE username = '${userA.username}'),
    'completed',
    10,
    7,
    NOW(),
    NOW()
  );`;
  psql(insertSql);

  const stats = await req("/api/game/stats", { token: loginA.data.token });
  report(stats.status === 200, "Fetch game stats", JSON.stringify(stats.data));
  report((stats.data?.totalPlayed ?? 0) >= 1, "Stats reflect at least one match");
  report((stats.data?.wins ?? 0) >= 1, "Stats reflect a win");

  const history = await req("/api/game/history?limit=5", { token: loginA.data.token });
  report(history.status === 200, "Fetch match history", `matches=${history.data?.matches?.length ?? 0}`);
  report((history.data?.matches ?? []).some((m) => m.roomId === `smoke-${ts}`), "Inserted match appears in history");

  console.log("\nManual game stats smoke test completed");
}

main().catch((error) => {
  console.error("FAIL | Unexpected script error", error);
  process.exit(1);
});
