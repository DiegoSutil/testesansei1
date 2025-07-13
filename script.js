/**
 * @fileoverview Ponto de Entrada Principal da Aplicação (Maestro).
 * Orquestra a inicialização dos módulos e a gestão de eventos globais.
 */

// Módulos do Firebase
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from './firebase-config.js';

// Módulos da Aplicação
import { state, setCurrentUserData, setCart, setAppliedCoupon, setSelectedShipping, setFragrancePage, incrementFragrancePage } from './js/state.js';
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
        applyFiltersAndRender(true); // Renderiza a página de fragrâncias com todos os produtos inicialmente
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

    // ... (lógica de ordenação existente)

    const productListEl = document.getElementById('product-list-fragrancias');
    const loadMoreBtn = document.getElementById('load-more-btn');
    
    const start = (state.fragrancePage - 1) * state.productsPerPage;
    const end = start + state.productsPerPage;
    const productsToRender = filteredProducts.slice(start, end);

    if (resetPage) {
        renderProducts(productsToRender, 'product-list-fragrancias');
    } else {
        productListEl.insertAdjacentHTML('beforeend', productsToRender.map((p, i) => createProductCardTemplate(p, i * 100)).join(''));
        feather.replace();
        AOS.refresh();
    }

    if (filteredProducts.length > end) {
        loadMoreBtn.classList.remove('hidden');
    } else {
        loadMoreBtn.classList.add('hidden');
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
    // Lógica de recomendação simplificada (pode ser melhorada)
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


// Inicialização dos Event Listeners
function initializeEventListeners() {
    // ... (código existente)

    document.body.addEventListener('click', async (e) => {
        // ... (código existente)

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

    // ... (restante do código)
}


// ... (restante do código)

document.addEventListener('DOMContentLoaded', main);
