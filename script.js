// ======================================================
// DIVINETECH — VERSION CONNECTÉE À SUPABASE
// Tables : clients, computers, sales, maintenance
// ======================================================

const SUPABASE_URL = "https://hnftrfpykucygfsxesho.supabase.co";
const SUPABASE_KEY = "sb_publishable_afV75V7EXnlqmktfn2V9iA_d2Tj3eQS";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const $ = id => document.getElementById(id);

let currentUser = null;
let clientsData = [];
let computersData = [];
let salesData = [];
let maintenanceData = [];

let editingClientId = null;
let editingComputerId = null;

// ------------------------------------------------------
// OUTILS GÉNÉRAUX
// ------------------------------------------------------

function notify(message) {
    const toast = $("toast");
    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;
    toast.style.display = "block";
    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function money(value) {
    return Number(value || 0).toLocaleString("fr-FR") + " F";
}

function tableHTML(headers, rows) {
    if (!rows.length) {
        return `<p class="empty-message">Aucune donnée enregistrée pour le moment.</p>`;
    }

    return `
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>${headers.map(h => `<th>${escapeHTML(h)}</th>`).join("")}</tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr>${row.map(cell => `<td>${cell ?? ""}</td>`).join("")}</tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

async function getConnectedUser() {
    const { data, error } = await supabaseClient.auth.getUser();

    if (error || !data.user) {
        currentUser = null;
        return null;
    }

    currentUser = data.user;
    return data.user;
}

async function loadTable(tableName) {
    const user = await getConnectedUser();

    if (!user) {
        notify("Votre session a expiré. Veuillez vous reconnecter.");
        showScreen("connexion");
        return [];
    }

    const { data, error } = await supabaseClient
        .from(tableName)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

    if (error) {
        notify("Erreur de chargement (" + tableName + ") : " + error.message);
        return [];
    }

    return data || [];
}

function showScreen(id) {
    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.add("hidden");
    });

    const screen = $(id);
    if (screen) screen.classList.remove("hidden");
}

// ------------------------------------------------------
// INSCRIPTION
// ------------------------------------------------------

$("registerForm").addEventListener("submit", async event => {
    event.preventDefault();

    const name = $("registerName").value.trim();
    const phone = $("registerPhone").value.trim();
    const email = $("registerEmail").value.trim().toLowerCase();
    const password = $("registerPassword").value;
    const confirm = $("registerConfirm").value;

    if (password !== confirm) {
        notify("Les mots de passe ne correspondent pas.");
        return;
    }

    const { error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: {
                name,
                phone
            }
        }
    });

    if (error) {
        notify("Erreur : " + error.message);
        return;
    }

    $("registerForm").reset();
    notify("Inscription réussie ! Vérifiez votre boîte e-mail.");
    showScreen("connexion");
});

// ------------------------------------------------------
// CONNEXION
// ------------------------------------------------------

$("loginForm").addEventListener("submit", async event => {
    event.preventDefault();

    const email = $("loginEmail").value.trim().toLowerCase();
    const password = $("loginPassword").value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        notify("Adresse e-mail ou mot de passe incorrect.");
        return;
    }

    currentUser = data.user;

    const userName =
        data.user.user_metadata?.name ||
        data.user.email.split("@")[0];

    $("userWelcome").textContent = "Bienvenue, " + userName;
    $("userInitial").textContent = userName.charAt(0).toUpperCase();

    $("loginForm").reset();
    showScreen("application");
    await showPage("dashboard");
});

async function forgotPassword(event) {
    event.preventDefault();

    const email = $("loginEmail").value.trim().toLowerCase();

    if (!email) {
        notify("Saisissez votre adresse e-mail.");
        return;
    }

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
    });

    if (error) {
        notify("Erreur : " + error.message);
    } else {
        notify("Un lien de réinitialisation a été envoyé par e-mail.");
    }
}

async function logout() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        notify("Erreur de déconnexion : " + error.message);
        return;
    }

    currentUser = null;
    clientsData = [];
    computersData = [];
    salesData = [];
    maintenanceData = [];
    editingClientId = null;
    editingComputerId = null;

    showScreen("accueil");
}

// ------------------------------------------------------
// NAVIGATION
// ------------------------------------------------------

async function showPage(page) {
    const titles = {
        dashboard: "Tableau de bord",
        clients: "Gestion des clients",
        ordinateurs: "Gestion des ordinateurs",
        ventes: "Gestion des ventes",
        maintenance: "Suivi de maintenance",
        stocks: "Gestion des stocks"
    };

    if ($("pageTitle")) {
        $("pageTitle").textContent = titles[page] || "Divinetech";
    }

    document.querySelectorAll(".nav-btn").forEach(button => {
        button.classList.remove("active");
    });

    const activeButton = [...document.querySelectorAll(".nav-btn")]
        .find(button => (button.getAttribute("onclick") || "").includes(page));

    if (activeButton) activeButton.classList.add("active");

    if (page === "dashboard") await renderDashboard();
    if (page === "clients") await renderClients();
    if (page === "ordinateurs") await renderOrdinateurs();
    if (page === "ventes") await renderVentes();
    if (page === "maintenance") await renderMaintenance();
    if (page === "stocks") await renderStocks();
}

// ------------------------------------------------------
// TABLEAU DE BORD
// ------------------------------------------------------

async function renderDashboard() {
    const [clients, computers, sales, maintenance] = await Promise.all([
        loadTable("clients"),
        loadTable("computers"),
        loadTable("sales"),
        loadTable("maintenance")
    ]);

    clientsData = clients;
    computersData = computers;
    salesData = sales;
    maintenanceData = maintenance;

    const revenue = sales.reduce((sum, sale) => {
        return sum + Number(sale.total || 0);
    }, 0);

    $("pageContent").innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><p>Clients</p><h3>${clients.length}</h3></div>
            <div class="stat-card"><p>Ordinateurs</p><h3>${computers.length}</h3></div>
            <div class="stat-card"><p>Ventes</p><h3>${sales.length}</h3></div>
            <div class="stat-card"><p>Maintenances</p><h3>${maintenance.length}</h3></div>
            <div class="stat-card"><p>Chiffre d'affaires</p><h3>${money(revenue)}</h3></div>
        </div>
        <div class="panel">
            <h3>Bienvenue dans Divinetech</h3>
            <p>Gérez vos clients, vos ordinateurs, vos ventes, vos stocks et vos interventions depuis un seul espace.</p>
        </div>
    `;
}

// ------------------------------------------------------
// CLIENTS
// ------------------------------------------------------

async function renderClients() {
    clientsData = await loadTable("clients");

    const selected = editingClientId
        ? clientsData.find(client => client.id === editingClientId)
        : null;

    $("pageContent").innerHTML = `
        <div class="data-form">
            <h3>${selected ? "Modifier le client" : "Ajouter un client"}</h3>

            <form id="clientForm">
                <input id="clientName" placeholder="Nom complet"
                    value="${escapeHTML(selected?.name || "")}" required>

                <input id="clientPhone" placeholder="Téléphone"
                    value="${escapeHTML(selected?.phone || "")}" required>

                <input id="clientService" placeholder="Service ou remarque"
                    value="${escapeHTML(selected?.service || "")}">

                <button class="action-btn" type="submit">
                    ${selected ? "Enregistrer les modifications" : "Enregistrer"}
                </button>

                ${selected ? `
                    <button type="button" class="danger-btn"
                        onclick="cancelEditClient()">Annuler</button>
                ` : ""}
            </form>
        </div>

        <div class="panel">
            <h3>Liste des clients</h3>
            ${tableHTML(
                ["Nom", "Téléphone", "Service", "Actions"],
                clientsData.map(client => [
                    escapeHTML(client.name),
                    escapeHTML(client.phone),
                    escapeHTML(client.service),
                    `<button class="action-btn" onclick="editClient('${client.id}')">Modifier</button>
                     <button class="danger-btn" onclick="deleteClient('${client.id}')">Supprimer</button>`
                ])
            )}
        </div>
    `;

    $("clientForm").addEventListener("submit", async event => {
        event.preventDefault();

        const user = await getConnectedUser();
        if (!user) return;

        const client = {
            name: $("clientName").value.trim(),
            phone: $("clientPhone").value.trim(),
            service: $("clientService").value.trim()
        };

        let result;

        if (editingClientId) {
            result = await supabaseClient
                .from("clients")
                .update(client)
                .eq("id", editingClientId)
                .eq("user_id", user.id);
        } else {
            result = await supabaseClient
                .from("clients")
                .insert({ ...client, user_id: user.id });
        }

        if (result.error) {
            notify("Erreur : " + result.error.message);
            return;
        }

        editingClientId = null;
        notify("Client enregistré avec succès.");
        await renderClients();
    });
}

async function editClient(id) {
    editingClientId = id;
    await renderClients();
}

async function cancelEditClient() {
    editingClientId = null;
    await renderClients();
}

async function deleteClient(id) {
    if (!confirm("Voulez-vous vraiment supprimer ce client ?")) return;

    const user = await getConnectedUser();
    if (!user) return;

    const { error } = await supabaseClient
        .from("clients")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        notify("Erreur : " + error.message);
        return;
    }

    if (editingClientId === id) editingClientId = null;
    notify("Client supprimé.");
    await renderClients();
}

