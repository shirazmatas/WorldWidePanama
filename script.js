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

const feed = document.getElementById("shops");

if (feed) {
  feed.innerHTML = shops
    .map(
      (shop) => `
        <article class="feed-item">
          <div>
            <h3>${shop.name}</h3>
            <p>${shop.owner} · ${shop.item}</p>
          </div>
          <div class="price">${shop.price}</div>
          <p>${shop.note}</p>
        </article>
      `,
    )
    .join("");
}
