/**
 * @fileoverview Ponto de Entrada Principal da Aplicação (Maestro).
 * Orquestra a inicialização dos módulos, navegação e gestão de eventos globais.
 * VERSÃO COMPLETA E CORRIGIDA: Adiciona páginas de categoria dinâmicas e preserva todo o conteúdo.
 */

// Módulos do Firebase
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from './firebase-config.js';

// Módulos da Aplicação
import { state, setCurrentUserData, setCart, setAppliedCoupon, setSelectedShipping } from './js/state.js';
import { showLoader, toggleModal, toggleMobileMenu, showToast } from './js/ui.js';
import { fetchInitialData, fetchAndRenderReels } from './js/api.js';
import { renderProducts, showProductDetails, handleReviewSubmit, createProductCardTemplate } from './js/product.js';
import { addToCart, updateCartIcon, setupCartEventListeners, renderCart } from './js/cart.js';
import { updateAuthUI, handleLogout, renderAuthForm, renderWishlist, renderOrders } from './js/auth.js';
import { applyCoupon } from './js/coupons.js';
import { calculateShipping } from './shipping.js';

// Mapeia os nomes de filtro para os títulos das páginas
const categoryTitles = {
    'perfume': 'Perfumes',
    'creme': 'Cremes',
    'body-splash': 'Body Splash',
    'decant': 'Decants'
};

// =================================================================================
// FUNÇÕES DE NAVEGAÇÃO E RENDERIZAÇÃO (ATUALIZADAS)
// =================================================================================

/**
 * Filtra e renderiza os produtos na página de produtos com base na categoria principal e subfiltros.
 * @param {string} mainCategory - A categoria principal da página (ex: 'perfume', 'creme').
 */
function applyProductPageFilters(mainCategory) {
    const productListEl = document.getElementById('product-list-produtos');
    if (!productListEl) return;

    // Obter valores dos sub-filtros (gênero, preço, ordenação)
    const subCategories = Array.from(document.querySelectorAll('#filter-sub-categories input:checked')).map(cb => cb.value);
    const maxPrice = parseInt(document.getElementById('price-range-filter').value);
    const sortBy = document.getElementById('sort-by').value;

    // 1. Filtra primeiro pela categoria principal da página
    let filteredProducts = state.allProducts.filter(p => p.category.toLowerCase() === mainCategory.toLowerCase());

    // 2. Aplica os sub-filtros de gênero.
    // Esta parte assume que seus produtos no Firebase têm um campo 'gender' (ex: 'masculino', 'feminino', 'unissex')
    // Se não tiver, este filtro não terá efeito.
    if (subCategories.length > 0) {
        filteredProducts = filteredProducts.filter(p => p.gender && subCategories.includes(p.gender.toLowerCase()));
    }

    // 3. Aplica o filtro de preço
    filteredProducts = filteredProducts.filter(p => p.price <= maxPrice);

    // 4. Ordena os produtos
    switch (sortBy) {
        case 'price-asc':
            filteredProducts.sort((a, b) => a.price - b.price);
            break;
        case 'price-desc':
            filteredProducts.sort((a, b) => b.price - a.price);
            break;
        case 'name-asc':
            filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-desc':
            filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
            break;
    }
    
    renderProducts(filteredProducts, 'product-list-produtos', true);
}


/**
 * Função central de navegação. Esconde todas as páginas e mostra a página alvo.
 * @param {string} pageId - O ID da página a ser exibida (ex: 'inicio', 'produtos').
 * @param {string|null} categoryFilter - O filtro de categoria principal a ser aplicado.
 */
