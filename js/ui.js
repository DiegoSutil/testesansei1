/**
 * @fileoverview Módulo de Funções de Interface do Usuário (UI).
 * Contém todas as funções que manipulam o DOM e fornecem feedback visual.
 */

export function showToast(message, isError = false) {
    const toastContainer = document.getElementById('toast-notification');
    if (!toastContainer) return;

    const toastId = `toast-${Date.now()}`;
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `flex items-center gap-4 px-6 py-3 mb-2 rounded-xl shadow-lg bg-white text-slate-800 border-l-4 transform transition-all duration-300 opacity-0 translate-y-10 ${isError ? 'border-red-400' : 'border-green-400'}`;
    
    const iconName = isError ? 'x-circle' : 'check-circle';
    const iconColorClass = isError ? 'text-red-500' : 'text-green-500';

    toast.innerHTML = `
        <span class="flex-shrink-0"><i data-feather="${iconName}" class="${iconColorClass}"></i></span>
        <span class="font-medium">${message}</span>
    `;

    toastContainer.appendChild(toast);
    feather.replace();

    setTimeout(() => {
        toast.classList.remove('opacity-0', 'translate-y-10');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

export const showLoader = (show) => {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.toggle('hidden', !show);
    }
}

export function showConfirmationModal(message, title = 'Confirmação') {
    return new Promise(resolve => {
        const modalOverlay = document.getElementById('confirmation-modal-overlay');
        const modal = document.getElementById('confirmation-modal');
        const modalTitle = document.getElementById('confirmation-modal-title');
        const modalMessage = document.getElementById('confirmation-modal-message');
        const confirmBtn = document.getElementById('confirmation-confirm-btn');
        const cancelBtn = document.getElementById('confirmation-cancel-btn');

        if (!modalOverlay || !modal || !modalTitle || !modalMessage || !confirmBtn || !cancelBtn) {
            resolve(false);
            return;
        }

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        confirmBtn.onclick = () => { hideConfirmationModal(); resolve(true); };
        cancelBtn.onclick = () => { hideConfirmationModal(); resolve(false); };

        modalOverlay.classList.remove('hidden');
        modal.classList.remove('hidden', 'opacity-0', 'scale-95');
    });
}

export function hideConfirmationModal() {
    const modalOverlay = document.getElementById('confirmation-modal-overlay');
    const modal = document.getElementById('confirmation-modal');
    if (modalOverlay) modalOverlay.classList.add('hidden');
    if (modal) {
        modal.classList.add('opacity-0', 'scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

export function toggleModal(modalId, show) {
    const overlay = document.getElementById(`${modalId}-overlay`);
    const modal = document.getElementById(modalId);
    if (!overlay || !modal) return;

    if (show) {
        overlay.classList.remove('hidden');
        modal.classList.remove('hidden', 'opacity-0', 'scale-95', 'translate-x-full');
        modal.setAttribute('aria-hidden', 'false');
        overlay.setAttribute('aria-hidden', 'false');
        modal.focus();
    } else {
        overlay.classList.add('hidden');
        modal.classList.add('opacity-0', 'scale-95');
        if (modalId === 'cart-modal') modal.classList.add('translate-x-full');
        setTimeout(() => modal.classList.add('hidden'), 300);
        modal.setAttribute('aria-hidden', 'true');
        overlay.setAttribute('aria-hidden', 'true');
    }
}

export function toggleMobileMenu(show) {
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
    if (show) {
        mobileMenu.classList.remove('-translate-x-full');
        mobileMenuOverlay.classList.remove('hidden');
        mobileMenu.setAttribute('aria-expanded', 'true');
        mobileMenu.focus();
    } else {
        mobileMenu.classList.add('-translate-x-full');
        mobileMenuOverlay.classList.add('hidden');
        mobileMenu.setAttribute('aria-expanded', 'false');
    }
}

export function renderStars(rating) {
    let stars = '';
    const roundedRating = Math.round(rating);
    for (let i = 1; i <= 5; i++) {
        stars += `<i data-feather="star" class="feather-star ${i <= roundedRating ? 'filled' : ''}"></i>`;
    }
    return `<div class="flex items-center star-rating" role="img" aria-label="Avaliação de ${roundedRating} de 5 estrelas">${stars}</div>`;
}
