/* ═══════════════════════════════════════════
   SIGBM — Sistema Integrado de Gestão do Bombeiro Militar
   app.js — Versão Completa
═══════════════════════════════════════════ */

// ─── ESTADO GLOBAL ─────────────────────────
let currentUser = null;
let demands = [];
let editingDemandId = null;
let charts = {};
let sidebarOpen = false;
let currentPeriod = 'mensal';

// Paginação
let currentPage = 1;
let pageSize = 10;
let sortCol = 'date';
let sortDir = 'desc';
let filteredDemands = [];

// ─── USUÁRIOS ──────────────────────────────
const USERS = {
    'admin':   { password: 'admin1234',   role: 'administrador', name: 'Maj. Fulano', rank: 'Major' },
    'gerente': { password: 'gerente1234', role: 'gerente',       name: 'Cpt. Ciclano',      rank: 'Capitão' },
    'operador':   { password: 'soldado1234', role: 'operador',      name: 'Sd. Beltrano',       rank: 'Soldado' },
};

// ─── DADOS POR PERÍODO ─────────────────────
const PERIOD_DATA = {
    semanal: {
        labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
        resolved: [8, 14, 11, 18, 15, 6, 3],
        opened:   [10, 12, 9, 20, 13, 7, 2],
        delayed:  [2, 3, 4, 1, 5, 2, 1]
    },
    mensal: {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
        resolved: [45, 62, 78, 55, 80, 70, 90, 85, 76, 92, 68, 74],
        opened:   [50, 65, 72, 60, 88, 75, 95, 80, 82, 88, 71, 79],
        delayed:  [5, 8, 4, 9, 3, 7, 2, 6, 4, 5, 8, 3]
    },
    anual: {
        labels: ['2020', '2021', '2022', '2023', '2024', '2025'],
        resolved: [420, 580, 650, 740, 820, 910],
        opened:   [450, 600, 680, 770, 850, 940],
        delayed:  [40, 55, 38, 62, 45, 35]
    }
};

// ─── INICIALIZAÇÃO ─────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.getElementById('loading').classList.add('hidden');
    }, 1400);

    bindEvents();
    generateDemoData();

    const saved = localStorage.getItem('sigbmUser');
    if (saved) {
        currentUser = JSON.parse(saved);
        setTimeout(showMainApp, 1500);
    }
});

// ─── EVENTOS ───────────────────────────────
function bindEvents() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('btnMenuOpen').addEventListener('click', openSidebar);
    document.getElementById('btnSidebarClose').addEventListener('click', closeSidebar);
    document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('btnSync').addEventListener('click', () => {
        showNotification('Sincronização em tempo real ativa!', 'success');
    });
    document.getElementById('notifBtn').addEventListener('click', () => {
        showNotification('5 novas notificações não lidas.', 'info');
    });

    // Navegação
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.page, link.querySelector('i').nextSibling.textContent.trim());
            if (window.innerWidth < 1024) closeSidebar();
        });
    });

    // Filtros de demandas
    document.getElementById('searchDemand').addEventListener('input', debounce(applyFilters, 300));
    document.getElementById('filterStatus').addEventListener('change', applyFilters);
    document.getElementById('filterPriority').addEventListener('change', applyFilters);
    document.getElementById('filterSector').addEventListener('change', applyFilters);

    // Form de demanda
    document.getElementById('demandForm').addEventListener('submit', saveDemand);
    document.getElementById('demandModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('demandModal')) closeDemandModal();
    });
    document.getElementById('drilldownModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('drilldownModal')) closeDrilldown();
    });
    document.getElementById('demandDetailModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('demandDetailModal')) closeDemandDetail();
    });

    // Ordenação
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => sortTable(th.dataset.col));
    });

    // Filtros de período
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPeriod = btn.dataset.period;
            updateAllCharts();
        });
    });
}