// ------------------------------------------------------
// ORDINATEURS
// ------------------------------------------------------

async function renderOrdinateurs() {
    computersData = await loadTable("computers");

    const selected = editingComputerId
        ? computersData.find(computer => String(computer.id) === String(editingComputerId))
        : null;

    $("pageContent").innerHTML = `
        <div class="data-form">
            <h3>${selected ? "Modifier un ordinateur" : "Ajouter un ordinateur"}</h3>

            <form id="computerForm">
                <input id="computerName" placeholder="Désignation"
                    value="${escapeHTML(selected?.name || "")}" required>

                <input id="computerBrand" placeholder="Marque"
                    value="${escapeHTML(selected?.brand || "")}" required>

                <input id="computerCondition" placeholder="État (Neuf / Occasion)"
                    value="${escapeHTML(selected?.condition || "")}">

                <input id="computerPrice" type="number" min="0" step="0.01"
                    placeholder="Prix de vente"
                    value="${selected ? selected.price : ""}" required>

                <input id="computerQuantity" type="number" min="0" step="1"
                    placeholder="Quantité"
                    value="${selected ? selected.quantity : ""}" required>

                <button class="action-btn" type="submit">
                    ${selected ? "Enregistrer les modifications" : "Enregistrer"}
                </button>

                ${selected ? `
                    <button type="button" class="danger-btn"
                        onclick="cancelEditComputer()">Annuler</button>
                ` : ""}
            </form>
        </div>

        <div class="panel">
            <h3>Liste des ordinateurs</h3>
            ${tableHTML(
                ["Désignation", "Marque", "État", "Prix", "Quantité", "Action"],
                computersData.map(computer => [
                    escapeHTML(computer.name),
                    escapeHTML(computer.brand),
                    escapeHTML(computer.condition),
                    money(computer.price),
                    computer.quantity,
                    `<button class="action-btn" onclick="editComputer('${computer.id}')">Modifier</button>
                     <button class="danger-btn" onclick="deleteComputer('${computer.id}')">Supprimer</button>`
                ])
            )}
        </div>
    `;

    $("computerForm").addEventListener("submit", async event => {
        event.preventDefault();

        const user = await getConnectedUser();
        if (!user) return;

        const computer = {
            name: $("computerName").value.trim(),
            brand: $("computerBrand").value.trim(),
            condition: $("computerCondition").value.trim(),
            price: Number($("computerPrice").value),
            quantity: Number($("computerQuantity").value)
        };

        if (computer.price < 0 || computer.quantity < 0) {
            notify("Le prix et la quantité ne peuvent pas être négatifs.");
            return;
        }

        let result;

        if (editingComputerId !== null) {
            result = await supabaseClient
                .from("computers")
                .update(computer)
                .eq("id", editingComputerId)
                .eq("user_id", user.id);
        } else {
            result = await supabaseClient
                .from("computers")
                .insert({ ...computer, user_id: user.id });
        }

        if (result.error) {
            notify("Erreur : " + result.error.message);
            return;
        }

        editingComputerId = null;
        notify("Ordinateur enregistré avec succès.");
        await renderOrdinateurs();
    });
}