function showPage(pageId, categoryFilter = null) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }

    // Atualiza o estado ativo nos links de navegação
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageId && (link.dataset.categoryFilter === categoryFilter || !link.dataset.categoryFilter)) {
            link.classList.add('active');
        }
    });

    // Garante que o link 'Início' fique ativo ao carregar a página
    if (pageId === 'inicio') {
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        const homeLink = document.querySelector('.nav-link[data-page="inicio"]');
        if (homeLink) homeLink.classList.add('active');
    }

    // Lógica específica para cada página
    if (pageId === 'produtos' && categoryFilter) {
        const titleEl = document.getElementById('produtos-page-title');
        const subtitleEl = document.getElementById('produtos-page-subtitle');
        
        const title = categoryTitles[categoryFilter.toLowerCase()] || `Nossos ${categoryFilter}`;
        if (titleEl) titleEl.textContent = title;
        if (subtitleEl) subtitleEl.textContent = `Explore nossa coleção de ${title.toLowerCase()}.`;

        document.querySelectorAll('#filter-sub-categories input').forEach(cb => cb.checked = false);
        applyProductPageFilters(categoryFilter);

        const filterContainer = document.getElementById('page-produtos').querySelector('aside');
        const newFilterContainer = filterContainer.cloneNode(true);
        filterContainer.parentNode.replaceChild(newFilterContainer, filterContainer);
        
        newFilterContainer.addEventListener('input', () => {
             applyProductPageFilters(categoryFilter);
        });

    } else if (pageId === 'profile') {
        if (!state.currentUserData) {
            showPage('inicio');
            renderAuthForm();
            toggleModal('auth-modal', true);
            return;
        }
        const profileEmailEl = document.getElementById('profile-email');
        if (profileEmailEl) profileEmailEl.textContent = `Bem-vindo(a), ${state.currentUserData.email}`;
        renderWishlist();
        renderOrders();
    }
    
    window.scrollTo(0, 0);
    if (window.AOS) {
        AOS.refresh();
    }
}
window.showPage = showPage;

/**
 * Atualiza a renderização de todos os produtos visíveis quando o estado muda (ex: login, wishlist).
 */
function refreshAllProductViews() {
    const currentPage = document.querySelector('.page-content:not(.hidden)');
    if (!currentPage) return;
    const pageId = currentPage.id.replace('page-', '');

    switch (pageId) {
        case 'inicio':
            renderProducts(state.allProducts.slice(0, 8), 'product-list-home');
            break;
        case 'produtos':
            const currentCategory = document.getElementById('produtos-page-title').textContent;
            const categoryKey = Object.keys(categoryTitles).find(key => categoryTitles[key] === currentCategory) || '';
            if (categoryKey) {
                applyProductPageFilters(categoryKey);
            }
            break;
        case 'profile':
            renderWishlist();
            break;
    }
}


async function toggleWishlist(productId) {
    if (!state.currentUserData) {
        showToast("Você precisa estar logado para usar a lista de desejos.", true);
        renderAuthForm();
        toggleModal('auth-modal', true);
        return;
    }

    const userRef = doc(db, "users", state.currentUserData.uid);
    const heartIcon = document.querySelector(`.wishlist-heart[data-id="${productId}"] i`);
    
    if (state.currentUserData.wishlist.includes(productId)) {
        state.currentUserData.wishlist = state.currentUserData.wishlist.filter(id => id !== productId);
        await updateDoc(userRef, { wishlist: arrayRemove(productId) });
        showToast("Removido da lista de desejos.");
        if(heartIcon) heartIcon.classList.remove('active');
    } else {
        state.currentUserData.wishlist.push(productId);
        await updateDoc(userRef, { wishlist: arrayUnion(productId) });
        showToast("Adicionado à lista de desejos!");
        if(heartIcon) heartIcon.classList.add('active');
    }
    refreshAllProductViews();
}