// ─── SIDEBAR ───────────────────────────────
function openSidebar() {
    sidebarOpen = true;
    document.getElementById('sidebar').classList.add('active');
    document.getElementById('sidebarOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closeSidebar() {
    sidebarOpen = false;
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('sidebarOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

// ─── LOGIN ─────────────────────────────────
function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorEl  = document.getElementById('loginError');
    const formWrap = document.querySelector('.login-form-wrap');

    if (USERS[username] && USERS[username].password === password) {
        currentUser = USERS[username];
        localStorage.setItem('sigbmUser', JSON.stringify(currentUser));
        errorEl.classList.remove('show');
        showMainApp();
    } else {
        errorEl.classList.add('show');
        formWrap.classList.add('shake');
        setTimeout(() => formWrap.classList.remove('shake'), 600);
    }
}

// ─── MOSTRAR APP ───────────────────────────
function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    updateUserInfo();
    updateAdminVisibility();
    applyFilters();
    initAllCharts();
    updateDashboard();
    startRealTimeUpdates();
}

function updateUserInfo() {
    setText('sidebarUserName', currentUser.name);
    setText('sidebarUserRole', currentUser.role.toUpperCase());
    setText('headerUserName', currentUser.name);
    setText('headerUserRole', currentUser.rank);
}
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ─── NAVEGAÇÃO ─────────────────────────────
function navigateTo(page, label) {
    document.querySelectorAll('.nav-link[data-page]').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (activeLink) activeLink.classList.add('active');

    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const target = document.getElementById(page + 'Page');
    if (target) target.style.display = 'block';

    const titleEl = document.getElementById('pageTitle');
    if (titleEl && label) titleEl.textContent = label;

    // Mostrar/ocultar filtro de período
    const periodFilter = document.getElementById('periodFilter');
    if (periodFilter) {
        periodFilter.style.display = (page === 'dashboard' || page === 'relatorios') ? 'flex' : 'none';
    }

    if (page === 'demandas') { currentPage = 1; applyFilters(); }
    if (page === 'dashboard') updateDashboard();
    if (page === 'relatorios') initRelatoriosCharts();
}

// ─── DADOS DEMO ─────────────────────────────
function generateDemoData() {
    const ranks    = ['Sd.', 'CB', '3º Sgt.', '2º Sgt.', '1º Sgt.', 'SubTen.', '1º Ten.', 'Cpt.', 'Maj.'];
    const names    = ['João Silva', 'Maria Santos', 'Pedro Costa', 'Ana Oliveira', 'Carlos Lima', 'Fernanda Souza', 'Roberto Melo', 'Tatiane Cruz'];
    const matriculas = ['11234', '22345', '33456', '44567', '55678', '66789', '77890', '88901'];
    const types    = ['Transferência', 'Classificação', 'Proc. Administrativo', 'Documentação', 'Reserva', 'Licença', 'Promoção'];
    const sectors  = ['operacional', 'administrativo', 'logistica', 'juridico', 'saude'];
    const statuses = ['pendente', 'concluida', 'pendente', 'urgente', 'atrasada'];
    const priorities = ['baixa', 'media', 'media', 'alta'];

    for (let i = 1; i <= 80; i++) {
        const rank = pick(ranks);
        const name = pick(names);
        const mat  = pick(matriculas);
        demands.push({
            id: i,
            title: `${pick(types)} #${i}`,
            military: `${rank} ${name}`,
            matricula: mat,
            sector: pick(sectors),
            priority: pick(priorities),
            status: pick(statuses),
            date: randomDate(60),
            deadline: randomDate(-15),
            tags: pick(['transferencia, urgente', 'juridico, critico', 'processo judicial', 'urgente', 'rotina']),
            notes: `Demanda nº ${i} registrada automaticamente para demonstração do sistema. Acompanhar prazo de resolução.`
        });
    }
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomDate(days) {
    const d = new Date(Date.now() - Math.random() * Math.abs(days) * 86400000);
    if (days < 0) d.setDate(d.getDate() + Math.abs(days));
    return d.toISOString().split('T')[0];
}

// ─── DASHBOARD ─────────────────────────────
function updateDashboard() {
    const pendentes = demands.filter(d => d.status === 'pendente').length;
    const urgentes  = demands.filter(d => d.status === 'urgente').length;
    setText('totalEfetivo', '1.247');
    setText('demandasPendentes', pendentes);
    setText('transferenciasPendentes', Math.floor(pendentes / 2));
    setText('processosAtivos', urgentes);
    renderRecentDemands();
}

function renderRecentDemands() {
    const recent = [...demands].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
    document.getElementById('recentDemands').innerHTML = recent.map(d => `
        <tr class="${getRowHighlightClass(d)}" style="cursor:pointer" onclick="openDemandDetail(${d.id})">
            <td><span class="demand-title-cell">${d.title}</span></td>
            <td>${d.military}</td>
            <td><span class="badge ${d.priority}">${d.priority}</span></td>
            <td><span class="badge ${d.status}">${d.status}</span></td>
        </tr>
    `).join('');
}

function getRowHighlightClass(d) {
    if (d.status === 'urgente') return 'row-urgente';
    if (d.status === 'atrasada') return 'row-atrasada';
    if (d.priority === 'alta') return 'row-alta';
    if (d.tags && (d.tags.includes('judicial') || d.tags.includes('critico'))) return 'row-critico';
    return '';
}

// ─── FILTROS E TABELA ──────────────────────
function applyFilters() {
    const term     = (document.getElementById('searchDemand')?.value || '').toLowerCase();
    const status   = document.getElementById('filterStatus')?.value || '';
    const priority = document.getElementById('filterPriority')?.value || '';
    const sector   = document.getElementById('filterSector')?.value || '';

    filteredDemands = demands.filter(d => {
        const matchTerm = !term || 
            d.title.toLowerCase().includes(term) ||
            d.military.toLowerCase().includes(term) ||
            (d.matricula && d.matricula.includes(term)) ||
            (d.sector && d.sector.toLowerCase().includes(term)) ||
            (d.tags && d.tags.toLowerCase().includes(term));
        const matchStatus   = !status   || d.status   === status;
        const matchPriority = !priority || d.priority === priority;
        const matchSector   = !sector   || d.sector   === sector;
        return matchTerm && matchStatus && matchPriority && matchSector;
    });

    // Ordenar
    filteredDemands.sort((a, b) => {
        let va = a[sortCol] ?? '';
        let vb = b[sortCol] ?? '';
        if (sortCol === 'id') { va = +va; vb = +vb; }
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    renderActiveFilterTags(term, status, priority, sector);
    currentPage = 1;
    renderDemandsPage();
    renderPagination();
}

function clearFilters() {
    document.getElementById('searchDemand').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterPriority').value = '';
    document.getElementById('filterSector').value = '';
    applyFilters();
}

function renderActiveFilterTags(term, status, priority, sector) {
    const container = document.getElementById('activeFilters');
    if (!container) return;
    const tags = [];
    if (term)     tags.push(`<span class="filter-tag">Busca: "${term}" <button onclick="clearSearch()">×</button></span>`);
    if (status)   tags.push(`<span class="filter-tag">Status: ${status} <button onclick="clearFilter('filterStatus')">×</button></span>`);
    if (priority) tags.push(`<span class="filter-tag">Prioridade: ${priority} <button onclick="clearFilter('filterPriority')">×</button></span>`);
    if (sector)   tags.push(`<span class="filter-tag">Setor: ${sector} <button onclick="clearFilter('filterSector')">×</button></span>`);
    container.innerHTML = tags.join('');
}

function clearSearch() {
    document.getElementById('searchDemand').value = '';
    applyFilters();
}
function clearFilter(id) {
    document.getElementById(id).value = '';
    applyFilters();
}

// ─── ORDENAÇÃO ─────────────────────────────
function sortTable(col) {
    if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        sortCol = col;
        sortDir = 'asc';
    }

    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.col === col) th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    });

    applyFilters();
}