async function editComputer(id) {
    editingComputerId = id;
    await renderOrdinateurs();
}

async function cancelEditComputer() {
    editingComputerId = null;
    await renderOrdinateurs();
}

async function deleteComputer(id) {
    if (!confirm("Voulez-vous vraiment supprimer cet ordinateur ?")) return;

    const user = await getConnectedUser();
    if (!user) return;

    const { error } = await supabaseClient
        .from("computers")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        notify("Erreur : " + error.message);
        return;
    }

    if (String(editingComputerId) === String(id)) editingComputerId = null;
    notify("Ordinateur supprimé.");
    await renderOrdinateurs();
}

// ------------------------------------------------------
// VENTES
// ------------------------------------------------------

async function renderVentes() {
    const [computers, clients, sales] = await Promise.all([
        loadTable("computers"),
        loadTable("clients"),
        loadTable("sales")
    ]);

    computersData = computers;
    clientsData = clients;
    salesData = sales;

    const options = computers.map(computer => `
        <option value="${computer.id}">
            ${escapeHTML(computer.name)} - ${money(computer.price)}
            (${computer.quantity} en stock)
        </option>
    `).join("");

    const clientOptions = clients.map(client => `
        <option value="${escapeHTML(client.name)}">${escapeHTML(client.name)}</option>
    `).join("");

    $("pageContent").innerHTML = `
        <div class="data-form">
            <h3>Enregistrer une vente</h3>
            <form id="saleForm">
                <select id="saleClient" required>
                    <option value="">Choisir un client</option>${clientOptions}
                </select>

                <select id="saleComputer" required>
                    <option value="">Choisir un ordinateur</option>${options}
                </select>

                <input id="saleQuantity" type="number" min="1" step="1" value="1" required>
                <button class="action-btn" type="submit">Enregistrer la vente</button>
            </form>
        </div>

        <div class="panel">
            <h3>Historique des ventes</h3>
            ${tableHTML(
                ["Client", "Ordinateur", "Quantité", "Total", "Date"],
                sales.map(sale => [
                    escapeHTML(sale.client),
                    escapeHTML(sale.computer),
                    sale.quantity,
                    money(sale.total),
                    escapeHTML(sale.date)
                ])
            )}
        </div>
    `;

    $("saleForm").addEventListener("submit", async event => {
        event.preventDefault();

        const user = await getConnectedUser();
        if (!user) return;

        const computerId = $("saleComputer").value;
        const quantity = Number($("saleQuantity").value);
        const computer = computers.find(item => String(item.id) === String(computerId));

        if (!computer || !Number.isInteger(quantity) || quantity < 1 || quantity > computer.quantity) {
            notify("Stock insuffisant ou quantité incorrecte.");
            return;
        }

        const newQuantity = Number(computer.quantity) - quantity;

        // Mettre à jour le stock
        const stockUpdate = await supabaseClient
            .from("computers")
            .update({ quantity: newQuantity })
            .eq("id", computer.id)
            .eq("user_id", user.id);

        if (stockUpdate.error) {
            notify("Impossible de mettre à jour le stock : " + stockUpdate.error.message);
            return;
        }

        // Enregistrer la vente
        const saleInsert = await supabaseClient
            .from("sales")
            .insert({
                user_id: user.id,
                client: $("saleClient").value,
                computer: computer.name,
                quantity,
                total: Number(computer.price) * quantity
            });

        if (saleInsert.error) {
            // Restaurer le stock si la vente n'a pas pu être enregistrée
            await supabaseClient
                .from("computers")
                .update({ quantity: computer.quantity })
                .eq("id", computer.id)
                .eq("user_id", user.id);

            notify("Vente non enregistrée : " + saleInsert.error.message);
            return;
        }

        notify("Vente enregistrée et stock mis à jour.");
        await renderVentes();
    });
}

