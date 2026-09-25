const bookingForm = document.querySelector('#bookingForm');
const bookingNote = document.querySelector('#bookingNote');
const toast = document.querySelector('#toast');
const pickupDate = document.querySelector('#pickupDate');
const dropoffDate = document.querySelector('#dropoffDate');
const menuButton = document.querySelector('#menuButton');
const nav = document.querySelector('.desktop-nav');
let adminUnlocked = false;

document.querySelectorAll('.portal-button').forEach((button) => {
  button.addEventListener('click', async () => {
    if (button.dataset.portal === 'adminPortal' && !adminUnlocked) {
      const password = window.prompt('Enter the admin password:');
      if (!password) return;

      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        showToast('Incorrect admin password.');
        return;
      }

      adminUnlocked = true;
    }

    document.querySelectorAll('.portal-button').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('main[id]').forEach((portal) => {
      portal.hidden = portal.id !== button.dataset.portal;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

document.querySelector('#saveFleetButton')?.addEventListener('click', async () => {
  await saveFleetToDatabase();
  showToast('Fleet changes saved successfully.');
});

let savedFleet = {};
const fleetStorageFallback = JSON.parse(localStorage.getItem('driftFleet') || '{}');

function createAdminCarRow(car) {
  const row = document.createElement('div');
  const imageId = `${car.id}-image`;
  row.className = 'admin-car-row';
  row.dataset.carId = car.id;
  row.innerHTML = `<div class="admin-thumb image-upload"><label for="${imageId}"><span class="upload-plus">+</span><span>Car photo</span></label><input id="${imageId}" type="file" accept="image/*"></div><div class="admin-car-name"><label>Car name<div class="admin-input"><input class="admin-name-input" type="text"></div></label><label>Details<div class="admin-input"><input class="admin-details-input" type="text"></div></label></div><label>Seats<div class="admin-input"><input class="admin-seats-input" type="number" min="1"></div></label><label>Price / day<div class="admin-input"><span>₹</span><input type="number" min="0"></div></label><label>Included km<div class="admin-input"><input type="number" min="0"><span>km</span></div></label><button class="row-menu delete-car-button" type="button" aria-label="Delete car">Delete</button>`;
  row.querySelector('.admin-name-input').value = car.name || 'New car';
  row.querySelector('.admin-details-input').value = car.details || 'City';
  row.querySelector('.admin-seats-input').value = car.seats || '4';
  row.querySelectorAll('input[type="number"]')[1].value = car.price || '2000';
  row.querySelectorAll('input[type="number"]')[2].value = car.km || '150';
  return row;
}

async function loadFleetFromDatabase() {
  try {
    const response = await fetch('/api/fleet');
    if (!response.ok) throw new Error('Database load failed');
    const payload = await response.json();
    const cars = payload.cars || [];
    savedFleet = {};
    cars.forEach((car) => {
      savedFleet[car.id] = car;
    });
    const databaseIds = new Set(cars.map((car) => car.id));
    document.querySelectorAll('.admin-car-row[data-car-id]').forEach((row) => {
      if (!databaseIds.has(row.dataset.carId)) {
        document.querySelector(`.car-card[data-car-id="${row.dataset.carId}"]`)?.remove();
        row.remove();
      }
    });
    const adminList = document.querySelector('.admin-car-list');
    cars.forEach((car) => {
      let row = document.querySelector(`.admin-car-row[data-car-id="${car.id}"]`);
      if (!row && adminList) {
        row = createAdminCarRow(car);
        adminList.appendChild(row);
        row.querySelector('.delete-car-button')?.addEventListener('click', () => deleteFleetCar(car.id));
      }
      if (!row) return;
      const nameInput = row.querySelector('.admin-name-input');
      const detailsInput = row.querySelector('.admin-details-input');
      const seatsInput = row.querySelector('.admin-seats-input');
      const numberInputs = Array.from(row.querySelectorAll('input[type="number"]'));
      const priceInput = numberInputs[1] || null;
      const kmInput = numberInputs[2] || null;
      const savedCar = savedFleet[row.dataset.carId] || {};

      if (savedCar.name && nameInput) nameInput.value = savedCar.name;
      if (savedCar.details && detailsInput) detailsInput.value = savedCar.details;
      if (savedCar.seats && seatsInput) seatsInput.value = savedCar.seats;
      if (savedCar.price && priceInput) priceInput.value = savedCar.price;
      if (savedCar.km && kmInput) kmInput.value = savedCar.km;
      syncFleetRow(row);
    });
  } catch (error) {
    savedFleet = fleetStorageFallback;
  }
}

async function saveFleetToDatabase() {
  const rows = Array.from(document.querySelectorAll('.admin-car-row[data-car-id]'));
  const cars = rows.map((row) => {
    const numberInputs = Array.from(row.querySelectorAll('input[type="number"]'));
    const priceInput = numberInputs[1] || null;
    const kmInput = numberInputs[2] || null;

    return {
      id: row.dataset.carId,
      name: row.querySelector('.admin-name-input')?.value || '',
      details: row.querySelector('.admin-details-input')?.value || '',
      seats: row.querySelector('.admin-seats-input')?.value || '',
      price: priceInput ? priceInput.value : '',
      km: kmInput ? kmInput.value : ''
    };
  });

  try {
    const response = await fetch('/api/fleet', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cars })
    });

    if (!response.ok) throw new Error('Failed to save fleet');

    const payload = await response.json();
    savedFleet = {};
    (payload.cars || cars).forEach((car) => {
      savedFleet[car.id] = car;
    });
    localStorage.setItem('driftFleet', JSON.stringify(savedFleet));
  } catch (error) {
    localStorage.setItem('driftFleet', JSON.stringify(savedFleet));
  }
}

async function deleteFleetCar(carId) {
  try {
    const response = await fetch(`/api/fleet/${encodeURIComponent(carId)}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Unable to delete car');
    }

    const row = document.querySelector(`.admin-car-row[data-car-id="${carId}"]`);
    const card = document.querySelector(`.car-card[data-car-id="${carId}"]`);

    if (row) row.remove();
    if (card) card.remove();

    delete savedFleet[carId];
    localStorage.setItem('driftFleet', JSON.stringify(savedFleet));
    showToast('Car deleted from the fleet.');
  } catch (error) {
    console.error(error);
    showToast('The car could not be deleted.');
  }
}

function createUserCarCard(carId) {
  const grid = document.querySelector('#fleet-grid');
  if (!grid) return null;

  const card = document.createElement('article');
  card.className = 'car-card';
  card.dataset.carId = carId;
  card.dataset.type = 'city';
  card.innerHTML = `
    <div class="card-image user-car-placeholder">
      <span class="car-tag quiet">NEW CAR</span>
      <span class="user-image-label">New car</span>
      <span class="heart-view">♡</span>
    </div>
    <div class="card-info">
      <div>
        <h3 class="user-car-name">New car</h3>
        <p class="user-car-details">City / <span class="user-car-seats">4</span> seats</p>
        <span class="km-detail">150 km included / day</span>
      </div>
      <strong>₹2,000 <small>/ day</small></strong>
    </div>
  `;

  grid.appendChild(card);
  return card;
}

function syncFleetRow(row) {
  const userCard = document.querySelector(`.car-card[data-car-id="${row.dataset.carId}"]`) || createUserCarCard(row.dataset.carId);
  const nameInput = row.querySelector('.admin-name-input');
  const detailsInput = row.querySelector('.admin-details-input');
  const seatsInput = row.querySelector('.admin-seats-input');
  const numberInputs = Array.from(row.querySelectorAll('input[type="number"]'));
  const priceInput = numberInputs.find((input) => input !== seatsInput && input.value !== undefined && input.closest('label')?.textContent.includes('Price')) || numberInputs[1];
  const kmInput = numberInputs.find((input) => input !== seatsInput && input !== priceInput) || numberInputs[numberInputs.length - 1];
  const savedCar = savedFleet[row.dataset.carId] || {};

  if (savedCar) {
    nameInput.value = savedCar.name || nameInput.value;
    detailsInput.value = savedCar.details || detailsInput.value;
    seatsInput.value = savedCar.seats || seatsInput.value;
    if (priceInput && savedCar.price) priceInput.value = savedCar.price;
    if (kmInput && savedCar.km) kmInput.value = savedCar.km;
  }

  const updateUserCard = () => {
    if (!userCard) return;
    const safeName = nameInput.value || 'Unnamed car';
    const safeDetails = detailsInput.value || 'Car';
    const safeSeats = seatsInput.value || '0';
    const safePrice = priceInput ? Number(priceInput.value || 0) : 0;
    const safeKm = kmInput ? Number(kmInput.value || 0) : 0;
    const normalizedType = safeDetails.toLowerCase().includes('weekend') ? 'weekend' : 'city';
    const activeFilter = document.querySelector('.fleet-tabs button.active')?.dataset.filter || 'all';

    userCard.dataset.type = normalizedType;
    userCard.style.display = activeFilter === 'all' || normalizedType === activeFilter ? '' : 'none';
    userCard.querySelector('.user-car-name').textContent = safeName;
    userCard.querySelector('.user-image-label').textContent = safeName;
    userCard.querySelector('.user-car-details').innerHTML = `${safeDetails} / <span class="user-car-seats">${safeSeats}</span> seats`;
    userCard.querySelector('.km-detail').textContent = `${safeKm} km included / day`;
    userCard.querySelector('strong').innerHTML = `₹${safePrice.toLocaleString('en-IN')} <small>/ day</small>`;

    savedFleet[row.dataset.carId] = {
      id: row.dataset.carId,
      name: nameInput.value,
      details: detailsInput.value,
      seats: seatsInput.value,
      price: priceInput ? priceInput.value : '',
      km: kmInput ? kmInput.value : ''
    };
    localStorage.setItem('driftFleet', JSON.stringify(savedFleet));
    if (adminUnlocked) {
      void saveFleetToDatabase();
    }
  };

  [nameInput, detailsInput, seatsInput, priceInput, kmInput].filter(Boolean).forEach((input) => {
    input.addEventListener('input', updateUserCard);
  });
  updateUserCard();
}

document.querySelectorAll('.admin-car-row[data-car-id]').forEach(syncFleetRow);
void loadFleetFromDatabase();

function previewUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  const container = input.closest('.image-upload');
  const existingImage = container.querySelector('img');
  const preview = existingImage || document.createElement('img');
  preview.src = URL.createObjectURL(file);
  preview.alt = 'Uploaded car preview';
  if (!existingImage) container.appendChild(preview);
  container.classList.add('has-image');
}

document.addEventListener('change', (event) => {
  if (event.target.matches('.image-upload input[type="file"]')) previewUpload(event.target);
});

document.querySelector('#addCarButton')?.addEventListener('click', () => {
  const carId = `car-${Date.now()}`;
  const imageId = `${carId}-image`;
  const row = document.createElement('div');
  row.className = 'admin-car-row';
  row.dataset.carId = carId;
  row.innerHTML = `<div class="admin-thumb image-upload"><label for="${imageId}"><span class="upload-plus">+</span><span>Car photo</span></label><input id="${imageId}" type="file" accept="image/*"></div><div class="admin-car-name"><label>Car name<div class="admin-input"><input class="admin-name-input" type="text" value="New car"></div></label><label>Details<div class="admin-input"><input class="admin-details-input" type="text" value="City"></div></label></div><label>Seats<div class="admin-input"><input class="admin-seats-input" type="number" value="4" min="1"></div></label><label>Price / day<div class="admin-input"><span>₹</span><input type="number" value="2000" min="0"></div></label><label>Included km<div class="admin-input"><input type="number" value="150" min="0"><span>km</span></div></label><button class="row-menu delete-car-button" type="button" aria-label="Delete new car">Delete</button>`;
  document.querySelector('.admin-car-list').appendChild(row);
  syncFleetRow(row);
  row.querySelector('.delete-car-button')?.addEventListener('click', () => deleteFleetCar(carId));
  row.querySelector('.admin-name-input').focus();
  showToast('New car added. Set its details below.');
});

document.querySelectorAll('.delete-car-button').forEach((button) => {
  const carId = button.closest('.admin-car-row')?.dataset.carId;
  if (carId) {
    button.addEventListener('click', () => deleteFleetCar(carId));
  }
});

const today = new Date().toISOString().split('T')[0];
if (pickupDate && dropoffDate) {
  pickupDate.min = today;
  dropoffDate.min = today;
  pickupDate.addEventListener('change', () => {
    dropoffDate.min = pickupDate.value;
    if (dropoffDate.value && dropoffDate.value < pickupDate.value) dropoffDate.value = pickupDate.value;
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 3500);
}

bookingForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const location = document.querySelector('#location').value.trim();
  const start = new Date(pickupDate.value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const end = new Date(dropoffDate.value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  bookingNote.innerHTML = `Showing the best cars for <strong>${location}</strong> · ${start} — ${end} <span>↗</span>`;
  showToast('Your perfect car is waiting below.');
  document.querySelector('#fleet').scrollIntoView({ behavior: 'smooth' });
});

document.querySelectorAll('.fleet-tabs button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('.fleet-tabs button.active').classList.remove('active');
    button.classList.add('active');
    const filter = button.dataset.filter;
    document.querySelectorAll('.car-card').forEach((card) => {
      const visible = filter === 'all' || card.dataset.type === filter;
      card.style.display = visible ? '' : 'none';
    });
  });
});

document.querySelectorAll('.heart-button').forEach((button) => {
  button.addEventListener('click', () => {
    button.classList.toggle('saved');
    button.textContent = button.classList.contains('saved') ? '♥' : '♡';
  });
});

document.querySelector('#loginButton').addEventListener('click', () => showToast('Member access is coming soon.'));
menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  nav.style.display = isOpen ? '' : 'flex';
  nav.style.position = 'absolute';
  nav.style.top = '73px';
  nav.style.left = '0';
  nav.style.right = '0';
  nav.style.margin = '0';
  nav.style.padding = '22px';
  nav.style.background = 'var(--cream)';
  nav.style.borderBottom = '1px solid var(--line)';
  nav.style.flexDirection = 'column';
  nav.style.gap = '19px';
});
