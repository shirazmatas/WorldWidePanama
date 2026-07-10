function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function avatarUrl(user) {
  if (!user?.id) return "";
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
  }

  const index = Number(user.discriminator || 0) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

async function loadProfile() {
  const nameEl = document.getElementById("profile-name");
  const handleEl = document.getElementById("profile-handle");
  const avatarEl = document.getElementById("profile-avatar");
  const idEl = document.getElementById("profile-discord-id");
  const roleListEl = document.getElementById("role-list");
  const nationRoleEl = document.getElementById("nation-role");

  if (!nameEl || !handleEl || !avatarEl || !idEl || !roleListEl || !nationRoleEl) {
    return;
  }

  const response = await fetch("/api/profile", { credentials: "same-origin" });
  if (response.status === 401) {
    window.location.href = "/";
    return;
  }

  const data = await response.json();
  if (!response.ok) {
    nationRoleEl.textContent = data.error || "Failed to load profile.";
    return;
  }

  const user = data.user;
  const guild = data.guild;
  const displayName = user.global_name || user.username;
  const avatar = avatarUrl(user);

  nameEl.textContent = displayName;
  handleEl.textContent = `@${user.username}`;
  avatarEl.src = avatar;
  avatarEl.alt = `${displayName} avatar`;
  idEl.textContent = user.id;

  if (guild.member) {
    nationRoleEl.innerHTML = guild.hasNationRole
      ? `<span class="badge success">Nation role verified</span>`
      : `<span class="badge warning">Logged in, but the nation role was not found</span>`;
  } else {
    nationRoleEl.innerHTML = `<span class="badge warning">This Discord account is not in the nation guild</span>`;
  }

  if (!guild.roles.length) {
    roleListEl.innerHTML = `<p class="muted-line">No roles resolved for this account.</p>`;
    return;
  }

  roleListEl.innerHTML = guild.roles
    .map(
      (role) => `
        <div class="role-pill">
          <span class="role-dot" style="background: rgb(${((role.color || 0) >> 16) & 255}, ${((role.color || 0) >> 8) & 255}, ${(role.color || 0) & 255})"></span>
          <span>${escapeHtml(role.name)}</span>
        </div>
      `,
    )
    .join("");
}

loadProfile().catch((error) => {
  const nationRoleEl = document.getElementById("nation-role");
  if (nationRoleEl) {
    nationRoleEl.textContent = error.message || "Failed to load profile.";
  }
});
