/**
 * @fileoverview Módulo de Navegação.
 * Controla a exibição de páginas e a atualização de views.
 */

import { state } from './state.js';
import { renderProducts } from './product.js';
import { renderWishlist, renderOrders } from './auth.js';

export function showPage(pageId, categoryFilter = null) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === pageId);
    });
    
    document.querySelectorAll('#mobile-bottom-nav a').forEach(link => {
        link.classList.remove('active');
    });
    const activeBottomLink = document.querySelector(`#mobile-bottom-nav a[data-page="${pageId}"]`);
    if(activeBottomLink) activeBottomLink.classList.add('active');


    // Lógica específica da página
    if (pageId === 'fragrancias') {
        const filterCheckboxes = document.querySelectorAll('input[type="checkbox"][id^="filter-cat-"]');
        filterCheckboxes.forEach(cb => cb.checked = false);
        if (categoryFilter) {
            const filterCheckbox = document.querySelector(`input[value="${categoryFilter}"]`);
            if (filterCheckbox) {
                filterCheckbox.checked = true;
            }
        }
        // A função applyFilters será chamada pelo event listener no script.js
        document.querySelector('#filter-cat-perfume').dispatchEvent(new Event('change'));
    } else if (pageId === 'decants') {
        const decantProducts = state.allProducts.filter(p => p.category === 'decant');
        renderProducts(decantProducts, 'product-list-decants');
    } else if (pageId === 'profile') {
        if (!state.currentUserData) {
            showPage('inicio');
            document.querySelector('#user-button').click(); // Simula clique para abrir modal de login
            return;
        }
        const profileEmailEl = document.getElementById('profile-email');
        if (profileEmailEl) profileEmailEl.textContent = `Bem-vindo(a), ${state.currentUserData.email}`;
        renderWishlist();
        renderOrders();
    }
    
    window.scrollTo(0, 0);
    AOS.refresh();
}

export function refreshAllProductViews() {
    const currentPage = document.querySelector('.page-content:not(.hidden)');
    if (!currentPage) return;
    const pageId = currentPage.id.replace('page-', '');

    if (pageId === 'inicio') {
        renderProducts(state.allProducts.slice(0, 4), 'product-list-home');
    } else if (pageId === 'fragrancias') {
        document.querySelector('#filter-cat-perfume').dispatchEvent(new Event('change'));
    } else if (pageId === 'decants') {
        const decantProducts = state.allProducts.filter(p => p.category === 'decant');
        renderProducts(decantProducts, 'product-list-decants');
    } else if (pageId === 'profile') {
        renderWishlist();
    }
}