// ------------------------------------------------------
// MAINTENANCE
// ------------------------------------------------------

async function renderMaintenance() {
    const [items, clients] = await Promise.all([
        loadTable("maintenance"),
        loadTable("clients")
    ]);

    maintenanceData = items;
    clientsData = clients;

    const options = clients.map(client => `
        <option value="${escapeHTML(client.name)}">${escapeHTML(client.name)}</option>
    `).join("");

    $("pageContent").innerHTML = `
        <div class="data-form">
            <h3>Nouvelle intervention</h3>
            <form id="maintenanceForm">
                <select id="maintenanceClient" required>
                    <option value="">Choisir un client</option>${options}
                </select>

                <input id="maintenanceDevice" placeholder="Appareil" required>
                <input id="maintenanceProblem" placeholder="Problème rencontré" required>
                <input id="maintenanceCost" type="number" min="0" step="0.01" placeholder="Coût">
                <button class="action-btn" type="submit">Enregistrer</button>
            </form>
        </div>

        <div class="panel">
            <h3>Suivi des interventions</h3>
            ${tableHTML(
                ["Client", "Appareil", "Problème", "Statut", "Coût", "Action"],
                items.map(item => [
                    escapeHTML(item.client),
                    escapeHTML(item.device),
                    escapeHTML(item.problem),
                    escapeHTML(item.status),
                    money(item.cost),
                    `<button class="action-btn" onclick="changeMaintenanceStatus('${item.id}')">Changer statut</button>
                     <button class="danger-btn" onclick="deleteMaintenance('${item.id}')">Supprimer</button>`
                ])
            )}
        </div>
    `;

    $("maintenanceForm").addEventListener("submit", async event => {
        event.preventDefault();

        const user = await getConnectedUser();
        if (!user) return;

        const cost = Number($("maintenanceCost").value || 0);
        if (cost < 0) {
            notify("Le coût ne peut pas être négatif.");
            return;
        }

        const { error } = await supabaseClient
            .from("maintenance")
            .insert({
                user_id: user.id,
                client: $("maintenanceClient").value,
                device: $("maintenanceDevice").value.trim(),
                problem: $("maintenanceProblem").value.trim(),
                cost,
                status: "En attente"
            });

        if (error) {
            notify("Erreur : " + error.message);
            return;
        }

        notify("Intervention enregistrée.");
        await renderMaintenance();
    });
}

