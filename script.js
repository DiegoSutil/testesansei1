/**
 * @fileoverview Ponto de Entrada Principal da Aplicação (Maestro).
 * Orquestra a inicialização dos módulos e a gestão de eventos globais.
 */

// Módulos do Firebase
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from './firebase-config.js';

// Módulos da Aplicação
import { state, setCurrentUserData, setCart, setAppliedCoupon } from './js/state.js';
import { showLoader, toggleModal, toggleMobileMenu, showToast } from './js/ui.js';
import { fetchInitialData, fetchAndRenderReels } from './js/api.js';
import { renderProducts, showProductDetails, handleReviewSubmit } from './js/product.js';
import { addToCart, updateCartIcon, setupCartEventListeners, renderCart } from './js/cart.js';
import { updateAuthUI, handleLogout, renderAuthForm } from './js/auth.js';

// Função principal de inicialização
async function main() {
    showLoader(true);
    initializeEventListeners();
    
    const products = await fetchInitialData();
    if (products) {
        renderProducts(products.slice(0, 4), 'product-list-home');
        applyFiltersAndRender(); // Renderiza a página de fragrâncias com todos os produtos inicialmente
    }
    fetchAndRenderReels();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                setCurrentUserData({ uid: user.uid, ...userDoc.data() });
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
        document.querySelectorAll('#filter-categories input[type="checkbox"]').forEach(cb => {
            cb.checked = cb.value === categoryFilter;
        });
        applyFiltersAndRender();
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
    } else if (pageId === 'fragrancias') {
        applyFiltersAndRender();
    }
}

// Lógica de Filtros e Ordenação
function applyFiltersAndRender() {
    const categoryFilters = Array.from(document.querySelectorAll('#filter-categories input:checked')).map(cb => cb.value);
    const priceFilter = document.getElementById('price-range-filter').value;
    const sortBy = document.getElementById('sort-by').value;

    let filteredProducts = [...state.allProducts];

    // Aplicar filtro de categoria
    if (categoryFilters.length > 0) {
        filteredProducts = filteredProducts.filter(p => categoryFilters.includes(p.category));
    }

    // Aplicar filtro de preço
    filteredProducts = filteredProducts.filter(p => p.price <= priceFilter);

    // Aplicar ordenação
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
        case 'popularity':
        default:
            filteredProducts.sort((a, b) => (b.reviews?.length || 0) - (a.reviews?.length || 0));
            break;
    }
    
    const noProductsEl = document.getElementById('no-products-found');
    if (filteredProducts.length === 0) {
        noProductsEl.classList.remove('hidden');
    } else {
        noProductsEl.classList.add('hidden');
    }

    renderProducts(filteredProducts, 'product-list-fragrancias');
}

// Inicialização dos Event Listeners
function initializeEventListeners() {
    AOS.init({ duration: 800, once: true });
    setupCartEventListeners();

    document.body.addEventListener('click', async (e) => {
        const navLink = e.target.closest('.nav-link, .mobile-nav-link, .nav-link-button');
        if (navLink) {
            e.preventDefault();
            showPage(navLink.dataset.page, navLink.dataset.categoryFilter);
            if(e.target.closest('.mobile-nav-link')) toggleMobileMenu(false);
        }

        const productAction = e.target.closest('[data-id]');
        if (productAction) {
            const id = productAction.dataset.id;
            if (productAction.matches('.quick-view-btn, .product-image-link, .product-name-link')) {
                showProductDetails(id);
            } else if (productAction.matches('.add-to-cart-btn')) {
                addToCart(id, 1, e);
            } else if (productAction.matches('.wishlist-heart')) {
                e.preventDefault();
                await toggleWishlist(id);
            }
        }
        
        // UI controls
        if (e.target.closest('#mobile-menu-button')) toggleMobileMenu(true);
        if (e.target.closest('#close-mobile-menu, #mobile-menu-overlay')) toggleMobileMenu(false);
        if (e.target.closest('#cart-button, #mobile-bottom-cart-btn')) { renderCart(); toggleModal('cart-modal', true); }
        if (e.target.closest('#close-cart-button, #cart-modal-overlay')) toggleModal('cart-modal', false);
        if (e.target.closest('#user-button, #mobile-user-link, #mobile-bottom-user-link')) {
            e.preventDefault();
            if(state.currentUserData) showPage('profile');
            else { renderAuthForm(); toggleModal('auth-modal', true); }
        }
        if (e.target.closest('#close-auth-modal, #auth-modal-overlay')) toggleModal('auth-modal', false);
        if (e.target.closest('#close-product-details-modal, #product-details-modal-overlay')) toggleModal('product-details-modal', false);
        if (e.target.closest('#logout-button')) handleLogout();
        if (e.target.closest('#login-to-review')) {
            e.preventDefault();
            toggleModal('product-details-modal', false);
            renderAuthForm();
            toggleModal('auth-modal', true);
        }
    });

    // Listeners de formulário
    document.body.addEventListener('submit', (e) => {
        if (e.target.id.startsWith('review-form-')) {
            handleReviewSubmit(e, e.target.dataset.productId);
        }
        if (e.target.id === 'coupon-form') {
            e.preventDefault();
            applyCoupon(e.target.querySelector('#coupon-input').value);
        }
    });

    // Listeners para filtros
    document.querySelectorAll('.filter-control').forEach(el => {
        el.addEventListener('change', applyFiltersAndRender);
    });
    const priceRange = document.getElementById('price-range-filter');
    const priceValue = document.getElementById('price-range-value');
    if(priceRange && priceValue) {
        priceRange.addEventListener('input', () => {
            priceValue.textContent = `R$ ${priceRange.value}`;
            applyFiltersAndRender();
        });
    }
}

// Função para aplicar cupom
function applyCoupon(code) {
    const coupon = state.allCoupons.find(c => c.code.toUpperCase() === code.toUpperCase());
    if (coupon) {
        setAppliedCoupon(coupon);
        showToast(`Cupom "${coupon.code}" aplicado com sucesso!`);
    } else {
        setAppliedCoupon(null);
        showToast("Cupom inválido ou expirado.", true);
    }
    renderCart(); // Re-renderiza o carrinho para mostrar o desconto
}

// Função para Wishlist
async function toggleWishlist(productId) {
    if (!state.currentUserData) {
        showToast("Você precisa estar logado para usar a lista de desejos.", true);
        toggleModal('auth-modal', true);
        return;
    }

    const userRef = doc(db, "users", state.currentUserData.uid);
    const heartButton = document.querySelector(`.wishlist-heart[data-id="${productId}"]`);
    heartButton.disabled = true;

    try {
        if (state.currentUserData.wishlist.includes(productId)) {
            // Remove from wishlist
            await updateDoc(userRef, { wishlist: arrayRemove(productId) });
            state.currentUserData.wishlist = state.currentUserData.wishlist.filter(id => id !== productId);
            showToast("Removido da lista de desejos.");
            heartButton.classList.remove('active');
        } else {
            // Add to wishlist
            await updateDoc(userRef, { wishlist: arrayUnion(productId) });
            state.currentUserData.wishlist.push(productId);
            showToast("Adicionado à lista de desejos!");
            heartButton.classList.add('active');
        }
    } catch (error) {
        console.error("Erro ao atualizar a lista de desejos:", error);
        showToast("Ocorreu um erro. Tente novamente.", true);
    } finally {
        heartButton.disabled = false;
        // Atualiza a UI em todos os lugares
        refreshAllProductViews();
    }
}


// Inicia a aplicação
document.addEventListener('DOMContentLoaded', main);
