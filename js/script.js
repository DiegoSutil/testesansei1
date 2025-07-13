/**
 * @fileoverview Ponto de Entrada Principal da Aplicação (Maestro).
 * Orquestra a inicialização dos módulos e a gestão de eventos globais.
 */

// Módulos do Firebase
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from './firebase-config.js';

// Módulos da Aplicação
import { state, setCurrentUserData, setCart } from './js/state.js';
import { showLoader, toggleModal, toggleMobileMenu } from './js/ui.js';
import { fetchInitialData, fetchAndRenderReels } from './js/api.js';
import { renderProducts, showProductDetails, handleReviewSubmit } from './js/product.js';
import { addToCart, updateCartIcon, setupCartEventListeners } from './js/cart.js';
import { updateAuthUI, handleLogout, renderAuthForm } from './js/auth.js';

// Função principal de inicialização
async function main() {
    showLoader(true);
    initializeEventListeners();
    
    const products = await fetchInitialData();
    renderProducts(products.slice(0, 4), 'product-list-home');
    fetchAndRenderReels();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                setCurrentUserData({ uid: user.uid, ...userDoc.data() });
                // Lógica de mesclagem de carrinho (simplificada)
                const firestoreCart = userDoc.data().cart || [];
                setCart(firestoreCart);
                localStorage.removeItem('sanseiCart');
            }
        } else {
            setCurrentUserData(null);
            setCart(JSON.parse(localStorage.getItem('sanseiCart')) || []);
        }
        updateAuthUI(user);
        updateCartIcon();
        refreshAllProductViews();
    });

    showLoader(false);
}

// Gestão de Páginas
export function showPage(pageId, categoryFilter = null) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === pageId);
    });

    if (pageId === 'fragrancias') {
        // Lógica de filtro aqui, se necessário
    } else if (pageId === 'decants') {
        const decantProducts = state.allProducts.filter(p => p.category === 'decant');
        renderProducts(decantProducts, 'product-list-decants');
    }
    
    window.scrollTo(0, 0);
}

function refreshAllProductViews() {
    const currentPage = document.querySelector('.page-content:not(.hidden)');
    if (!currentPage) return;
    const pageId = currentPage.id.replace('page-', '');

    if (pageId === 'inicio') {
        renderProducts(state.allProducts.slice(0, 4), 'product-list-home');
    }
    // Adicionar outras lógicas de atualização se necessário
}

// Inicialização dos Event Listeners
function initializeEventListeners() {
    AOS.init({ duration: 800, once: true });
    setupCartEventListeners();

    document.body.addEventListener('click', (e) => {
        // Navegação
        const navLink = e.target.closest('.nav-link, .mobile-nav-link, .nav-link-button');
        if (navLink) {
            e.preventDefault();
            showPage(navLink.dataset.page, navLink.dataset.categoryFilter);
            if(e.target.closest('.mobile-nav-link')) toggleMobileMenu(false);
        }

        // Ações de Produto
        const productAction = e.target.closest('[data-id]');
        if (productAction) {
            const id = productAction.dataset.id;
            if (productAction.matches('.quick-view-btn, img, h3')) {
                showProductDetails(id);
            } else if (productAction.matches('.add-to-cart-btn')) {
                addToCart(id, 1, e);
            }
        }
        
        // UI
        if (e.target.closest('#mobile-menu-button')) toggleMobileMenu(true);
        if (e.target.closest('#close-mobile-menu, #mobile-menu-overlay')) toggleMobileMenu(false);
        if (e.target.closest('#cart-button, #mobile-bottom-cart-btn')) toggleModal('cart-modal', true);
        if (e.target.closest('#close-cart-button, #cart-modal-overlay')) toggleModal('cart-modal', false);
        if (e.target.closest('#user-button, #mobile-bottom-user-link')) {
            e.preventDefault();
            if(state.currentUserData) showPage('profile');
            else { renderAuthForm(); toggleModal('auth-modal', true); }
        }
        if (e.target.closest('#close-auth-modal, #auth-modal-overlay')) toggleModal('auth-modal', false);
        if (e.target.closest('#close-product-details-modal, #product-details-modal-overlay')) toggleModal('product-details-modal', false);
        if (e.target.closest('#logout-button')) handleLogout();

        // Link para login no formulário de avaliação
        if (e.target.closest('#login-to-review')) {
            e.preventDefault();
            toggleModal('product-details-modal', false);
            renderAuthForm();
            toggleModal('auth-modal', true);
        }
    });

    // Listener para o formulário de avaliação
    document.body.addEventListener('submit', (e) => {
        if (e.target && e.target.id.startsWith('review-form-')) {
            handleReviewSubmit(e, e.target.dataset.productId);
        }
    });
}

// Inicia a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', main);
