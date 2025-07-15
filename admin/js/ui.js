/**
 * @fileoverview Módulo de Funções de Interface (UI) para o Painel de Admin.
 * Exporta funções para manipulação do DOM e feedback ao utilizador.
 * VERSÃO CORRIGIDA: Lógica do modal de confirmação tornada mais robusta e autónoma.
 */

// Centraliza todos os seletores de elementos do DOM para fácil manutenção.
export const DOMElements = {
    authScreen: document.getElementById('auth-screen'),
    adminPanel: document.getElementById('admin-panel'),
    loginForm: document.getElementById('login-form'),
    logoutButton: document.getElementById('logout-button'),
    productForm: document.getElementById('product-form'),
    productListBody: document.getElementById('product-list-body'),
    authMessage: document.getElementById('auth-message'),
    navLinks: document.querySelectorAll('.admin-nav-link'),
    views: document.querySelectorAll('.admin-view'),
    addCouponForm: document.getElementById('add-coupon-form'),
    couponListBody: document.getElementById('coupon-list-body'),
    addReelForm: document.getElementById('add-reel-form'),
    reelListBody: document.getElementById('reel-list-body'),
    orderListBody: document.getElementById('order-list-body'),
    reviewListBody: document.getElementById('review-list-body'),
    adminEmail: document.getElementById('admin-email'),
    productIdField: document.getElementById('product-id'),
    submitProductBtn: document.getElementById('submit-product-btn'),
    cancelEditBtn: document.getElementById('cancel-edit-btn'),
    prevProductPageBtn: document.getElementById('prev-product-page'),
    nextProductPageBtn: document.getElementById('next-product-page'),
    productPageInfo: document.getElementById('product-page-info'),
    statsOrders: document.getElementById('stats-orders'),
    statsProducts: document.getElementById('stats-products'),
    statsUsers: document.getElementById('stats-users'),
    statsReviews: document.getElementById('stats-reviews'),
};

/**
 * Mostra uma notificação toast.
 * @param {string} message - A mensagem a ser exibida.
 * @param {boolean} isError - Se a notificação é de erro.
 */
export function showToast(message, isError = false) {
    const toast = document.getElementById('admin-toast');
    const toastMessage = document.getElementById('admin-toast-message');
    const iconContainer = document.getElementById('admin-toast-icon');
    if (!toast || !toastMessage || !iconContainer) return;

    toast.classList.remove('border-green-400', 'border-red-400');
    toast.classList.add(isError ? 'border-red-400' : 'border-green-400');
    toastMessage.textContent = message;
    
    const iconName = isError ? 'x-circle' : 'check-circle';
    iconContainer.innerHTML = `<i data-feather="${iconName}"></i>`;
    feather.replace();

    toast.classList.remove('opacity-0', 'translate-y-10');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-10');
    }, 3000);
}

/**
 * Mostra uma mensagem na tela de autenticação.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} color - A cor base para o estilo da mensagem (ex: 'red', 'green').
 */
export function showAuthMessage(message, color) {
    if (!DOMElements.authMessage) return;
    DOMElements.authMessage.textContent = message;
    DOMElements.authMessage.className = `mb-4 p-3 rounded-md text-center bg-${color}-100 text-${color}-700`;
}

/**
 * Alterna a visibilidade das diferentes "views" do painel.
 * @param {string} viewToShow - O ID da view a ser mostrada (ex: 'dashboard').
 */
export function switchView(viewToShow) {
    DOMElements.views.forEach(view => view.classList.add('hidden'));
    const targetView = document.getElementById(`view-${viewToShow}`);
    if (targetView) {
        targetView.classList.remove('hidden');
    }

    DOMElements.navLinks.forEach(nav => {
        nav.classList.toggle('active', nav.dataset.view === viewToShow);
    });
}

/**
 * Renderiza estrelas de avaliação com base numa nota.
 * @param {number} rating - A nota da avaliação.
 * @returns {string} O HTML das estrelas.
 */
export function renderStars(rating) {
    let stars = '';
    const ratingValue = Math.round(rating);
    for (let i = 1; i <= 5; i++) {
        stars += `<i data-feather="star" class="w-4 h-4 ${i <= ratingValue ? 'text-yellow-500 fill-current' : 'text-gray-300'}"></i>`;
    }
    return `<div class="flex items-center">${stars}</div>`;
}

// Função interna para esconder o modal, não precisa ser exportada.
function hideAdminConfirmationModal() {
    const modalOverlay = document.getElementById('admin-confirmation-modal-overlay');
    const modal = document.getElementById('admin-confirmation-modal');
    if (modalOverlay) {
        modalOverlay.classList.add('opacity-0');
        setTimeout(() => modalOverlay.classList.add('hidden'), 300);
    }
    if (modal) {
        modal.classList.add('opacity-0', 'scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

/**
 * Exibe um modal de confirmação personalizado para o painel de administração.
 * @param {string} message A mensagem a ser exibida no modal.
 * @param {string} [title='Confirmação'] O título do modal.
 * @returns {Promise<boolean>} Uma promessa que resolve para `true` se o usuário confirmar, `false` caso contrário.
 */
export function showAdminConfirmationModal(message, title = 'Confirmação') {
    return new Promise(resolve => {
        const modalOverlay = document.getElementById('admin-confirmation-modal-overlay');
        const modal = document.getElementById('admin-confirmation-modal');
        const modalTitle = document.getElementById('admin-confirmation-modal-title');
        const modalMessage = document.getElementById('admin-confirmation-modal-message');
        const confirmBtn = document.getElementById('admin-confirmation-confirm-btn');
        const cancelBtn = document.getElementById('admin-confirmation-cancel-btn');

        if (!modalOverlay || !modal || !modalTitle || !modalMessage || !confirmBtn || !cancelBtn) {
            console.error("Elementos do modal de confirmação do admin não encontrados.");
            resolve(false);
            return;
        }

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        // Função para remover os listeners e evitar duplicação
        const cleanup = () => {
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            modalOverlay.removeEventListener('click', onCancel);
        };

        const onConfirm = () => {
            cleanup();
            hideAdminConfirmationModal();
            resolve(true);
        };

        const onCancel = () => {
            cleanup();
            hideAdminConfirmationModal();
            resolve(false);
        };

        // Adiciona os listeners
        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        modalOverlay.addEventListener('click', onCancel);

        // Mostra o modal
        modalOverlay.classList.remove('hidden', 'opacity-0');
        modal.classList.remove('hidden', 'opacity-0', 'scale-95');
    });
}
