const express = require("express");
const cookieParser = require("cookie-parser");
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

const sessions = new Map();
const guildRoleCache = new Map();

const app = express();

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.static(root));

// --- Helpers ---
function getSession(req) {
  const sessionId = req.cookies.panama_session;
  if (!sessionId) return null;
  return sessions.get(sessionId) || null;
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
      }
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

// --- HTML Page Routes ---
app.get("/", (req, res) => {
  res.sendFile(path.join(root, "index.html"));
});

app.get("/laws", (req, res) => {
  res.sendFile(path.join(root, "laws.html"));
});

app.get("/government-structure", (req, res) => {
  res.sendFile(path.join(root, "government-structure.html"));
});

app.get("/profile", (req, res) => {
  if (!getSession(req)) return res.redirect("/");
  res.sendFile(path.join(root, "profile.html"));
});

// --- API Routes ---
app.get("/api/me", (req, res) => {
  const session = getSession(req);
  res.json({
    authenticated: Boolean(session),
    user: session ? sessionToProfile(session) : null,
  });
});

app.get("/api/profile", async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "Not authenticated." });

  try {
    const profile = sessionToProfile(session);
    const member = await fetchDiscordGuildMember(profile.id);
    const roles = member ? await fetchDiscordGuildRoles() : [];
    const roleIds = member?.roles || [];
    const resolvedRoles = roles
        .filter((role) => roleIds.includes(role.id))
        .map((role) => ({ id: role.id, name: role.name, color: role.color }));

    res.json({
      user: profile,
      guild: {
        id: discordGuildId || null,
        member: Boolean(member),
        roles: resolvedRoles,
        hasNationRole: discordNationRoleId ? roleIds.includes(discordNationRoleId) : null,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load profile." });
  }
});

// --- Auth Routes ---
app.get("/logout", (req, res) => {
  const secure = req.headers["x-forwarded-proto"] === "https";
  res.clearCookie("panama_session", { path: "/", sameSite: "Lax", secure });
  res.clearCookie("panama_oauth_state", { path: "/", sameSite: "Lax", secure });
  res.redirect("/");
});

app.get("/auth/discord", (req, res) => {
  if (!discordClientId || !discordClientSecret) {
    return res.status(500).json({ error: "Discord OAuth is not configured." });
  }

  const secure = req.headers["x-forwarded-proto"] === "https";
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

  res.cookie("panama_oauth_state", state, { maxAge: 10 * 60 * 1000, httpOnly: true, sameSite: "Lax", secure });
  res.redirect(authorizeUrl.toString());
});

app.get("/auth/discord/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    const expectedState = req.cookies.panama_oauth_state;
    const secure = req.headers["x-forwarded-proto"] === "https";

    if (!code || !state || !expectedState || state !== expectedState) {
      return res.status(400).json({ error: "Invalid OAuth callback state." });
    }

    const tokenData = await exchangeDiscordCode(code);
    const user = await fetchDiscordUser(tokenData.access_token);
    const sessionId = crypto.randomUUID();

    sessions.set(sessionId, {
      user: {
        id: user.id,
        username: user.username,
        global_name: user.global_name || null,
        avatar: user.avatar || null,
        discriminator: user.discriminator || null,
      },
      tokenData,
      createdAt: Date.now(),
    });

    res.cookie("panama_session", sessionId, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: "Lax", secure });
    res.clearCookie("panama_oauth_state", { path: "/", sameSite: "Lax", secure });
    res.redirect("/profile");
  } catch (error) {
    res.status(500).json({ error: "Discord OAuth callback failed." });
  }
});

// Fallback: If no explicit route matches and no static file exists
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(root, "index.html"));
});

// Start Server
app.listen(port, () => {
  console.log(`Express site running at http://localhost:${port}`);
});