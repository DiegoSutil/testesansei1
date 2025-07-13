/**
 * @fileoverview Ponto de Entrada Principal da Aplicação (Maestro).
 * Orquestra a inicialização dos módulos e a gestão de eventos globais.
 */

// Módulos do Firebase
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from './firebase-config.js';

// Módulos da Aplicação
import { state, setCurrentUserData, setCart, setAppliedCoupon, setSelectedShipping } from './js/state.js';
import { showLoader, toggleModal, toggleMobileMenu, showToast } from './js/ui.js';
import { fetchInitialData, fetchAndRenderReels } from './js/api.js';
import { renderProducts, showProductDetails, handleReviewSubmit, createProductCardTemplate } from './js/product.js';
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

    if (categoryFilters.length > 0) {
        filteredProducts = filteredProducts.filter(p => categoryFilters.includes(p.category));
    }

    filteredProducts = filteredProducts.filter(p => p.price <= priceFilter);

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

        const star = e.target.closest('#review-rating-stars > i');
        if (star) {
            const ratingValue = star.dataset.value;
            const starsContainer = star.parentElement;
            const ratingInput = document.getElementById('review-rating-value');
            if(ratingInput) ratingInput.value = ratingValue;
            const allStars = starsContainer.querySelectorAll('i');
            allStars.forEach(s => {
                const isFilled = parseInt(s.dataset.value) <= parseInt(ratingValue);
                s.classList.toggle('filled', isFilled);
                s.classList.toggle('text-yellow-500', isFilled);
                s.classList.toggle('text-gray-300', !isFilled);
            });
            feather.replace();
        }

        const faqQuestion = e.target.closest('.faq-question');
        if (faqQuestion) {
            const answer = faqQuestion.nextElementSibling;
            const icon = faqQuestion.querySelector('i');
            const isExpanded = faqQuestion.getAttribute('aria-expanded') === 'true';
            faqQuestion.setAttribute('aria-expanded', !isExpanded);
            answer.classList.toggle('hidden');
            icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
        }

        const calculateShippingBtn = e.target.closest('#calculate-shipping-btn');
        if(calculateShippingBtn) handleShippingCalculation();

        const searchResultItem = e.target.closest('.search-result-item');
        if (searchResultItem) {
            e.preventDefault();
            showProductDetails(searchResultItem.dataset.id);
            document.getElementById('search-bar').classList.add('hidden');
            document.getElementById('search-results').innerHTML = '';
            document.getElementById('search-input').value = '';
        }

        const footerLinkPlaceholder = e.target.closest('.footer-link-placeholder');
        if(footerLinkPlaceholder) {
            e.preventDefault();
            showToast('Página em construção.', true);
        }
    });

    document.body.addEventListener('submit', (e) => {
        if (e.target.id.startsWith('review-form-')) {
            handleReviewSubmit(e, e.target.dataset.productId);
        }
        if (e.target.id === 'coupon-form') {
            e.preventDefault();
            applyCoupon(e.target.querySelector('#coupon-input').value);
        }
        if (e.target.id === 'contact-form') {
            e.preventDefault();
            showToast('Mensagem enviada com sucesso! (Simulação)');
            e.target.reset();
        }
        if (e.target.id === 'newsletter-form') {
            e.preventDefault();
            showToast('Obrigado por se inscrever! (Simulação)');
            e.target.reset();
        }
    });

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

    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        if (searchTerm.length < 2) {
            searchResultsContainer.innerHTML = '';
            return;
        }
        const results = state.allProducts.filter(p => 
            p.name.toLowerCase().includes(searchTerm) ||
            p.category.toLowerCase().includes(searchTerm) ||
            p.description.toLowerCase().includes(searchTerm)
        );
        if (results.length > 0) {
            searchResultsContainer.innerHTML = results.slice(0, 5).map(product => `
                <a href="#" class="flex items-center gap-4 p-2 hover:bg-gray-100 rounded-md search-result-item" data-id="${product.id}">
                    <img src="${product.image}" alt="${product.name}" class="w-12 h-12 object-cover rounded-md">
                    <div>
                        <p class="font-semibold">${product.name}</p>
                        <p class="text-sm text-gray-500">R$ ${product.price.toFixed(2).replace('.', ',')}</p>
                    </div>
                </a>
            `).join('');
        } else {
            searchResultsContainer.innerHTML = '<p class="p-2 text-gray-500">Nenhum resultado encontrado.</p>';
        }
    });
}