function initializeEventListeners() {
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        const closest = (selector) => target.closest(selector);

        const navLink = closest('.nav-link, .mobile-nav-link, .nav-link-button, #mobile-bottom-nav a, .category-card-link, .dropdown-menu a');
        if (navLink && navLink.dataset.page) {
            e.preventDefault();
            showPage(navLink.dataset.page, navLink.dataset.categoryFilter);
            if (closest('.mobile-nav-link') || closest('.dropdown-menu a')) toggleMobileMenu(false);
            return;
        }

        const productLink = closest('.product-image-link, .product-name-link');
        if (productLink) {
            e.preventDefault();
            showProductDetails(productLink.dataset.id);
            return;
        }

        const addToCartBtn = closest('.add-to-cart-btn');
        if (addToCartBtn) {
            e.preventDefault();
            addToCart(addToCartBtn.dataset.id, 1, e);
            return;
        }
        
        const wishlistBtn = closest('.wishlist-heart');
        if(wishlistBtn) {
            e.preventDefault();
            toggleWishlist(wishlistBtn.dataset.id);
            return;
        }

        if (closest('#mobile-menu-button')) toggleMobileMenu(true);
        if (closest('#close-mobile-menu, #mobile-menu-overlay')) toggleMobileMenu(false);
        if (closest('#cart-button, #mobile-bottom-cart-btn')) toggleModal('cart-modal', true);
        if (closest('#close-cart-button, #cart-modal-overlay')) toggleModal('cart-modal', false);
        if (closest('#close-product-details-modal, #product-details-modal-overlay')) toggleModal('product-details-modal', false);
        if (closest('#close-auth-modal, #auth-modal-overlay')) toggleModal('auth-modal', false);
        
        const userAction = closest('#user-button, #mobile-user-link, #mobile-bottom-user-link');
        if (userAction) {
            e.preventDefault();
            if (state.currentUserData) {
                showPage('profile');
            } else {
                renderAuthForm();
                toggleModal('auth-modal', true);
            }
            if (closest('#mobile-user-link')) toggleMobileMenu(false);
            return;
        }

        if (closest('#logout-button')) handleLogout();

        if (closest('#login-to-review')) {
            e.preventDefault();
            toggleModal('product-details-modal', false);
            renderAuthForm();
            toggleModal('auth-modal', true);
        }

        if (closest('#calculate-shipping-btn')) {
            const cep = document.getElementById('cep-input').value;
            calculateShipping(cep);
        }
    });

    document.body.addEventListener('submit', (e) => {
        if (e.target.id.startsWith('review-form-')) {
            handleReviewSubmit(e, e.target.dataset.productId);
        }
        if (e.target.id === 'coupon-form') {
            e.preventDefault();
            applyCoupon(document.getElementById('coupon-input').value);
        }
    });
    
    const priceRange = document.getElementById('price-range-filter');
    const priceValue = document.getElementById('price-range-value');
    if(priceRange && priceValue) {
        priceRange.addEventListener('input', (e) => {
            priceValue.textContent = `R$ ${e.target.value}`;
        });
    }

    setupCartEventListeners();
}

async function main() {
    showLoader(true);

    await fetchInitialData();
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                const userData = userDoc.data();
                setCurrentUserData({ uid: user.uid, ...userData });
                const localCart = JSON.parse(localStorage.getItem('sanseiCart')) || [];
                const firestoreCart = userData.cart || [];
                const mergedCart = [...firestoreCart];
                localCart.forEach(localItem => {
                    const existingItem = mergedCart.find(ci => ci.id === localItem.id);
                    if (existingItem) {
                        existingItem.quantity = Math.min(existingItem.quantity + localItem.quantity, 10);
                    } else {
                        mergedCart.push(localItem);
                    }
                });
                
                setCart(mergedCart);
                if (localCart.length > 0) {
                    await setDoc(userDocRef, { cart: mergedCart }, { merge: true });
                    localStorage.removeItem('sanseiCart');
                }
            }
        } else {
            setCurrentUserData(null);
            setCart(JSON.parse(localStorage.getItem('sanseiCart')) || []);
        }
        updateAuthUI(user);
        updateCartIcon();
        refreshAllProductViews();
        renderCart();
    });

    await fetchAndRenderReels();
    
    initializeEventListeners();
    AOS.init({ duration: 800, once: true });
    
    showPage('inicio');
    showLoader(false);
}

document.addEventListener('DOMContentLoaded', main);
