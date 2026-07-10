const shops = [
  {
    name: "Sugar Cane Depot",
    owner: "Panama Trade Co.",
    item: "Sugar cane",
    price: "12g / stack",
    note: "High-volume farm goods for builders and traders.",
  },
  {
    name: "Netherite Supplies",
    owner: "Capital Market",
    item: "Ancient debris",
    price: "180g / block",
    note: "Rare materials and late-game gear support.",
  },
  {
    name: "Food Hall",
    owner: "Panama Harbor",
    item: "Golden carrots",
    price: "4g / stack",
    note: "Reliable bulk food for residents and visitors.",
  },
];

const minecraftIp = "shirazmatas.earthmc.net";
const connectButton = document.getElementById("connect-button");
const feed = document.getElementById("shops");
const authSlot = document.getElementById("auth-slot");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

if (feed) {
  feed.innerHTML = shops
    .map(
      (shop) => `
        <article class="feed-item">
          <div>
            <h3>${escapeHtml(shop.name)}</h3>
            <p>${escapeHtml(shop.owner)} · ${escapeHtml(shop.item)}</p>
          </div>
          <div class="price">${escapeHtml(shop.price)}</div>
          <p>${escapeHtml(shop.note)}</p>
        </article>
      `,
    )
    .join("");
}

if (connectButton) {
  connectButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(connectButton.dataset.copyText || minecraftIp);
      const originalLabel = connectButton.textContent;
      connectButton.textContent = "Copied to clipboard";
      setTimeout(() => {
        connectButton.textContent = originalLabel;
      }, 1800);
    } catch {
      window.prompt("Copy this Minecraft server address:", connectButton.dataset.copyText || minecraftIp);
    }
  });
}

function avatarUrl(user) {
  if (!user?.id) return "";
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
  }

  const index = Number(user.discriminator || 0) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

async function refreshAuth() {
  if (!authSlot) return;

  try {
    const response = await fetch("/api/me", { credentials: "same-origin" });
    if (!response.ok) throw new Error("Failed to load auth state");

    const data = await response.json();
    if (!data.authenticated || !data.user) {
      authSlot.innerHTML = `<a class="btn btn-primary" href="/auth/discord">Login with Discord</a>`;
      return;
    }

    const name = data.user.global_name || data.user.username;
    const avatar = avatarUrl(data.user);

    authSlot.innerHTML = `
      <div class="auth-user">
        <img src="${escapeHtml(avatar)}" alt="" />
        <div>
          <strong>${escapeHtml(name)}</strong>
          <small>@${escapeHtml(data.user.username)}</small>
        </div>
        <a class="btn btn-secondary auth-logout" href="/profile">Profile</a>
        <a class="btn btn-secondary auth-logout" href="/logout">Logout</a>
      </div>
    `;
  } catch {
    authSlot.innerHTML = `<a class="btn btn-primary" href="/auth/discord">Login with Discord</a>`;
  }
}

refreshAuth();