function applyCoupon(code) {
    const coupon = state.allCoupons.find(c => c.code.toUpperCase() === code.toUpperCase());
    if (coupon) {
        setAppliedCoupon(coupon);
        showToast(`Cupom "${coupon.code}" aplicado com sucesso!`);
    } else {
        setAppliedCoupon(null);
        showToast("Cupom inválido ou expirado.", true);
    }
    renderCart();
}

async function toggleWishlist(productId) {
    if (!state.currentUserData) {
        showToast("Você precisa estar logado para usar a lista de desejos.", true);
        toggleModal('auth-modal', true);
        return;
    }

    const userRef = doc(db, "users", state.currentUserData.uid);
    const heartButtons = document.querySelectorAll(`.wishlist-heart[data-id="${productId}"]`);
    heartButtons.forEach(btn => btn.disabled = true);

    try {
        if (state.currentUserData.wishlist.includes(productId)) {
            await updateDoc(userRef, { wishlist: arrayRemove(productId) });
            state.currentUserData.wishlist = state.currentUserData.wishlist.filter(id => id !== productId);
            showToast("Removido da lista de desejos.");
        } else {
            await updateDoc(userRef, { wishlist: arrayUnion(productId) });
            state.currentUserData.wishlist.push(productId);
            showToast("Adicionado à lista de desejos!");
        }
    } catch (error) {
        console.error("Erro ao atualizar a lista de desejos:", error);
        showToast("Ocorreu um erro. Tente novamente.", true);
    } finally {
        heartButtons.forEach(btn => btn.disabled = false);
        refreshAllProductViews();
    }
}

async function handleShippingCalculation() {
    const cepInput = document.getElementById('cep-input');
    const cep = cepInput.value.replace(/\D/g, '');
    const shippingOptionsEl = document.getElementById('shipping-options');
    const calculateBtn = document.getElementById('calculate-shipping-btn');
    const btnText = calculateBtn.querySelector('.btn-text');
    const loader = calculateBtn.querySelector('.loader-sm');

    if (cep.length !== 8) {
        showToast("Por favor, insira um CEP válido.", true);
        return;
    }

    btnText.classList.add('hidden');
    loader.classList.remove('hidden');
    calculateBtn.disabled = true;

    await new Promise(resolve => setTimeout(resolve, 1500));

    const options = [
        { name: 'SEDEX', price: parseFloat((Math.random() * 15 + 25).toFixed(2)), days: '3-5 dias úteis' },
        { name: 'PAC', price: parseFloat((Math.random() * 10 + 15).toFixed(2)), days: '7-12 dias úteis' }
    ];

    shippingOptionsEl.innerHTML = options.map(opt => `
        <label class="flex items-center justify-between p-3 border rounded-md cursor-pointer hover:bg-gray-100">
            <div class="flex items-center">
                <input type="radio" name="shipping-option" class="h-4 w-4 text-black focus:ring-black" value='${JSON.stringify(opt)}'>
                <div class="ml-3 text-sm">
                    <p class="font-semibold">${opt.name}</p>
                    <p class="text-gray-500">${opt.days}</p>
                </div>
            </div>
            <span class="font-semibold">R$ ${opt.price.toFixed(2).replace('.', ',')}</span>
        </label>
    `).join('');

    shippingOptionsEl.querySelectorAll('input[name="shipping-option"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const selectedOption = JSON.parse(e.target.value);
            setSelectedShipping(selectedOption);
            renderCart();
        });
    });

    btnText.classList.remove('hidden');
    loader.classList.add('hidden');
    calculateBtn.disabled = false;
}

document.addEventListener('DOMContentLoaded', main);
