/**
 * @fileoverview Ponto de Entrada Principal da Aplicação (Maestro).
 * Orquestra a inicialização dos módulos, navegação e gestão de eventos globais.
 * VERSÃO CORRIGIDA E ATUALIZADA
 */

// Módulos do Firebase
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from './firebase-config.js';

// Módulos da Aplicação
import { state, setCurrentUserData, setCart, setAllProducts, setAllCoupons, setAppliedCoupon, setSelectedShipping } from './js/state.js';
import { showLoader, toggleModal, toggleMobileMenu, showToast } from './js/ui.js';
import { fetchInitialData, fetchAndRenderReels } from './js/api.js';
import { renderProducts, showProductDetails, handleReviewSubmit } from './js/product.js';
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
            // Se o item já existe, soma as quantidades (pode adicionar lógica de limite de estoque aqui se necessário)
            existingItem.quantity += localItem.quantity;
        } else {
            // Se o item não existe, simplesmente adiciona
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

                // FIX: Lógica de mesclagem de carrinho para não perder itens do visitante
                const firestoreCart = userDoc.data().cart || [];
                const localCart = JSON.parse(localStorage.getItem('sanseiCart')) || [];

                if (localCart.length > 0) {
                    const mergedCart = mergeCarts(localCart, firestoreCart);
                    setCart(mergedCart);
                    await syncCartWithFirestore(); // Sincroniza o carrinho mesclado de volta para o Firestore
                    localStorage.removeItem('sanseiCart'); // Limpa o carrinho local antigo
                } else {
                    setCart(firestoreCart);
                }
            }
        } else {
            setCurrentUserData(null);
            // Carrega o carrinho do visitante se não houver usuário logado
            setCart(JSON.parse(localStorage.getItem('sanseiCart')) || []);
        }
        updateAuthUI(user);
        updateCartIcon();
        renderCart(); // Garante que o carrinho seja renderizado com os dados corretos
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
            productsToRender = allProducts.filter(p => p.category === categoryFilter || p.gender === categoryFilter);
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

        // Navegação
        const navLink = target.closest('.nav-link, .mobile-nav-link, .nav-link-button, .footer-link, .mobile-bottom-nav a');
        if (navLink && navLink.dataset.page) {
            e.preventDefault();
            showPage(navLink.dataset.page, navLink.dataset.categoryFilter);
            if(target.closest('.mobile-nav-link')) toggleMobileMenu(false);
        }

        // Ações de Produto
        const productCard = target.closest('[data-id]');
        if (productCard) {
            const id = productCard.dataset.id;
            if (target.closest('.add-to-cart-btn')) {
                 addToCart(id, 1, e);
            } else if (target.closest('.wishlist-heart')) {
                // Lógica da wishlist (se aplicável)
            } else if (target.closest('.product-image-link, .product-name-link')) {
                 e.preventDefault();
                 showProductDetails(id);
            }
        }
        
        // UI Modals e Menus
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

        // Link para login no formulário de avaliação
        if (target.closest('#login-to-review')) {
            e.preventDefault();
            toggleModal('product-details-modal', false);
            renderAuthForm();
            toggleModal('auth-modal', true);
        }

        // Botão para ir ao Checkout
        if (target.closest('#checkout-button')) {
            e.preventDefault();
            // FIX: Garante que os dados necessários são salvos antes de ir para o checkout
            if (state.cart.length === 0) {
                showToast("Seu carrinho está vazio.", true);
                return;
            }
            localStorage.setItem('sanseiAllProducts', JSON.stringify(state.allProducts));
            localStorage.setItem('sanseiCoupon', JSON.stringify(state.appliedCoupon));
            localStorage.setItem('sanseiShipping', JSON.stringify(state.selectedShipping));
            window.location.href = './checkout.html';
        }
        
        // Botão de calcular frete
        if (target.closest('#calculate-shipping-btn')) {
            const cepInput = document.getElementById('cep-input');
            if (cepInput) calculateShipping(cepInput.value);
        }
    });

    // Listeners de Formulário
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

// Inicia a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', main);