// ─── RENDERIZAR DEMANDAS ───────────────────
function renderDemandsPage() {
    const start = (currentPage - 1) * pageSize;
    const end   = start + pageSize;
    const page  = filteredDemands.slice(start, end);

    document.getElementById('demandsTable').innerHTML = page.map(d => `
        <tr class="${getRowHighlightClass(d)}">
            <td>${d.id}</td>
            <td style="cursor:pointer;font-weight:600" onclick="openDemandDetail(${d.id})">${d.title}</td>
            <td>${d.military}</td>
            <td><span class="sector-badge sector-${d.sector}">${formatSector(d.sector)}</span></td>
            <td><span class="badge ${d.priority}">${d.priority}</span></td>
            <td><span class="badge ${d.status}">${d.status}</span></td>
            <td>${formatDate(d.date)}</td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-ghost btn-sm" title="Ver detalhes" onclick="openDemandDetail(${d.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-primary btn-sm" title="Editar" onclick="openDemandModal(${d.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" title="Excluir" onclick="deleteDemand(${d.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    const info = document.getElementById('paginationInfo');
    if (info) {
        const total = filteredDemands.length;
        info.textContent = `Exibindo ${Math.min(start+1,total)}–${Math.min(end,total)} de ${total} registros`;
    }
}

function renderPagination() {
    const total = Math.ceil(filteredDemands.length / pageSize);
    const container = document.getElementById('pagination');
    if (!container) return;
    let html = '';

    html += `<button class="page-btn" ${currentPage===1?'disabled':''} onclick="goPage(${currentPage-1})"><i class="fas fa-chevron-left"></i></button>`;

    const range = [];
    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= currentPage-2 && i <= currentPage+2)) {
            range.push(i);
        } else if (range[range.length-1] !== '…') {
            range.push('…');
        }
    }

    range.forEach(p => {
        if (p === '…') {
            html += `<span class="page-dots">…</span>`;
        } else {
            html += `<button class="page-btn ${p===currentPage?'active':''}" onclick="goPage(${p})">${p}</button>`;
        }
    });

    html += `<button class="page-btn" ${currentPage===total?'disabled':''} onclick="goPage(${currentPage+1})"><i class="fas fa-chevron-right"></i></button>`;
    container.innerHTML = html;
}

function goPage(p) {
    const total = Math.ceil(filteredDemands.length / pageSize);
    if (p < 1 || p > total) return;
    currentPage = p;
    renderDemandsPage();
    renderPagination();
}

function changePageSize(val) {
    pageSize = parseInt(val);
    currentPage = 1;
    renderDemandsPage();
    renderPagination();
}

// ─── DETALHE DEMANDA ───────────────────────
function openDemandDetail(id) {
    const d = demands.find(x => x.id === id);
    if (!d) return;
    document.getElementById('demandDetailBody').innerHTML = `
        <div class="detail-grid">
            <div class="detail-row"><span class="detail-label">ID</span><span class="detail-val">#${d.id}</span></div>
            <div class="detail-row"><span class="detail-label">Título</span><span class="detail-val">${d.title}</span></div>
            <div class="detail-row"><span class="detail-label">Militar</span><span class="detail-val">${d.military}</span></div>
            <div class="detail-row"><span class="detail-label">Matrícula</span><span class="detail-val">${d.matricula || '—'}</span></div>
            <div class="detail-row"><span class="detail-label">Setor</span><span class="detail-val"><span class="sector-badge sector-${d.sector}">${formatSector(d.sector)}</span></span></div>
            <div class="detail-row"><span class="detail-label">Prioridade</span><span class="detail-val"><span class="badge ${d.priority}">${d.priority}</span></span></div>
            <div class="detail-row"><span class="detail-label">Status</span><span class="detail-val"><span class="badge ${d.status}">${d.status}</span></span></div>
            <div class="detail-row"><span class="detail-label">Data</span><span class="detail-val">${formatDate(d.date)}</span></div>
            <div class="detail-row"><span class="detail-label">Prazo Limite</span><span class="detail-val">${d.deadline ? formatDate(d.deadline) : '—'}</span></div>
            <div class="detail-row"><span class="detail-label">Tags</span><span class="detail-val">${d.tags || '—'}</span></div>
            <div class="detail-row detail-row-full"><span class="detail-label">Observações</span><span class="detail-val">${d.notes || '—'}</span></div>
        </div>
        <div class="form-actions" style="margin-top:1.5rem">
            <button class="btn btn-ghost" onclick="closeDemandDetail()">Fechar</button>
            <button class="btn btn-primary" onclick="closeDemandDetail();openDemandModal(${d.id})"><i class="fas fa-edit"></i> Editar</button>
        </div>
    `;
    document.getElementById('demandDetailModal').classList.add('active');
}
function closeDemandDetail() {
    document.getElementById('demandDetailModal').classList.remove('active');
}

// ─── MODAL DEMANDA ─────────────────────────
function openDemandModal(id = null) {
    editingDemandId = id;
    const demand = id ? demands.find(d => d.id === id) : null;
    const icon  = id ? 'fa-edit' : 'fa-plus';
    const title = id ? 'Editar Demanda' : 'Nova Demanda';
    document.getElementById('modalTitle').innerHTML = `<i class="fas ${icon}"></i> ${title}`;

    setValue('demandTitle',    demand?.title    ?? '');
    setValue('demandMilitary', demand?.military ?? '');
    setValue('demandSector',   demand?.sector   ?? '');
    setValue('demandPriority', demand?.priority ?? 'baixa');
    setValue('demandStatus',   demand?.status   ?? 'pendente');
    setValue('demandTags',     demand?.tags     ?? '');
    setValue('demandNotes',    demand?.notes    ?? '');
    setValue('demandDeadline', demand?.deadline ?? '');

    document.getElementById('demandModal').classList.add('active');
}
function closeDemandModal() {
    document.getElementById('demandModal').classList.remove('active');
    document.getElementById('demandForm').reset();
    editingDemandId = null;
}

function saveDemand(e) {
    e.preventDefault();
    const data = {
        title:    getValue('demandTitle'),
        military: getValue('demandMilitary'),
        sector:   getValue('demandSector'),
        priority: getValue('demandPriority'),
        status:   getValue('demandStatus'),
        deadline: getValue('demandDeadline'),
        tags:     getValue('demandTags'),
        notes:    getValue('demandNotes'),
    };

    if (editingDemandId) {
        const idx = demands.findIndex(d => d.id === editingDemandId);
        demands[idx] = { ...demands[idx], ...data };
        showNotification('Demanda atualizada com sucesso!', 'success');
    } else {
        demands.unshift({ id: Date.now(), date: new Date().toISOString().split('T')[0], ...data });
        showNotification('Nova demanda criada com sucesso!', 'success');
    }

    applyFilters();
    updateDashboard();
    closeDemandModal();
}

function deleteDemand(id) {
    if (!confirm('Deseja realmente excluir esta demanda?')) return;
    demands = demands.filter(d => d.id !== id);
    applyFilters();
    updateDashboard();
    showNotification('Demanda excluída permanentemente.', 'error');
}

function getValue(id) { return document.getElementById(id)?.value ?? ''; }
function setValue(id, val) { const el = document.getElementById(id); if (el) el.value = val; }

// ─── DRILL-DOWN ─────────────────────────────
function openDrilldown(title, items) {
    document.getElementById('drilldownTitle').innerHTML = `<i class="fas fa-list-alt"></i> ${title}`;
    
    if (!items || items.length === 0) {
        document.getElementById('drilldownBody').innerHTML = '<p style="color:var(--gray);padding:1rem">Nenhum registro encontrado.</p>';
    } else {
        document.getElementById('drilldownBody').innerHTML = `
            <div class="table-container" style="max-height:60vh;overflow-y:auto">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th><th>Título</th><th>Militar</th><th>Setor</th><th>Prioridade</th><th>Status</th><th>Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(d => `
                            <tr class="${getRowHighlightClass(d)}" style="cursor:pointer" onclick="closeDrilldown();openDemandDetail(${d.id})">
                                <td>${d.id}</td>
                                <td>${d.title}</td>
                                <td>${d.military}</td>
                                <td><span class="sector-badge sector-${d.sector}">${formatSector(d.sector)}</span></td>
                                <td><span class="badge ${d.priority}">${d.priority}</span></td>
                                <td><span class="badge ${d.status}">${d.status}</span></td>
                                <td>${formatDate(d.date)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <p style="color:var(--gray);font-size:0.85rem;margin-top:1rem"><i class="fas fa-info-circle"></i> Clique em uma linha para ver detalhes completos da demanda.</p>
        `;
    }
    document.getElementById('drilldownModal').classList.add('active');
}
function closeDrilldown() {
    document.getElementById('drilldownModal').classList.remove('active');
}

// ─── CHARTS ────────────────────────────────
const CHART_DEFAULTS = {
    animation: { duration: 700, easing: 'easeInOutQuart' },
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: {} } },
    scales: {
        x: { grid: { display: false }, ticks: { color: '#7F8C8D', font: { size: 11 } } },
        y: { grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false }, ticks: { color: '#7F8C8D', font: { size: 11 } }, border: { display: false } }
    }
};

