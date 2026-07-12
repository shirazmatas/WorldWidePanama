import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import * as dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Serve the static files from the React build directory
app.use(express.static(path.join(__dirname, "dist")));

// --- Helpers ---
function getSession(req) {
  const sessionId = req.cookies.panama_session;
  return sessionId ? sessions.get(sessionId) || null : null;
}

function sessionToProfile(session) {
  return {
    id: session.user.id,
    username: session.user.username,
    global_name: session.user.global_name,
    avatar: session.user.avatar,
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

// --- Auth Routes ---
app.get("/api/auth/discord", (req, res) => {
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

app.get("/api/auth/discord/callback", async (req, res) => {
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
  res.redirect("/profile");
});

app.get("/api/logout", (req, res) => {
  const secure = req.headers["x-forwarded-proto"] === "https";
  res.clearCookie("panama_session", { path: "/", sameSite: "Lax", secure });
  res.clearCookie("panama_oauth_state", { path: "/", sameSite: "Lax", secure });
  res.redirect("/");
});

// --- Catch-All for React Router ---
// Any route not caught by /api will serve the React app
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});