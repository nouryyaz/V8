// Shop page: builds the product cards from data/products.json.
// (The Sessions page now has its own script, booking.js.)

async function loadJSON(path) {
  const response = await fetch(path);
  return response.json();
}

async function showProducts() {
  const box = document.getElementById("products");
  if (!box) return;
  const products = await loadJSON("data/products.json");
  box.innerHTML = products.map(p => `
    <div class="card">
      <img src="${p.image}" alt="${p.name}">
      <h3>${p.name}</h3>
      <p>${p.description}</p>
      <p class="price">${p.price}</p>
      ${p.inStock
        ? `<a class="btn" href="${p.stripeLink}">Buy securely</a>`
        : `<p><strong>Sold out</strong></p>`}
    </div>
  `).join("");
}

showProducts();
