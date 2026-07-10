const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const contents = fs.readFileSync(filePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(path.join(__dirname, ".env"));

const port = process.env.PORT || 3000;
const root = __dirname;
const discordClientId = process.env.DISCORD_CLIENT_ID || "";
const discordClientSecret = process.env.DISCORD_CLIENT_SECRET || "";
const discordBotToken = process.env.DISCORD_BOT_TOKEN || "";
const discordGuildId = process.env.DISCORD_GUILD_ID || "";
const discordNationRoleId = process.env.DISCORD_NATION_ROLE_ID || "";
const discordRedirectUri =
  process.env.DISCORD_REDIRECT_URI || `http://localhost:${port}/auth/discord/callback`;
const cookieName = "panama_session";
const stateCookieName = "panama_oauth_state";
const sessions = new Map();
const guildRoleCache = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function isSecureRequest(req) {
  return req.headers["x-forwarded-proto"] === "https";
}

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        const key = index >= 0 ? part.slice(0, index) : part;
        const value = index >= 0 ? part.slice(index + 1) : "";
        return [key, decodeURIComponent(value)];
      }),
  );
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push("Path=/");
  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  parts.push("SameSite=Lax");
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function clearCookie(name, secure) {
  return serializeCookie(name, "", { maxAge: 0, secure });
}

function sendJson(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, {
    Location: location,
    ...headers,
  });
  res.end();
}

async function exchangeDiscordCode(code) {
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: discordClientId,
      client_secret: discordClientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: discordRedirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Discord token exchange failed: ${tokenResponse.status}`);
  }

  return tokenResponse.json();
}

async function fetchDiscordUser(accessToken) {
  const response = await fetch("https://discord.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Discord user fetch failed: ${response.status}`);
  }

  return response.json();
}

async function fetchDiscordGuildMember(userId) {
  if (!discordBotToken || !discordGuildId) {
    throw new Error("Discord bot lookup is not configured.");
  }

  const response = await fetch(
    `https://discord.com/api/guilds/${discordGuildId}/members/${userId}`,
    {
      headers: {
        Authorization: `Bot ${discordBotToken}`,
      },
    },
  );

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Discord guild member fetch failed: ${response.status}`);
  }

  return response.json();
}

async function fetchDiscordGuildRoles() {
  if (!discordBotToken || !discordGuildId) {
    throw new Error("Discord bot role lookup is not configured.");
  }

  const cached = guildRoleCache.get(discordGuildId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.roles;
  }

  const response = await fetch(`https://discord.com/api/guilds/${discordGuildId}/roles`, {
    headers: {
      Authorization: `Bot ${discordBotToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Discord guild roles fetch failed: ${response.status}`);
  }

  const roles = await response.json();
  guildRoleCache.set(discordGuildId, {
    roles,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return roles;
}

function send(res, statusCode, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(statusCode, { "Content-Type": contentType });
    res.end(data);
  });
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const sessionId = cookies[cookieName];
  if (!sessionId) return null;
  return sessions.get(sessionId) || null;
}

function createSession(user, tokenData) {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    user,
    tokenData,
    createdAt: Date.now(),
  });
  return sessionId;
}

function sessionToProfile(session) {
  return {
    id: session.user.id,
    username: session.user.username,
    global_name: session.user.global_name,
    avatar: session.user.avatar,
    discriminator: session.user.discriminator,
  };
}

http
  .createServer(async (req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const pathname = urlPath === "/" ? "/index.html" : urlPath;
    const secure = isSecureRequest(req);
    const cookies = parseCookies(req.headers.cookie || "");

    if (pathname === "/api/me") {
      const session = getSession(req);
      sendJson(res, 200, {
        authenticated: Boolean(session),
        user: session ? sessionToProfile(session) : null,
      });
      return;
    }

    if (pathname === "/api/profile") {
      const session = getSession(req);
      if (!session) {
        sendJson(res, 401, { error: "Not authenticated." });
        return;
      }

      try {
        const profile = sessionToProfile(session);
        const member = await fetchDiscordGuildMember(profile.id);
        const roles = member ? await fetchDiscordGuildRoles() : [];
        const roleIds = member?.roles || [];
        const resolvedRoles = roles
          .filter((role) => roleIds.includes(role.id))
          .map((role) => ({
            id: role.id,
            name: role.name,
            color: role.color,
          }));

        sendJson(res, 200, {
          user: profile,
          guild: {
            id: discordGuildId || null,
            member: Boolean(member),
            roles: resolvedRoles,
            hasNationRole: discordNationRoleId
              ? roleIds.includes(discordNationRoleId)
              : null,
          },
        });
      } catch (error) {
        sendJson(res, 500, {
          error: error.message || "Failed to load profile.",
        });
      }
      return;
    }

    if (pathname === "/logout") {
      redirect(res, "/", {
        "Set-Cookie": [
          clearCookie(cookieName, secure),
          clearCookie(stateCookieName, secure),
        ],
      });
      return;
    }

    if (pathname === "/auth/discord") {
      if (!discordClientId || !discordClientSecret) {
        sendJson(res, 500, {
          error: "Discord OAuth is not configured. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET.",
        });
        return;
      }

      const state = crypto.randomBytes(24).toString("hex");
      const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
      authorizeUrl.search = new URLSearchParams({
        response_type: "code",
        client_id: discordClientId,
        scope: "identify",
        state,
        redirect_uri: discordRedirectUri,
        prompt: "consent",
      }).toString();

      redirect(res, authorizeUrl.toString(), {
        "Set-Cookie": serializeCookie(stateCookieName, state, {
          maxAge: 10 * 60,
          secure,
        }),
      });
      return;
    }

    if (pathname === "/auth/discord/callback") {
      try {
        const query = new URL(req.url || "/", "http://localhost").searchParams;
        const code = query.get("code");
        const state = query.get("state");
        const expectedState = cookies[stateCookieName];

        if (!code || !state || !expectedState || state !== expectedState) {
          sendJson(res, 400, { error: "Invalid OAuth callback state." });
          return;
        }

        const tokenData = await exchangeDiscordCode(code);
        const user = await fetchDiscordUser(tokenData.access_token);
        const sessionId = createSession(
          {
            id: user.id,
            username: user.username,
            global_name: user.global_name || null,
            avatar: user.avatar || null,
            discriminator: user.discriminator || null,
          },
          {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || null,
            expires_in: tokenData.expires_in || null,
            scope: tokenData.scope || "identify",
            token_type: tokenData.token_type || "Bearer",
          },
        );

        redirect(res, "/profile", {
          "Set-Cookie": [
            serializeCookie(cookieName, sessionId, {
              maxAge: 7 * 24 * 60 * 60,
              secure,
            }),
            clearCookie(stateCookieName, secure),
          ],
        });
        return;
      } catch (error) {
        sendJson(res, 500, {
          error: "Discord OAuth callback failed.",
        });
        return;
      }
    }

    if (pathname === "/profile") {
      const session = getSession(req);
      if (!session) {
        redirect(res, "/");
        return;
      }

      send(res, 200, path.join(root, "profile.html"));
      return;
    }

    const filePath = path.normalize(path.join(root, pathname));

    if (!filePath.startsWith(root)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (!err && stats.isFile()) {
        send(res, 200, filePath);
        return;
      }

      const indexPath = path.join(root, "index.html");
      send(res, 200, indexPath);
    });
  })
  .listen(port, () => {
    console.log(`Static site running at http://localhost:${port}`);
  });
