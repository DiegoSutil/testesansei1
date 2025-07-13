/**
 * @fileoverview Ponto de Entrada Principal da Aplicação (Maestro).
 * Orquestra a inicialização dos módulos e a gestão de eventos globais.
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
import { updateAuthUI, handleLogout, renderAuthForm } from './js/auth.js';

// Função principal de inicialização
async function main() {
    showLoader(true);
    
    const products = await fetchInitialData();
    if (products) {
        renderProducts(products.slice(0, 4), 'product-list-home');
        applyFiltersAndRender(true); 
    }
    fetchAndRenderReels();
    initializeEventListeners();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                setCurrentUserData({ uid: user.uid, ...userDoc.data() });
                const firestoreCart = userDoc.data().cart || [];
                setCart(firestoreCart);
                localStorage.removeItem('sanseiCart');
            } else {
                await setDoc(userDocRef, { email: user.email, wishlist: [], cart: [] });
                setCurrentUserData({ uid: user.uid, email: user.email, wishlist: [], cart: [] });
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
function showPage(pageId, categoryFilter = null) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
        window.scrollTo(0, 0);
    }
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === pageId);
    });

    if (pageId === 'fragrancias') {
        document.querySelectorAll('#filter-categories input[type="checkbox"]').forEach(cb => {
            cb.checked = cb.value === categoryFilter;
        });
        applyFiltersAndRender(true);
    } else if (pageId === 'decants') {
        const decantProducts = state.allProducts.filter(p => p.category === 'decant');
        renderProducts(decantProducts, 'product-list-decants');
    }
}
window.showPage = showPage;

function refreshAllProductViews() {
    const currentPageEl = document.querySelector('.page-content:not(.hidden)');
    if (!currentPageEl) return;
    const pageId = currentPageEl.id.replace('page-', '');

    if (pageId === 'inicio') {
        renderProducts(state.allProducts.slice(0, 4), 'product-list-home');
    } else if (pageId === 'fragrancias') {
        applyFiltersAndRender(true);
    }
}

// Lógica de Filtros e Paginação
function applyFiltersAndRender(resetPage = false) {
    if (resetPage) {
        setFragrancePage(1);
    }

    const categoryFilters = Array.from(document.querySelectorAll('#filter-categories input:checked')).map(cb => cb.value);
    const priceFilter = document.getElementById('price-range-filter').value;
    const sortBy = document.getElementById('sort-by').value;

    let filteredProducts = [...state.allProducts];

    if (categoryFilters.length > 0) {
        filteredProducts = filteredProducts.filter(p => categoryFilters.includes(p.category));
    }

    filteredProducts = filteredProducts.filter(p => p.price <= priceFilter);

    switch (sortBy) {
        case 'price-asc': filteredProducts.sort((a, b) => a.price - b.price); break;
        case 'price-desc': filteredProducts.sort((a, b) => b.price - a.price); break;
        case 'name-asc': filteredProducts.sort((a, b) => a.name.localeCompare(b.name)); break;
        case 'name-desc': filteredProducts.sort((a, b) => b.name.localeCompare(a.name)); break;
        default: filteredProducts.sort((a, b) => (b.reviews?.length || 0) - (a.reviews?.length || 0)); break;
    }
    
    const productListEl = document.getElementById('product-list-fragrancias');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const noProductsEl = document.getElementById('no-products-found');
    
    const start = (state.fragrancePage - 1) * productsPerPage;
    const end = start + productsPerPage;
    const productsToRender = filteredProducts.slice(start, end);

    if (resetPage) {
        renderProducts(productsToRender, 'product-list-fragrancias');
    } else {
        productListEl.insertAdjacentHTML('beforeend', productsToRender.map((p, i) => createProductCardTemplate(p, i * 100)).join(''));
        feather.replace();
        AOS.refresh();
    }

    if (noProductsEl) noProductsEl.classList.toggle('hidden', filteredProducts.length > 0);

    if (loadMoreBtn) {
        if (filteredProducts.length > end) {
            loadMoreBtn.classList.remove('hidden');
        } else {
            loadMoreBtn.classList.add('hidden');
        }
    }
}


// Lógica do Quiz
const quizQuestions = [
    { question: "Para quem é o perfume?", answers: ["Feminino", "Masculino", "Unissex"], key: "gender" },
    { question: "Que tipo de aroma prefere?", answers: ["Cítrico", "Doce", "Amadeirado", "Floral"], key: "aroma" },
    { question: "Qual a ocasião?", answers: ["Dia a dia", "Trabalho", "Evento Especial"], key: "occasion" },
];
let currentQuizStep = 0;
let quizAnswers = {};

function renderQuizStep(step) {
    const quizModal = document.getElementById('quiz-modal');
    const question = quizQuestions[step];
    
    quizModal.innerHTML = `
        <div class="p-8">
            <div class="flex justify-between items-center mb-6">
                <h3 id="quiz-modal-title" class="text-2xl font-bold">${question.question}</h3>
                <button id="close-quiz-modal" class="text-slate-500 hover:text-black"><i data-feather="x"></i></button>
            </div>
            <div class="grid grid-cols-2 gap-4">
                ${question.answers.map(answer => `
                    <button class="quiz-option border-2 border-gray-200 rounded-lg p-4 text-center hover:border-black" data-answer="${answer}">
                        ${answer}
                    </button>
                `).join('')}
            </div>
            <div class="flex justify-between mt-8">
                <button id="quiz-back-btn" class="inline-flex items-center justify-center font-semibold py-2 px-6 rounded-full bg-slate-200 text-slate-800 ${step === 0 ? 'invisible' : ''}">Voltar</button>
            </div>
        </div>
    `;
    feather.replace();
}

function showQuizResults() {
    const quizModal = document.getElementById('quiz-modal');
    const recommended = state.allProducts.filter(p => {
        return (quizAnswers.gender ? p.category === quizAnswers.gender.toLowerCase() : true);
    }).slice(0, 3);

    quizModal.innerHTML = `
        <div class="p-8 text-center">
             <button id="close-quiz-modal" class="absolute top-4 right-4 text-slate-500 hover:text-black"><i data-feather="x"></i></button>
            <h3 class="text-2xl font-bold mb-4">Nossas Recomendações para Si!</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
                ${recommended.length > 0 ? recommended.map(p => createProductCardTemplate(p)).join('') : '<p class="col-span-full">Não encontrámos recomendações. Tente outras opções!</p>'}
            </div>
            <button id="quiz-restart-btn" class="inline-flex items-center justify-center font-semibold py-2 px-6 rounded-full bg-slate-200 text-slate-800">Recomeçar Quiz</button>
        </div>
    `;
    feather.replace();
}

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
        
        if (e.target.closest('#start-quiz-btn')) {
            currentQuizStep = 0;
            quizAnswers = {};
            renderQuizStep(currentQuizStep);
            toggleModal('quiz-modal', true);
        }
        if (e.target.closest('#close-quiz-modal, #quiz-modal-overlay')) {
            toggleModal('quiz-modal', false);
        }
        if (e.target.closest('.quiz-option')) {
            quizAnswers[quizQuestions[currentQuizStep].key] = e.target.closest('.quiz-option').dataset.answer;
            currentQuizStep++;
            if (currentQuizStep < quizQuestions.length) {
                renderQuizStep(currentQuizStep);
            } else {
                showQuizResults();
            }
        }
        if (e.target.closest('#quiz-back-btn')) {
            currentQuizStep--;
            renderQuizStep(currentQuizStep);
        }
        if (e.target.closest('#quiz-restart-btn')) {
            currentQuizStep = 0;
            quizAnswers = {};
            renderQuizStep(currentQuizStep);
        }
        if (e.target.closest('#load-more-btn')) {
            incrementFragrancePage();
            applyFiltersAndRender(false);
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
        el.addEventListener('change', () => applyFiltersAndRender(true));
    });
    const priceRange = document.getElementById('price-range-filter');
    const priceValue = document.getElementById('price-range-value');
    if(priceRange && priceValue) {
        priceRange.addEventListener('input', () => {
            priceValue.textContent = `R$ ${priceRange.value}`;
        });
        priceRange.addEventListener('change', () => applyFiltersAndRender(true));
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
            (p.description && p.description.toLowerCase().includes(searchTerm))
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
