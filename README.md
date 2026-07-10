# Panama Nation Minecraft Website

Panama Nation is a small Minecraft nation website with a dark, card-based layout and Discord login support. It is built to present the nation clearly through a homepage, a government structure page, a laws page, and a profile area for authenticated players.

## What the site includes

- A homepage with:
  - a short nation overview
  - a server connection button
  - Discord invite/login actions
  - placeholder sections for blog posts, shop listings, and a dynmap embed

- A government structure page that explains the nation’s hierarchy in a constitutional monarchy format.

- A laws page that presents the nation’s law code in a statute-style layout with section numbers and added dates.

- A profile page that shows Discord account data and checks whether the user belongs to the configured nation role in the Discord guild.

## Laws page

The `laws.html` page is the most formal part of the site. It is written like a legal register, with each law displayed as its own card.

The current page structure includes:

- section markers such as `§ 1.01`
- a title for each law
- the date each law was added
- a short description of the rule
- supporting clauses in bullet form

The sample laws currently cover:

- civility and public conduct
- territory and claim protection
- trade standards and pricing
- military use and defense readiness
- amendment and interpretation

This makes the page easy to extend later if you want to add more laws, amend existing ones, or mark sections as repealed.

## Technology

- Node.js HTTP server
- static HTML, CSS, and JavaScript
- Discord OAuth login
- no front-end framework

## Project structure

- `index.html` - homepage
- `laws.html` - nation law code
- `government-structure.html` - government hierarchy page
- `profile.html` - authenticated profile page
- `script.js` - homepage auth and shop UI logic
- `profile.js` - profile page data loading
- `styles.css` - site styling
- `server.js` - static server, routing, and Discord auth flow

## Running locally

1. Install dependencies.

2. Start the server:

   ```bash
   npm start
   ```

3. Open the site in your browser at the local port printed by the server, usually:

   ```text
   http://localhost:3000
   ```

## Environment variables

The server reads configuration from `.env` or the process environment.

Required for Discord login:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`

Optional but recommended for guild role checks:

- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `DISCORD_NATION_ROLE_ID`

Optional:

- `PORT` - defaults to `3000`
- `DISCORD_REDIRECT_URI` - defaults to `http://localhost:<port>/auth/discord/callback`

## Authentication flow

The site uses Discord OAuth for login:

1. The user clicks "Login with Discord".
2. The server redirects to Discord authorization.
3. Discord returns to the callback route.
4. The server exchanges the code for a token.
5. A session cookie is created.
6. The profile page loads Discord user and guild role data.

## Notes

- The site is intentionally styled like a nation portal rather than a generic landing page.
- The homepage uses placeholder content for blog, shop, and dynmap sections, so those can be replaced with live data later.
- The laws page is static HTML and can be edited directly without changing the server code.

