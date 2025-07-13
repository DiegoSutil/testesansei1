/**
 * @fileoverview Ponto de Entrada Principal da Aplicação (Maestro).
 * Orquestra a inicialização dos módulos e a gestão de eventos globais.
 */

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from './firebase-config.js';

import { state, setCurrentUserData, setCart } from './js/state.js';
import { showLoader, toggleModal, toggleMobileMenu } from './js/ui.js';
import { fetchInitialData, fetchAndRenderReels } from './js/api.js';
import { renderProducts, showProductDetails, handleReviewSubmit, applyFilters } from './js/product.js';
import { addToCart, updateCartIcon, renderCart, updateQuantity, handleCalculateShipping } from './js/cart.js';
import { handleLogout, renderAuthForm, updateAuthUI } from './js/auth.js';
import { showPage, refreshAllProductViews } from './js/navigation.js';

async function main() {
    showLoader(true);
    initializeEventListeners();
    
    const products = await fetchInitialData();
    renderProducts(products.slice(0, 4), 'product-list-home');
    await fetchAndRenderReels();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                setCurrentUserData({ uid: user.uid, ...userDoc.data() });
                const firestoreCart = userDoc.data().cart || [];
                const localCart = JSON.parse(localStorage.getItem('sanseiCart')) || [];
                
                const mergedCartMap = new Map();
                firestoreCart.forEach(item => mergedCartMap.set(item.id, { ...item }));
                localCart.forEach(localItem => {
                    if (mergedCartMap.has(localItem.id)) {
                        mergedCartMap.get(localItem.id).quantity += localItem.quantity;
                    } else {
                        mergedCartMap.set(localItem.id, { ...localItem });
                    }
                });

                const mergedCart = Array.from(mergedCartMap.values());
                setCart(mergedCart);
                localStorage.removeItem('sanseiCart');
                if (mergedCart.length > 0) {
                    await updateDoc(userDocRef, { cart: mergedCart });
                }
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

function initializeEventListeners() {
    AOS.init({ duration: 800, once: true });

    document.body.addEventListener('click', (e) => {
        const target = e.target;
        const closest = (selector) => target.closest(selector);

        // Navegação
        const navLink = closest('.nav-link, .mobile-nav-link, .nav-link-button');
        if (navLink) {
            e.preventDefault();
            showPage(navLink.dataset.page, navLink.dataset.categoryFilter);
            if (closest('.mobile-nav-link')) toggleMobileMenu(false);
            return;
        }

        // Ações de Produto
        const productAction = closest('[data-id]');
        if (productAction) {
            const id = productAction.dataset.id;
            if (productAction.matches('.quick-view-btn, img, h3')) showProductDetails(id);
            else if (productAction.matches('.add-to-cart-btn')) addToCart(id, 1, e);
            else if (productAction.matches('.wishlist-heart')) console.log("Wishlist a ser implementado"); // Lógica de wishlist
            else if (productAction.matches('.cart-qty-btn')) updateQuantity(id, parseInt(productAction.dataset.qty));
            else if (productAction.matches('.cart-remove-btn')) updateQuantity(id, 0); // Reutiliza updateQuantity para remover
            return;
        }
        
        // UI
        if (closest('#mobile-menu-button')) toggleMobileMenu(true);
        if (closest('#close-mobile-menu, #mobile-menu-overlay')) toggleMobileMenu(false);
        if (closest('#cart-button, #mobile-bottom-cart-btn')) { renderCart(); toggleModal('cart-modal', true); }
        if (closest('#close-cart-button, #cart-modal-overlay')) toggleModal('cart-modal', false);
        if (closest('#user-button, #mobile-bottom-user-link')) {
            e.preventDefault();
            if(state.currentUserData) showPage('profile');
            else { renderAuthForm(); toggleModal('auth-modal', true); }
        }
        if (closest('#close-auth-modal, #auth-modal-overlay')) toggleModal('auth-modal', false);
        if (closest('#close-product-details-modal, #product-details-modal-overlay')) toggleModal('product-details-modal', false);
        if (closest('#logout-button')) handleLogout();
        if (closest('#calculate-shipping-btn')) handleCalculateShipping();
        if (closest('#login-to-review')) {
            e.preventDefault();
            toggleModal('product-details-modal', false);
            renderAuthForm();
            toggleModal('auth-modal', true);
        }
        if (closest('#auth-switch')) {
            e.preventDefault();
            const isLogin = closest('#auth-form button').textContent.trim() === 'Entrar';
            renderAuthForm(!isLogin);
        }
    });

    // Eventos de formulário
    document.body.addEventListener('submit', (e) => {
        if (e.target.id.startsWith('review-form-')) handleReviewSubmit(e, e.target.dataset.productId);
        if (e.target.id === 'auth-form') {
            const isLogin = e.target.querySelector('button').textContent.trim() === 'Entrar';
            isLogin ? handleLogin(e) : handleRegister(e);
        }
    });
    
    // Filtros
    document.querySelectorAll('.filter-control').forEach(el => {
        el.addEventListener('change', () => applyFilters());
    });
}

document.addEventListener('DOMContentLoaded', main);