function destroyChart(key) {
    if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

function initAllCharts() {
    buildSectorChart();
    buildDelayedChart();
    buildRankChart('rankChart');
    buildMonthlyChart();
}

function updateAllCharts() {
    buildMonthlyChart();
    buildDelayedChart();
    buildSectorChart();
}

// 🔹 Demandas por Setor — Barras Horizontais
function buildSectorChart() {
    destroyChart('sector');
    const ctx = document.getElementById('sectorChart')?.getContext('2d');
    if (!ctx) return;

    const sectors = ['operacional', 'administrativo', 'logistica', 'juridico', 'saude'];
    const labels  = ['Operacional', 'Administrativo', 'Logística', 'Jurídico', 'Saúde'];
    const data    = sectors.map(s => demands.filter(d => d.sector === s).length);

    charts.sector = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Demandas',
                data,
                backgroundColor: [
                    'rgba(200,16,46,0.85)',
                    'rgba(200,16,46,0.65)',
                    'rgba(200,16,46,0.50)',
                    'rgba(200,16,46,0.38)',
                    'rgba(200,16,46,0.25)'
                ],
                borderColor: '#C8102E',
                borderWidth: 1,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            ...CHART_DEFAULTS,
            indexAxis: 'y',   // barras horizontais
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.raw} demandas`
                    }
                }
            },
            onClick: (evt, els) => {
                if (!els.length) return;
                const idx = els[0].index;
                const sector = sectors[idx];
                const items = demands.filter(d => d.sector === sector);
                openDrilldown(`Demandas — ${labels[idx]}`, items);
            },
            scales: {
                x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#7F8C8D' } },
                y: { grid: { display: false }, ticks: { color: '#4A5568', font: { weight: '600' } } }
            }
        }
    });
}

// 🔹 Demandas Atrasadas — Vermelho intenso
function buildDelayedChart() {
    destroyChart('delayed');
    const ctx = document.getElementById('delayedChart')?.getContext('2d');
    if (!ctx) return;
    const pd = PERIOD_DATA[currentPeriod];

    charts.delayed = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: pd.labels,
            datasets: [{
                label: 'Atrasadas',
                data: pd.delayed,
                backgroundColor: 'rgba(180, 0, 20, 0.88)',
                borderColor: '#8B0000',
                borderWidth: 1,
                borderRadius: 5,
                borderSkipped: false
            }]
        },
        options: {
            ...CHART_DEFAULTS,
            animation: { duration: 800, easing: 'easeOutBounce' },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${ctx.raw} atrasadas` } }
            },
            onClick: (evt, els) => {
                if (!els.length) return;
                const label = pd.labels[els[0].index];
                openDrilldown(`Demandas Atrasadas — ${label}`, demands.filter(d => d.status === 'atrasada'));
            }
        }
    });
}

