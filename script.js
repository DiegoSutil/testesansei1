/**
 * @fileoverview Ponto de Entrada Principal da Aplicação (Maestro).
 * Orquestra a inicialização dos módulos, navegação e gestão de eventos globais.
 * VERSÃO CORRIGIDA: Unifica a navegação, corrige a ordem de inicialização e robustece os filtros.
 */

// Módulos do Firebase
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from './firebase-config.js';

// Módulos da Aplicação
import { state, setCurrentUserData, setCart, setAppliedCoupon, setSelectedShipping, setFragrancePage, incrementFragrancePage, productsPerPage } from './js/state.js';
import { showLoader, toggleModal, toggleMobileMenu, showToast } from './js/ui.js';
import { fetchInitialData, fetchAndRenderReels } from './js/api.js';
import { renderProducts, showProductDetails, handleReviewSubmit, createProductCardTemplate } from './js/product.js';
import { addToCart, updateCartIcon, setupCartEventListeners, renderCart } from './js/cart.js';
import { updateAuthUI, handleLogout, renderAuthForm, renderWishlist, renderOrders } from './js/auth.js';
import { applyCoupon } from './js/coupons.js';

// =================================================================================
// FUNÇÕES DE NAVEGAÇÃO E RENDERIZAÇÃO (Centralizadas aqui)
// =================================================================================

/**
 * Filtra e renderiza os produtos na página de fragrâncias com base nos controlos do DOM.
 * @param {boolean} initialLoad - Se for o carregamento inicial, não mostra a mensagem "nenhum produto".
 */
function applyFiltersAndRender(initialLoad = false) {
    const productListEl = document.getElementById('product-list-fragrancias');
    if (!productListEl) return;

    // Obter valores dos filtros
    const categories = Array.from(document.querySelectorAll('#filter-categories input:checked')).map(cb => cb.value);
    const maxPrice = parseInt(document.getElementById('price-range-filter').value);
    const sortBy = document.getElementById('sort-by').value;

    // Filtrar produtos
    let filteredProducts = state.allProducts.filter(p => {
        const categoryMatch = categories.length === 0 || categories.includes(p.category);
        const priceMatch = p.price <= maxPrice;
        return categoryMatch && priceMatch;
    });

    // Ordenar produtos
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
        // 'popularity' é o default, sem ordenação extra por enquanto
    }
    
    renderProducts(filteredProducts, 'product-list-fragrancias', initialLoad);
}


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
        case 'fragrancias':
            applyFiltersAndRender(true);
            break;
        case 'decants':
            const decantProducts = state.allProducts.filter(p => p.category === 'decant');
            renderProducts(decantProducts, 'product-list-decants');
            break;
        case 'profile':
            renderWishlist();
            break;
    }
}

/**
 * Função central de navegação. Esconde todas as páginas e mostra a página alvo.
 * @param {string} pageId - O ID da página a ser exibida (ex: 'inicio', 'fragrancias').
 * @param {string|null} categoryFilter - Um filtro de categoria opcional para aplicar ao carregar.
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
        if (link.dataset.page === pageId) {
            link.classList.add('active');
        }
    });
    document.querySelectorAll('#mobile-bottom-nav a').forEach(link => {
        link.classList.remove('active');
         if (link.dataset.page === pageId) {
            link.classList.add('active');
        }
    });

    // Lógica específica para cada página
    switch (pageId) {
        case 'fragrancias':
            document.querySelectorAll('#filter-categories input').forEach(cb => cb.checked = false);
            if (categoryFilter) {
                const filterCheckbox = document.querySelector(`#filter-categories input[value="${categoryFilter}"]`);
                if (filterCheckbox) {
                    filterCheckbox.checked = true;
                }
            }
            // Chama a função de filtro diretamente em vez de disparar um evento
            applyFiltersAndRender(true);
            break;
        case 'decants':
            const decantProducts = state.allProducts.filter(p => p.category === 'decant');
            renderProducts(decantProducts, 'product-list-decants');
            break;
        case 'profile':
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
            break;
    }
    
    window.scrollTo(0, 0);
    // Garante que as animações sejam recarregadas ao mudar de página
    if (window.AOS) {
        AOS.refresh();
    }
}

// Disponibiliza a função globalmente para ser usada no HTML inline (se necessário) e para simplificar chamadas
window.showPage = showPage;


// =================================================================================
// INICIALIZAÇÃO E EVENT LISTENERS
// =================================================================================

/**
 * Adiciona um item à lista de desejos do usuário no estado e no Firestore.
 * @param {string} productId - O ID do produto a ser adicionado/removido.
 */
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
        // Remover da lista de desejos
        state.currentUserData.wishlist = state.currentUserData.wishlist.filter(id => id !== productId);
        await updateDoc(userRef, { wishlist: arrayRemove(productId) });
        showToast("Removido da lista de desejos.");
        if(heartIcon) heartIcon.classList.remove('active');

    } else {
        // Adicionar à lista de desejos
        state.currentUserData.wishlist.push(productId);
        await updateDoc(userRef, { wishlist: arrayUnion(productId) });
        showToast("Adicionado à lista de desejos!");
        if(heartIcon) heartIcon.classList.add('active');
    }
    // Atualiza a visualização caso o usuário esteja na página de perfil
    refreshAllProductViews();
}


