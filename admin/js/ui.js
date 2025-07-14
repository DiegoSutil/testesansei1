/**
 * @fileoverview Módulo de Funções de Interface (UI) para o Painel de Admin.
 * Exporta funções para manipulação do DOM e feedback ao utilizador.
 * VERSÃO CORRIGIDA: Adiciona os elementos do dashboard que estavam em falta.
 */

// Centraliza todos os seletores de elementos do DOM para fácil manutenção.
export const DOMElements = {
    // Telas e contentores principais
    authScreen: document.getElementById('auth-screen'),
    adminPanel: document.getElementById('admin-panel'),
    views: document.querySelectorAll('.admin-view'),
    
    // Formulários
    loginForm: document.getElementById('login-form'),
    productForm: document.getElementById('product-form'),
    addCouponForm: document.getElementById('add-coupon-form'),
    addReelForm: document.getElementById('add-reel-form'),
    
    // Botões
    logoutButton: document.getElementById('logout-button'),
    submitProductBtn: document.getElementById('submit-product-btn'),
    cancelEditBtn: document.getElementById('cancel-edit-btn'),
    prevProductPageBtn: document.getElementById('prev-product-page'),
    nextProductPageBtn: document.getElementById('next-product-page'),

    // Conteúdo dinâmico
    adminEmail: document.getElementById('admin-email'),
    authMessage: document.getElementById('auth-message'),
    productListBody: document.getElementById('product-list-body'),
    orderListBody: document.getElementById('order-list-body'),
    reviewListBody: document.getElementById('review-list-body'),
    couponListBody: document.getElementById('coupon-list-body'),
    reelListBody: document.getElementById('reel-list-body'),
    productPageInfo: document.getElementById('product-page-info'),
    
    // Campos de formulário
    productIdField: document.getElementById('product-id'),

    // Navegação
    navLinks: document.querySelectorAll('.admin-nav-link'),
    
    // Estatísticas do Dashboard (ELEMENTOS ADICIONADOS)
    statsOrders: document.getElementById('stats-orders'),
    statsProducts: document.getElementById('stats-products'),
    statsUsers: document.getElementById('stats-users'),
    statsReviews: document.getElementById('stats-reviews'),

    // Modais e Toasts
    adminToast: document.getElementById('admin-toast'),
    adminToastIcon: document.getElementById('admin-toast-icon'),
    adminToastMessage: document.getElementById('admin-toast-message'),
    adminConfirmationModal: document.getElementById('admin-confirmation-modal'),
    adminConfirmationModalOverlay: document.getElementById('admin-confirmation-modal-overlay'),
    adminConfirmationTitle: document.getElementById('admin-confirmation-modal-title'),
    adminConfirmationMessage: document.getElementById('admin-confirmation-modal-message'),
    adminConfirmBtn: document.getElementById('admin-confirmation-confirm-btn'),
    adminCancelBtn: document.getElementById('admin-confirmation-cancel-btn'),
};

/**
 * Mostra uma notificação toast.
 * @param {string} message - A mensagem a ser exibida.
 * @param {boolean} isError - Se a notificação é de erro.
 */
export function showToast(message, isError = false) {
    const { adminToast, adminToastMessage, adminToastIcon } = DOMElements;
    if (!adminToast || !adminToastMessage || !adminToastIcon) return;

    adminToast.classList.remove('border-green-400', 'border-red-400');
    adminToast.classList.add(isError ? 'border-red-400' : 'border-green-400');
    adminToastMessage.textContent = message;
    
    const iconName = isError ? 'x-circle' : 'check-circle';
    adminToastIcon.innerHTML = `<i data-feather="${iconName}"></i>`;
    feather.replace();

    adminToast.classList.remove('opacity-0', 'translate-y-10');
    setTimeout(() => {
        adminToast.classList.add('opacity-0', 'translate-y-10');
    }, 3000);
}

/**
 * Mostra uma mensagem na tela de autenticação.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} color - A cor base para o estilo da mensagem (ex: 'red', 'green').
 */
export function showAuthMessage(message, color) {
    const { authMessage } = DOMElements;
    if (!authMessage) return;
    authMessage.textContent = message;
    authMessage.className = `mb-4 p-3 rounded-md text-center bg-${color}-100 text-${color}-700`;
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

/**
 * Exibe um modal de confirmação personalizado para o painel de administração.
 * @param {string} message A mensagem a ser exibida no modal.
 * @param {string} [title='Confirmação'] O título do modal.
 * @returns {Promise<boolean>} Uma promessa que resolve para `true` se o usuário confirmar, `false` caso contrário.
 */
export function showAdminConfirmationModal(message, title = 'Confirmação') {
    return new Promise(resolve => {
        const { 
            adminConfirmationModal, adminConfirmationModalOverlay, 
            adminConfirmationTitle, adminConfirmationMessage, 
            adminConfirmBtn, adminCancelBtn 
        } = DOMElements;

        if (!adminConfirmationModal) {
            console.error("Elementos do modal de confirmação do admin não encontrados.");
            resolve(false);
            return;
        }

        adminConfirmationTitle.textContent = title;
        adminConfirmationMessage.textContent = message;

        const hide = () => {
            adminConfirmationModal.classList.add('hidden');
            adminConfirmationModalOverlay.classList.add('hidden');
        };
        
        const onConfirm = () => { hide(); resolve(true); };
        const onCancel = () => { hide(); resolve(false); };

        adminConfirmBtn.onclick = onConfirm;
        adminCancelBtn.onclick = onCancel;
        adminConfirmationModalOverlay.onclick = onCancel;

        adminConfirmationModal.classList.remove('hidden');
        adminConfirmationModalOverlay.classList.remove('hidden');
    });
}