// 🔹 Efetivo por Posto — Barras Empilhadas
function buildRankChart(canvasId) {
    const key = canvasId;
    destroyChart(key);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    charts[key] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Praças', 'Suboficiais', 'Oficiais Sub.', 'Oficiais Sup.', 'Oficiais Gen.'],
            datasets: [
                {
                    label: 'Ativo',
                    data: [620, 180, 95, 48, 12],
                    backgroundColor: 'rgba(200,16,46,0.80)',
                    borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 },
                    borderSkipped: false
                },
                {
                    label: 'Reserva',
                    data: [120, 40, 28, 15, 4],
                    backgroundColor: 'rgba(200,16,46,0.35)',
                    borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
                    borderSkipped: false
                }
            ]
        },
        options: {
            ...CHART_DEFAULTS,
            animation: { duration: 900, easing: 'easeInOutCubic' },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { color: '#4A5568', font: { size: 11 }, boxWidth: 12 }
                }
            },
            scales: {
                x: { stacked: true, grid: { display: false }, ticks: { color: '#7F8C8D', font: { size: 10 } } },
                y: { stacked: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#7F8C8D' } }
            },
            onClick: (evt, els) => {
                if (!els.length) return;
                const labels = ['Praças', 'Suboficiais', 'Oficiais Subalternos', 'Oficiais Superiores', 'Oficiais Generais'];
                openDrilldown(`Efetivo — ${labels[els[0].index]}`, demands.filter(d => d.sector === 'operacional').slice(0, 5));
            }
        }
    });
}