/**
 * Configura todos os event listeners globais da aplicação.
 */
function initializeEventListeners() {
    // Delegação de eventos no corpo do documento para performance
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        const closest = (selector) => target.closest(selector);

        // Navegação
        const navLink = closest('.nav-link, .mobile-nav-link, .nav-link-button, #mobile-bottom-nav a');
        if (navLink && navLink.dataset.page) {
            e.preventDefault();
            showPage(navLink.dataset.page, navLink.dataset.categoryFilter);
            if (closest('.mobile-nav-link')) toggleMobileMenu(false);
            return;
        }

        // Ações de Produto
        const productLink = closest('.product-image-link, .product-name-link');
        if (productLink) {
            e.preventDefault();
            showProductDetails(productLink.dataset.id);
            return;
        }

        // Adicionar ao Carrinho
        const addToCartBtn = closest('.add-to-cart-btn');
        if (addToCartBtn) {
            e.preventDefault();
            addToCart(addToCartBtn.dataset.id, 1, e);
            return;
        }
        
        // Lista de Desejos
        const wishlistBtn = closest('.wishlist-heart');
        if(wishlistBtn) {
            e.preventDefault();
            toggleWishlist(wishlistBtn.dataset.id);
            return;
        }

        // UI: Modais e Menus
        if (closest('#mobile-menu-button')) toggleMobileMenu(true);
        if (closest('#close-mobile-menu, #mobile-menu-overlay')) toggleMobileMenu(false);
        if (closest('#cart-button, #mobile-bottom-cart-btn')) toggleModal('cart-modal', true);
        if (closest('#close-cart-button, #cart-modal-overlay')) toggleModal('cart-modal', false);
        if (closest('#close-product-details-modal, #product-details-modal-overlay')) toggleModal('product-details-modal', false);
        if (closest('#close-auth-modal, #auth-modal-overlay')) toggleModal('auth-modal', false);
        
        // UI: Autenticação / Perfil
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

        // Logout
        if (closest('#logout-button')) handleLogout();

        // Link para login no formulário de avaliação
        if (closest('#login-to-review')) {
            e.preventDefault();
            toggleModal('product-details-modal', false);
            renderAuthForm();
            toggleModal('auth-modal', true);
        }
    });

    // Listeners para formulários
    document.body.addEventListener('submit', (e) => {
        if (e.target.id.startsWith('review-form-')) {
            handleReviewSubmit(e, e.target.dataset.productId);
        }
        if (e.target.id === 'coupon-form') {
            e.preventDefault();
            applyCoupon(document.getElementById('coupon-input').value);
        }
        if (e.target.id === 'auth-form') {
            // A lógica de submit do auth-form é tratada em auth.js
        }
    });
    
    // Listeners para filtros da página de fragrâncias
    const filterControls = document.querySelector('#page-fragrancias .sticky-top');
    if(filterControls) {
        filterControls.addEventListener('input', () => applyFiltersAndRender());
    }
    
    // Atualiza o valor do range de preço
    const priceRange = document.getElementById('price-range-filter');
    const priceValue = document.getElementById('price-range-value');
    if(priceRange && priceValue) {
        priceRange.addEventListener('input', (e) => {
            priceValue.textContent = `R$ ${e.target.value}`;
        });
    }

    // Inicializa outros listeners de módulos específicos
    setupCartEventListeners();
}

/**
 * Função principal de inicialização da aplicação.
 */
async function main() {
    showLoader(true);

    // 1. Busca os dados essenciais primeiro
    const products = await fetchInitialData();
    
    // 2. Renderiza o conteúdo inicial que depende dos dados
    if (products) {
        renderProducts(products.slice(0, 8), 'product-list-home');
        // Prepara a página de fragrâncias para quando for visitada
        applyFiltersAndRender(true); 
    }
    fetchAndRenderReels();

    // 3. Configura o observador de autenticação para lidar com login/logout
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                const userData = userDoc.data();
                setCurrentUserData({ uid: user.uid, ...userData });
                // Mescla carrinho do localStorage com o do Firestore se necessário
                const localCart = JSON.parse(localStorage.getItem('sanseiCart')) || [];
                const firestoreCart = userData.cart || [];
                const mergedCart = [...firestoreCart];
                localCart.forEach(localItem => {
                    const existingItem = mergedCart.find(ci => ci.id === localItem.id);
                    if (existingItem) {
                        existingItem.quantity += localItem.quantity;
                    } else {
                        mergedCart.push(localItem);
                    }
                });
                
                setCart(mergedCart);
                const userRef = doc(db, "users", user.uid);
                await setDoc(userRef, { cart: mergedCart }, { merge: true });
                localStorage.removeItem('sanseiCart');
            }
        } else {
            setCurrentUserData(null);
            setCart(JSON.parse(localStorage.getItem('sanseiCart')) || []);
        }
        updateAuthUI(user);
        updateCartIcon();
        refreshAllProductViews(); // Atualiza a UI com base no estado de login
    });

    // 4. Inicializa as animações e os event listeners DEPOIS que tudo está pronto
    AOS.init({ duration: 800, once: true });
    initializeEventListeners();
    
    showLoader(false);
}

// Inicia a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', main);
