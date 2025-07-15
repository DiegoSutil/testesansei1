/**
 * @fileoverview Ponto de Entrada Principal da Aplicação (Maestro).
 * Orquestra a inicialização dos módulos, navegação e gestão de eventos globais.
 * VERSÃO CORRIGIDA E ATUALIZADA
 */

// Módulos do Firebase
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from './firebase-config.js';

// Módulos da Aplicação
import { state, setCurrentUserData, setCart } from './js/state.js';
import { showLoader, toggleModal, toggleMobileMenu, showToast } from './js/ui.js';
import { fetchInitialData, fetchAndRenderReels } from './js/api.js';
import { renderProducts, showProductDetails, handleReviewSubmit } from './js/product.js';
// FIX: A importação de 'syncCartWithFirestore' agora funciona porque a função foi exportada em cart.js
import { addToCart, updateCartIcon, renderCart, syncCartWithFirestore } from './js/cart.js';
import { updateAuthUI, handleLogout, renderAuthForm, renderWishlist, renderOrders } from './js/auth.js';
import { applyCoupon } from './js/coupons.js';
import { calculateShipping } from './shipping.js';


// Função para mesclar carrinhos ao fazer login
function mergeCarts(localCart, firestoreCart) {
    const merged = [...firestoreCart];
    localCart.forEach(localItem => {
        const existingItem = merged.find(item => item.id === localItem.id);
        if (existingItem) {
            existingItem.quantity += localItem.quantity;
        } else {
            merged.push(localItem);
        }
    });
    return merged;
}


// Função principal de inicialização
async function main() {
    showLoader(true);
    initializeEventListeners();
    
    await fetchInitialData();
    renderProducts(state.allProducts.slice(0, 4), 'product-list-home');
    fetchAndRenderReels();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                setCurrentUserData({ uid: user.uid, ...userDoc.data() });

                const firestoreCart = userDoc.data().cart || [];
                const localCart = JSON.parse(localStorage.getItem('sanseiCart')) || [];

                if (localCart.length > 0) {
                    const mergedCart = mergeCarts(localCart, firestoreCart);
                    setCart(mergedCart);
                    await syncCartWithFirestore();
                    localStorage.removeItem('sanseiCart');
                } else {
                    setCart(firestoreCart);
                }
            }
        } else {
            setCurrentUserData(null);
            setCart(JSON.parse(localStorage.getItem('sanseiCart')) || []);
        }
        updateAuthUI(user);
        updateCartIcon();
        renderCart();
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

    if (pageId === 'produtos') {
        const allProducts = state.allProducts;
        let productsToRender = allProducts;
        let title = "Nossos Produtos";
        let subtitle = "Explore a coleção completa.";

        if (categoryFilter) {
            productsToRender = allProducts.filter(p => p.category === categoryFilter || (p.gender && p.gender === categoryFilter));
            title = categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1);
            subtitle = `Descubra nossa seleção de ${title}.`;
        }
        
        document.getElementById('produtos-page-title').textContent = title;
        document.getElementById('produtos-page-subtitle').textContent = subtitle;
        renderProducts(productsToRender, 'product-list-produtos');
    } else if (pageId === 'profile') {
        renderWishlist();
        renderOrders();
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
}

// Inicialização dos Event Listeners
function initializeEventListeners() {
    AOS.init({ duration: 800, once: true });

    document.body.addEventListener('click', (e) => {
        const target = e.target;

        const navLink = target.closest('.nav-link, .mobile-nav-link, .nav-link-button, .footer-link, .mobile-bottom-nav a');
        if (navLink && navLink.dataset.page) {
            e.preventDefault();
            showPage(navLink.dataset.page, navLink.dataset.categoryFilter);
            if(target.closest('.mobile-nav-link')) toggleMobileMenu(false);
        }

        const productCard = target.closest('[data-id]');
        if (productCard) {
            const id = productCard.dataset.id;
            if (target.closest('.add-to-cart-btn')) {
                 addToCart(id, 1, e);
            } else if (target.closest('.wishlist-heart')) {
                // Lógica da wishlist
            } else if (target.closest('.product-image-link, .product-name-link')) {
                 e.preventDefault();
                 showProductDetails(id);
            }
        }
        
        if (target.closest('#mobile-menu-button')) toggleMobileMenu(true);
        if (target.closest('#close-mobile-menu, #mobile-menu-overlay')) toggleMobileMenu(false);
        if (target.closest('#cart-button, #mobile-bottom-cart-btn')) toggleModal('cart-modal', true);
        if (target.closest('#close-cart-button, #cart-modal-overlay')) toggleModal('cart-modal', false);
        if (target.closest('#user-button, #mobile-bottom-user-link')) {
            e.preventDefault();
            if(state.currentUserData) showPage('profile');
            else { renderAuthForm(); toggleModal('auth-modal', true); }
        }
        if (target.closest('#close-auth-modal, #auth-modal-overlay')) toggleModal('auth-modal', false);
        if (target.closest('#close-product-details-modal, #product-details-modal-overlay')) toggleModal('product-details-modal', false);
        if (target.closest('#logout-button')) handleLogout();

        if (target.closest('#login-to-review')) {
            e.preventDefault();
            toggleModal('product-details-modal', false);
            renderAuthForm();
            toggleModal('auth-modal', true);
        }

        if (target.closest('#checkout-button')) {
            e.preventDefault();
            if (state.cart.length === 0) {
                showToast("Seu carrinho está vazio.", true);
                return;
            }
            localStorage.setItem('sanseiAllProducts', JSON.stringify(state.allProducts));
            localStorage.setItem('sanseiCoupon', JSON.stringify(state.appliedCoupon));
            localStorage.setItem('sanseiShipping', JSON.stringify(state.selectedShipping));
            window.location.href = './checkout.html';
        }
        
        if (target.closest('#calculate-shipping-btn')) {
            const cepInput = document.getElementById('cep-input');
            if (cepInput) calculateShipping(cepInput.value);
        }
    });

    document.body.addEventListener('submit', (e) => {
        if (e.target.id.startsWith('review-form-')) {
            handleReviewSubmit(e, e.target.dataset.productId);
        }
        if (e.target.id === 'coupon-form') {
            e.preventDefault();
            const couponInput = document.getElementById('coupon-input');
            if(couponInput) applyCoupon(couponInput.value);
        }
    });
}

document.addEventListener('DOMContentLoaded', main);
