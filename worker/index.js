const TEAM_IDS = ["A", "B", "C", "D"];
const INITIAL_POINTS = 500;
const DEFAULT_SECONDS = 10;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function withCors(res, origin = "*") {
  const next = new Response(res.body, res);
  next.headers.set("access-control-allow-origin", origin);
  next.headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  next.headers.set("access-control-allow-headers", "content-type,x-room-session");
  return next;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function makeToken() {
  return crypto.randomUUID().replaceAll("-", "");
}

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function safePlayer(raw) {
  return {
    id: raw.id || crypto.randomUUID(),
    name: String(raw.name || "").trim(),
    tier: String(raw.tier || "").trim(),
    positions: Array.isArray(raw.positions) ? raw.positions.filter(Boolean) : [],
  };
}

function safeCaptain(raw, fallbackName = "") {
  const safe = safePlayer(raw || {});
  return {
    ...safe,
    name: safe.name || String(fallbackName || "").trim(),
  };
}

function buildDefaultRoom(roomCode) {
  return {
    roomCode,
    createdAt: Date.now(),
    config: {
      seconds: DEFAULT_SECONDS,
    },
    teams: TEAM_IDS.map((id) => ({
      id,
      name: `팀 ${id}`,
      captainName: "미참가",
      points: INITIAL_POINTS,
      captainPlayer: null,
      players: [],
    })),
    queue: [],
    current: null,
    bids: {},
    logs: [],
    sessions: {},
    round: {
      running: false,
      paused: false,
      endsAt: 0,
      remainingMs: 0,
      started: false,
    },
    resolvedHistory: [],
  };
}

function roomPublicState(room) {
  return {
    roomCode: room.roomCode,
    config: room.config,
    teams: room.teams,
    queue: room.queue,
    current: room.current,
    bids: room.bids,
    logs: room.logs,
    resolvedHistory: Array.isArray(room.resolvedHistory) ? room.resolvedHistory : [],
    round: room.round,
    canUndo: Boolean(room.current || (Array.isArray(room.resolvedHistory) && room.resolvedHistory.length > 0)),
  };
}

function parseRoomCodeFromPath(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("rooms");
  if (idx === -1) return "";
  return (parts[idx + 1] || "").toUpperCase();
}

export class AuctionRoomDO {
  constructor(state) {
    this.state = state;
    this.room = null;
    this.state.blockConcurrencyWhile(async () => {
      this.room = (await this.state.storage.get("room")) || null;
    });
  }

  async persist() {
    await this.state.storage.put("room", this.room);
  }

  getSession(token) {
    if (!token) return null;
    return this.room.sessions[token] || null;
  }

  sessionFromRequest(request) {
    const headerToken = request.headers.get("x-room-session") || "";
    const url = new URL(request.url);
    const queryToken = url.searchParams.get("session") || "";
    return this.getSession(headerToken || queryToken);
  }

  requireHost(request) {
    const session = this.sessionFromRequest(request);
    return session && session.role === "host" ? session : null;
  }

  requireCaptain(request) {
    const session = this.sessionFromRequest(request);
    return session && session.role === "captain" ? session : null;
  }

  async broadcast() {
    const payload = JSON.stringify({ type: "state", state: roomPublicState(this.room) });
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        try {
          ws.close(1011, "broadcast failed");
        } catch {
          // noop
        }
      }
    }
  }

  async initRoom(request) {
    if (this.room) return json({ error: "room already initialized" }, 409);
    const body = (await readJson(request)) || {};
    this.room = buildDefaultRoom(body.roomCode || "UNKNOWN");
    const hostName = String(body.hostName || "방장").trim() || "방장";
    const hostSession = makeToken();
    this.room.sessions[hostSession] = {
      role: "host",
      name: hostName,
      teamId: null,
      joinedAt: Date.now(),
    };
    await this.persist();
    return json({
      ok: true,
      roomCode: this.room.roomCode,
      hostSession,
      state: roomPublicState(this.room),
    });
  }

  async joinCaptain(request) {
    if (!this.room) return json({ error: "room not initialized" }, 404);
    const body = (await readJson(request)) || {};
    const teamId = String(body.teamId || "").toUpperCase();
    const captainName = String(body.captainName || "").trim();
    const team = this.room.teams.find((entry) => entry.id === teamId);
    if (!team) return json({ error: "invalid teamId" }, 400);
    if (!captainName) return json({ error: "captainName is required" }, 400);
    if (team.captainName !== "미참가") return json({ error: "team already joined by captain" }, 409);

    const sessionToken = makeToken();
    this.room.sessions[sessionToken] = {
      role: "captain",
      name: captainName,
      teamId,
      joinedAt: Date.now(),
    };
    const captainPlayer = safeCaptain(body.captainPlayer, captainName);
    team.captainName = captainName;
    team.captainPlayer = captainPlayer;
    this.room.logs.unshift(`${team.name} 주장 참가 - ${captainName}`);
    this.room.logs = this.room.logs.slice(0, 120);
    this.room.queue = this.room.queue.filter((player) => normalizeName(player.name) !== normalizeName(captainName));

    await this.persist();
    await this.broadcast();
    return json({
      ok: true,
      sessionToken,
      state: roomPublicState(this.room),
      myTeamId: teamId,
    });
  }

  async leaveCaptain(request) {
    if (!this.room) return json({ error: "room not initialized" }, 404);
    const captain = this.requireCaptain(request);
    if (!captain) return json({ error: "captain only" }, 403);
    const team = this.room.teams.find((entry) => entry.id === captain.teamId);
    if (!team) return json({ error: "invalid captain team" }, 400);
    if (this.room.round.running || this.room.round.paused) return json({ error: "round is active or paused" }, 409);

    team.captainName = "미참가";
    team.captainPlayer = null;
    this.room.logs.unshift(`${team.name} 주장 퇴장 - ${captain.name}`);
    this.room.logs = this.room.logs.slice(0, 120);

    const token = request.headers.get("x-room-session") || new URL(request.url).searchParams.get("session") || "";
    if (token && this.room.sessions[token]) {
      delete this.room.sessions[token];
    }

    await this.persist();
    await this.broadcast();
    return json({ ok: true, state: roomPublicState(this.room), leftTeamId: captain.teamId });
  }

  async addRoster(request) {
    if (!this.room) return json({ error: "room not initialized" }, 404);
    if (!this.requireHost(request)) return json({ error: "host only" }, 403);
    const body = (await readJson(request)) || {};
    const players = Array.isArray(body.players) ? body.players.map(safePlayer) : [];
    if (players.length === 0) return json({ error: "players is empty" }, 400);

    const existingQueue = new Map(this.room.queue.map((p) => [normalizeName(p.name), p]));
    const assignedNames = new Set(
      this.room.teams.flatMap((team) => [team.captainPlayer, ...team.players].filter(Boolean).map((p) => normalizeName(p.name))),
    );
    for (const player of players) {
      if (!player.name) continue;
      const key = normalizeName(player.name);
      if (assignedNames.has(key)) continue;
      existingQueue.set(key, player);
    }
    this.room.queue = Array.from(existingQueue.values());
    this.room.logs.unshift(`명단 추가 - ${players.length}명`);
    this.room.logs = this.room.logs.slice(0, 120);
    await this.persist();
    await this.broadcast();
    return json({ ok: true, state: roomPublicState(this.room) });
  }

  async startRound(request) {
    if (!this.room) return json({ error: "room not initialized" }, 404);
    if (!this.requireHost(request)) return json({ error: "host only" }, 403);
    if (this.room.round.running) return json({ error: "round already running" }, 409);
    if (this.room.queue.length === 0) return json({ error: "queue is empty" }, 400);

    const body = (await readJson(request)) || {};
    const seconds = Math.max(5, Math.min(60, Number.parseInt(body.seconds || this.room.config.seconds, 10) || DEFAULT_SECONDS));
    this.room.config.seconds = seconds;

    const idx = Math.floor(Math.random() * this.room.queue.length);
    const current = this.room.queue[idx];
    this.room.queue.splice(idx, 1);
    this.room.current = current;
    this.room.bids = {};
    this.room.round.running = true;
    this.room.round.paused = false;
    this.room.round.endsAt = Date.now() + seconds * 1000;
    this.room.round.remainingMs = 0;
    this.room.round.started = true;
    this.room.logs.unshift(`${current.name} 경매 시작 (${seconds}초)`);
    this.room.logs = this.room.logs.slice(0, 120);

    await this.persist();
    await this.state.storage.setAlarm(this.room.round.endsAt);
    await this.broadcast();
    return json({ ok: true, state: roomPublicState(this.room) });
  }

  async placeBid(request) {
    if (!this.room) return json({ error: "room not initialized" }, 404);
    const captain = this.requireCaptain(request);
    if (!captain) return json({ error: "captain only" }, 403);
    if (!this.room.round.running || !this.room.current) return json({ error: "no active round" }, 409);

    const body = (await readJson(request)) || {};
    const amount = Number.parseInt(body.amount, 10);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "invalid amount" }, 400);
    const team = this.room.teams.find((entry) => entry.id === captain.teamId);
    if (!team) return json({ error: "invalid captain team" }, 400);
    if (amount > team.points) return json({ error: "not enough points" }, 400);
    const highestBid = Math.max(
      0,
      ...Object.values(this.room.bids).map((entry) => Number(entry?.amount || 0)),
    );
    if (amount <= highestBid) return json({ error: `현재 최고 입찰가(${highestBid}P)보다 높게 입력해주세요.` }, 400);

    this.room.bids[captain.teamId] = { amount, at: Date.now() };
    this.room.logs.unshift(`${team.name} ${team.captainName} - ${amount}P`);
    this.room.logs = this.room.logs.slice(0, 120);
    await this.persist();
    await this.broadcast();
    return json({ ok: true, state: roomPublicState(this.room) });
  }

  async finishRound(request, source = "manual") {
    if (!this.room) return json({ error: "room not initialized" }, 404);
    if (!this.room.round.running || !this.room.current) return json({ error: "no active round" }, 409);
    if (source === "manual" && !this.requireHost(request)) return json({ error: "host only" }, 403);

    const bids = Object.entries(this.room.bids)
      .map(([teamId, data]) => ({ teamId, amount: data.amount, at: data.at }))
      .sort((a, b) => {
        if (b.amount !== a.amount) return b.amount - a.amount;
        return a.at - b.at;
      });

    if (bids.length === 0) {
      this.room.resolvedHistory.push({
        type: "unsold",
        player: this.room.current,
      });
      this.room.logs.unshift(`${this.room.current.name} 유찰`);
      this.room.queue.push(this.room.current);
    } else {
      const winner = bids[0];
      const team = this.room.teams.find((entry) => entry.id === winner.teamId);
      if (team) {
        this.room.resolvedHistory.push({
          type: "sold",
          player: this.room.current,
          teamId: winner.teamId,
          amount: winner.amount,
        });
        team.points = Math.max(0, team.points - winner.amount);
        team.players.push(this.room.current);
        this.room.logs.unshift(`${team.name} ${team.captainName} 낙찰 - ${winner.amount}P (${this.room.current.name})`);
      } else {
        this.room.resolvedHistory.push({
          type: "unsold",
          player: this.room.current,
        });
        this.room.queue.push(this.room.current);
      }
    }

    this.room.logs = this.room.logs.slice(0, 120);
    this.room.current = null;
    this.room.bids = {};
    this.room.round.running = false;
    this.room.round.paused = false;
    this.room.round.endsAt = 0;
    this.room.round.remainingMs = 0;
    this.room.round.started = true;
    await this.persist();
    await this.broadcast();
    return json({ ok: true, state: roomPublicState(this.room) });
  }

  async togglePauseRound(request) {
    if (!this.room) return json({ error: "room not initialized" }, 404);
    if (!this.requireHost(request)) return json({ error: "host only" }, 403);
    if (!this.room.round.started) return json({ error: "auction not started" }, 409);

    if (this.room.round.running && this.room.current) {
      const remainingMs = Math.max(0, this.room.round.endsAt - Date.now());
      this.room.round.running = false;
      this.room.round.paused = true;
      this.room.round.remainingMs = remainingMs;
      this.room.round.endsAt = 0;
      this.room.logs.unshift("경매 일시 정지");
      this.room.logs = this.room.logs.slice(0, 120);
      await this.persist();
      await this.broadcast();
      return json({ ok: true, state: roomPublicState(this.room) });
    }

    if (this.room.round.paused && this.room.current) {
      const ms = Math.max(1000, Number(this.room.round.remainingMs || this.room.config.seconds * 1000));
      this.room.round.running = true;
      this.room.round.paused = false;
      this.room.round.endsAt = Date.now() + ms;
      this.room.round.remainingMs = 0;
      this.room.logs.unshift("경매 재개");
      this.room.logs = this.room.logs.slice(0, 120);
      await this.persist();
      await this.state.storage.setAlarm(this.room.round.endsAt);
      await this.broadcast();
      return json({ ok: true, state: roomPublicState(this.room) });
    }

    return json({ error: "no active or paused round" }, 409);
  }

  async restartAuction(request) {
    if (!this.room) return json({ error: "room not initialized" }, 404);
    if (!this.requireHost(request)) return json({ error: "host only" }, 403);

    if (this.room.current) this.room.queue.push(this.room.current);
    this.room.current = null;
    this.room.bids = {};
    this.room.round.running = false;
    this.room.round.paused = false;
    this.room.round.endsAt = 0;
    this.room.round.remainingMs = 0;
    this.room.round.started = true;
    this.room.resolvedHistory = [];

    // Fisher-Yates shuffle
    for (let i = this.room.queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = this.room.queue[i];
      this.room.queue[i] = this.room.queue[j];
      this.room.queue[j] = tmp;
    }
    this.room.logs.unshift("경매 재시작 - 순서 재랜덤");
    this.room.logs = this.room.logs.slice(0, 120);
    await this.persist();
    await this.broadcast();
    return json({ ok: true, state: roomPublicState(this.room) });
  }

  async undoCurrentRound(request) {
    if (!this.room) return json({ error: "room not initialized" }, 404);
    if (!this.requireHost(request)) return json({ error: "host only" }, 403);
    if (this.room.current) {
      this.room.queue.unshift(this.room.current);
      this.room.current = null;
      this.room.bids = {};
      this.room.round.running = false;
      this.room.round.paused = false;
      this.room.round.endsAt = 0;
      this.room.round.remainingMs = 0;
      this.room.round.started = true;
      this.room.logs.unshift("현재 경매 되돌리기");
      this.room.logs = this.room.logs.slice(0, 120);
      await this.persist();
      await this.broadcast();
      return json({ ok: true, state: roomPublicState(this.room) });
    }

    if (this.room.round.running || this.room.round.paused) {
      return json({ error: "cannot undo while round is active" }, 409);
    }

    const last = this.room.resolvedHistory.pop();
    if (!last || !last.player) return json({ error: "no recent result to undo" }, 409);

    if (last.type === "sold") {
      const team = this.room.teams.find((entry) => entry.id === last.teamId);
      if (team) {
        for (let i = team.players.length - 1; i >= 0; i -= 1) {
          const candidate = team.players[i];
          if (normalizeName(candidate.name) === normalizeName(last.player.name)) {
            team.players.splice(i, 1);
            break;
          }
        }
        team.points += Number(last.amount || 0);
      }
    } else {
      for (let i = this.room.queue.length - 1; i >= 0; i -= 1) {
        const candidate = this.room.queue[i];
        if (normalizeName(candidate.name) === normalizeName(last.player.name)) {
          this.room.queue.splice(i, 1);
          break;
        }
      }
    }

    this.room.current = last.player;
    this.room.bids = {};
    this.room.round.running = false;
    this.room.round.paused = false;
    this.room.round.endsAt = 0;
    this.room.round.remainingMs = 0;
    this.room.round.started = true;
    this.room.logs.unshift("직전 낙찰/유찰 되돌리기");
    this.room.logs = this.room.logs.slice(0, 120);
    await this.persist();
    await this.broadcast();
    return json({ ok: true, state: roomPublicState(this.room) });
  }

  async connectWebSocket(request) {
    if (!this.room) return json({ error: "room not initialized" }, 404);
    const session = this.sessionFromRequest(request);
    if (!session) return json({ error: "invalid session" }, 403);

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    server.send(JSON.stringify({ type: "state", state: roomPublicState(this.room) }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (url.pathname === "/init" && method === "POST") return this.initRoom(request);
    if (!this.room) return json({ error: "room not initialized" }, 404);
    if (url.pathname === "/state" && method === "GET") return json({ ok: true, state: roomPublicState(this.room) });
    if (url.pathname === "/join" && method === "POST") return this.joinCaptain(request);
    if (url.pathname === "/add-roster" && method === "POST") return this.addRoster(request);
    if (url.pathname === "/start-round" && method === "POST") return this.startRound(request);
    if (url.pathname === "/bid" && method === "POST") return this.placeBid(request);
    if (url.pathname === "/finish-round" && method === "POST") return this.finishRound(request);
    if (url.pathname === "/pause-round" && method === "POST") return this.togglePauseRound(request);
    if (url.pathname === "/restart-auction" && method === "POST") return this.restartAuction(request);
    if (url.pathname === "/undo-round" && method === "POST") return this.undoCurrentRound(request);
    if (url.pathname === "/leave" && method === "POST") return this.leaveCaptain(request);
    if (url.pathname === "/ws" && request.headers.get("upgrade") === "websocket") return this.connectWebSocket(request);
    return json({ error: "not found" }, 404);
  }

  async alarm() {
    if (!this.room || !this.room.round.running) return;
    if (Date.now() < this.room.round.endsAt) return;
    await this.finishRound(new Request("https://dummy.invalid/internal", { method: "POST" }), "timer");
  }

  webSocketMessage() {
    // no-op; writes are handled via HTTP APIs.
  }
}

async function forwardToRoom(env, roomCode, request, doPath) {
  const id = env.AUCTION_ROOM.idFromName(roomCode);
  const stub = env.AUCTION_ROOM.get(id);
  const targetUrl = new URL(request.url);
  targetUrl.pathname = doPath;
  const proxied = new Request(targetUrl.toString(), request);
  return stub.fetch(proxied);
}

function roomCodeValid(code) {
  return /^[A-Z0-9]{4,10}$/.test(code);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin") || "*";

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), origin);
    }

    if (!url.pathname.startsWith("/api/auction/")) {
      return withCors(
        json({
          ok: true,
          service: "auction-backend",
          routes: [
            "POST /api/auction/rooms/create",
            "POST /api/auction/rooms/:code/join",
            "GET /api/auction/rooms/:code/state",
            "POST /api/auction/rooms/:code/roster",
            "POST /api/auction/rooms/:code/start",
            "POST /api/auction/rooms/:code/bid",
            "POST /api/auction/rooms/:code/finish",
            "POST /api/auction/rooms/:code/pause",
            "POST /api/auction/rooms/:code/restart",
            "POST /api/auction/rooms/:code/undo",
            "POST /api/auction/rooms/:code/leave",
            "GET /api/auction/rooms/:code/ws?session=...",
          ],
        }),
        origin,
      );
    }

    if (url.pathname === "/api/auction/rooms/create" && request.method === "POST") {
      const body = (await readJson(request)) || {};
      let roomCode = "";
      let attempts = 0;
      while (!roomCode && attempts < 8) {
        attempts += 1;
        const candidate = makeCode();
        const id = env.AUCTION_ROOM.idFromName(candidate);
        const stub = env.AUCTION_ROOM.get(id);
        const existing = await stub.fetch("https://room/state");
        if (existing.status === 404) roomCode = candidate;
      }
      if (!roomCode) return withCors(json({ error: "failed to allocate room code" }, 500), origin);

      const initReq = new Request("https://room/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomCode,
          hostName: body.hostName || "방장",
        }),
      });
      const initRes = await forwardToRoom(env, roomCode, initReq, "/init");
      return withCors(initRes, origin);
    }

    const roomCode = parseRoomCodeFromPath(url.pathname);
    if (!roomCodeValid(roomCode)) return withCors(json({ error: "invalid room code" }, 400), origin);

    if (url.pathname.endsWith(`/${roomCode}/join`) && request.method === "POST") {
      const res = await forwardToRoom(env, roomCode, request, "/join");
      return withCors(res, origin);
    }
    if (url.pathname.endsWith(`/${roomCode}/state`) && request.method === "GET") {
      const res = await forwardToRoom(env, roomCode, request, "/state");
      return withCors(res, origin);
    }
    if (url.pathname.endsWith(`/${roomCode}/roster`) && request.method === "POST") {
      const res = await forwardToRoom(env, roomCode, request, "/add-roster");
      return withCors(res, origin);
    }
    if (url.pathname.endsWith(`/${roomCode}/start`) && request.method === "POST") {
      const res = await forwardToRoom(env, roomCode, request, "/start-round");
      return withCors(res, origin);
    }
    if (url.pathname.endsWith(`/${roomCode}/bid`) && request.method === "POST") {
      const res = await forwardToRoom(env, roomCode, request, "/bid");
      return withCors(res, origin);
    }
    if (url.pathname.endsWith(`/${roomCode}/finish`) && request.method === "POST") {
      const res = await forwardToRoom(env, roomCode, request, "/finish-round");
      return withCors(res, origin);
    }
    if (url.pathname.endsWith(`/${roomCode}/pause`) && request.method === "POST") {
      const res = await forwardToRoom(env, roomCode, request, "/pause-round");
      return withCors(res, origin);
    }
    if (url.pathname.endsWith(`/${roomCode}/restart`) && request.method === "POST") {
      const res = await forwardToRoom(env, roomCode, request, "/restart-auction");
      return withCors(res, origin);
    }
    if (url.pathname.endsWith(`/${roomCode}/undo`) && request.method === "POST") {
      const res = await forwardToRoom(env, roomCode, request, "/undo-round");
      return withCors(res, origin);
    }
    if (url.pathname.endsWith(`/${roomCode}/leave`) && request.method === "POST") {
      const res = await forwardToRoom(env, roomCode, request, "/leave");
      return withCors(res, origin);
    }
    if (url.pathname.endsWith(`/${roomCode}/ws`) && request.headers.get("upgrade") === "websocket") {
      const res = await forwardToRoom(env, roomCode, request, "/ws");
      return withCors(res, origin);
    }

    return withCors(json({ error: "not found" }, 404), origin);
  },
};