// 🔹 Desempenho Mensal — Barras Animadas
function buildMonthlyChart() {
    destroyChart('monthly');
    const ctx = document.getElementById('monthlyChart')?.getContext('2d');
    if (!ctx) return;
    const pd = PERIOD_DATA[currentPeriod];

    charts.monthly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: pd.labels,
            datasets: [
                {
                    label: 'Resolvidas',
                    data: pd.resolved,
                    backgroundColor: 'rgba(200,16,46,0.80)',
                    borderColor: '#C8102E',
                    borderWidth: 1,
                    borderRadius: 5,
                    borderSkipped: false
                },
                {
                    label: 'Abertas',
                    data: pd.opened,
                    backgroundColor: 'rgba(200,16,46,0.25)',
                    borderColor: 'rgba(200,16,46,0.5)',
                    borderWidth: 1,
                    borderRadius: 5,
                    borderSkipped: false
                }
            ]
        },
        options: {
            ...CHART_DEFAULTS,
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart',
                delay: (ctx) => ctx.dataIndex * 60
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { color: '#4A5568', font: { size: 11 }, boxWidth: 12 }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${ctx.raw}`
                    }
                }
            },
            onClick: (evt, els) => {
                if (!els.length) return;
                const label = pd.labels[els[0].index];
                const dsLabel = pd.resolved;
                openDrilldown(`Desempenho — ${label}`, demands.slice(0, 8));
            }
        }
    });
}

// ─── RELATÓRIOS CHARTS ─────────────────────
function initRelatoriosCharts() {
    // Atrasos por Setor
    destroyChart('delays');
    const ctx1 = document.getElementById('delaysChart')?.getContext('2d');
    if (ctx1) {
        const sectors = ['operacional', 'administrativo', 'logistica', 'juridico', 'saude'];
        const labels  = ['Operacional', 'Administrativo', 'Logística', 'Jurídico', 'Saúde'];
        const data    = sectors.map(s => demands.filter(d => d.sector === s && d.status === 'atrasada').length);
        charts.delays = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels,
                datasets: [{ label: 'Atrasadas', data, backgroundColor: 'rgba(180,0,20,0.85)', borderRadius: 5 }]
            },
            options: { ...CHART_DEFAULTS, indexAxis: 'y', plugins: { legend: { display: false } } }
        });
    }

    // Efetivo por Posto (relatórios)
    buildRankChart('rankChartRel');
}

// ─── EXPORT PDF ────────────────────────────
function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(200, 16, 46);
    doc.text('SIGBM — RELATÓRIO DE DEMANDAS', 20, 25);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Sistema Integrado de Gestão do Bombeiro Militar', 20, 32);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} | Usuário: ${currentUser.name}`, 20, 39);

    doc.autoTable({
        startY: 48,
        head: [['ID', 'TÍTULO', 'MILITAR', 'SETOR', 'PRIORIDADE', 'STATUS', 'DATA']],
        body: filteredDemands.slice(0, 40).map(d => [
            d.id, d.title, d.military,
            formatSector(d.sector), d.priority.toUpperCase(), d.status.toUpperCase(), formatDate(d.date)
        ]),
        headStyles: { fillColor: [200, 16, 46], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 3.5 },
        alternateRowStyles: { fillColor: [252, 252, 252] }
    });

    doc.save(`sigbm-relatorio-${new Date().toISOString().split('T')[0]}.pdf`);
    showNotification('Relatório PDF exportado com sucesso!', 'success');
}