async function changeMaintenanceStatus(id) {
    const user = await getConnectedUser();
    if (!user) return;

    const item = maintenanceData.find(row => String(row.id) === String(id));
    if (!item) {
        await renderMaintenance();
        notify("Intervention introuvable.");
        return;
    }

    const statuses = ["En attente", "En cours", "Terminé"];
    const current = statuses.indexOf(item.status);
    const nextStatus = statuses[(current + 1) % statuses.length];

    const { error } = await supabaseClient
        .from("maintenance")
        .update({ status: nextStatus })
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        notify("Erreur : " + error.message);
        return;
    }

    notify("Statut mis à jour : " + nextStatus);
    await renderMaintenance();
}

async function deleteMaintenance(id) {
    if (!confirm("Voulez-vous vraiment supprimer cette intervention ?")) return;

    const user = await getConnectedUser();
    if (!user) return;

    const { error } = await supabaseClient
        .from("maintenance")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        notify("Erreur : " + error.message);
        return;
    }

    notify("Intervention supprimée.");
    await renderMaintenance();
}

// ------------------------------------------------------
// STOCKS
// ------------------------------------------------------

async function renderStocks() {
    computersData = await loadTable("computers");

    $("pageContent").innerHTML = `
        <div class="panel">
            <h3>État du stock</h3>
            ${tableHTML(
                ["Ordinateur", "Marque", "Prix", "Quantité", "État du stock"],
                computersData.map(computer => [
                    escapeHTML(computer.name),
                    escapeHTML(computer.brand),
                    money(computer.price),
                    computer.quantity,
                    Number(computer.quantity) === 0
                        ? "Rupture"
                        : Number(computer.quantity) <= 2
                            ? "Stock faible"
                            : "Disponible"
                ])
            )}
        </div>
    `;
}

// ------------------------------------------------------
// MOT DE PASSE : AFFICHER / MASQUER
// ------------------------------------------------------

function togglePassword(inputId, button) {
    const passwordInput = $(inputId);
    if (!passwordInput) return;

    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        button.textContent = "🙈";
        button.title = "Masquer le mot de passe";
    } else {
        passwordInput.type = "password";
        button.textContent = "👁";
        button.title = "Afficher le mot de passe";
    }
}

// ------------------------------------------------------
// SERVICE WORKER
// ------------------------------------------------------

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js")
            .then(() => console.log("Divinetech est prêt à être installé !"))
            .catch(error => console.error("Erreur Service Worker :", error));
    });
}