// ─── NOTIFICAÇÕES ──────────────────────────
function showNotification(message, type = 'info') {
    const icons = { success: 'check-circle', error: 'exclamation-triangle', info: 'info-circle' };
    const colors = { success: '#51CF66', error: '#FF6B6B', info: '#339AF0' };

    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.innerHTML = `
        <div class="notif-row">
            <i class="fas fa-${icons[type] ?? 'info-circle'} notif-icon" style="color:${colors[type]}"></i>
            <span class="notif-msg">${message}</span>
        </div>
        <div class="notif-time">${new Date().toLocaleTimeString('pt-BR')}</div>
    `;
    document.getElementById('notificationsContainer').appendChild(el);
    setTimeout(() => el.remove(), 6000);
}

// ─── LOGOUT ────────────────────────────────
function logout() {
    localStorage.removeItem('sigbmUser');
    currentUser = null;
    closeSidebar();
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'grid';
    document.getElementById('loginForm').reset();
    document.getElementById('loginError').classList.remove('show');
    showNotification('Sessão encerrada. Até logo!', 'info');
}

// ─── VISIBILIDADE ADMIN ─────────────────────
function updateAdminVisibility() {
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = currentUser?.role === 'administrador' ? 'flex' : 'none';
    });
}

// ─── TEMPO REAL ─────────────────────────────
function startRealTimeUpdates() {
    setInterval(() => {
        if (Math.random() > 0.88) {
            demands.unshift({
                id: Date.now(),
                title: `Ocorrência Urgente #${demands.length + 1}`,
                military: 'Cpt. Emergência',
                matricula: '99999',
                sector: 'operacional',
                priority: 'alta',
                status: 'urgente',
                date: new Date().toISOString().split('T')[0],
                tags: 'emergencia, urgente'
            });
            showNotification('Nova demanda URGENTE recebida!', 'error');
            updateDashboard();
        }
    }, 20000);
}

// ─── UTILITÁRIOS ───────────────────────────
function debounce(fn, wait) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function formatSector(s) {
    const map = { operacional: 'Operacional', administrativo: 'Administrativo', logistica: 'Logística', juridico: 'Jurídico', saude: 'Saúde' };
    return map[s] || s;
}
