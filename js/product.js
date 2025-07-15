/**
 * @fileoverview Módulo de Produtos.
 * Contém a lógica para renderizar, filtrar e interagir com produtos e avaliações.
 * VERSÃO CORRIGIDA E ATUALIZADA
 */

import { doc, getDoc, updateDoc, arrayUnion, Timestamp, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../firebase-config.js';
import { state } from './state.js';
import { showToast, renderStars, toggleModal } from './ui.js';

export function createProductCardTemplate(product, delay = 0) {
    const isInWishlist = state.currentUserData && state.currentUserData.wishlist.includes(product.id);
    const priceHtml = `<p class="text-sm font-semibold text-gray-800">R$ ${product.price.toFixed(2).replace('.',',')}</p>`;

    return `
        <div class="group text-center flex flex-col" data-aos="fade-up" data-aos-delay="${delay}" role="listitem">
            <div class="relative overflow-hidden rounded-lg mb-4">
                <a href="#" class="product-image-link" data-id="${product.id}">
                    <img src="${product.image}" alt="${product.name}" class="w-full h-auto object-cover aspect-[4/5] group-hover:opacity-80 transition-opacity duration-300" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/400x500/cccccc/ffffff?text=Img';">
                </a>
                <button class="wishlist-heart absolute top-3 right-3 p-2 bg-white/80 rounded-full text-gray-500 hover:text-red-500 transition-colors" data-id="${product.id}" aria-label="${isInWishlist ? 'Remover da lista de desejos' : 'Adicionar à lista de desejos'}">
                    <i data-feather="heart" class="w-5 h-5 ${isInWishlist ? 'active' : ''}"></i>
                </button>
            </div>
            <div class="flex flex-col flex-grow">
                <h3 class="font-semibold text-sm uppercase tracking-wider mb-1">
                    <a href="#" class="product-name-link" data-id="${product.id}">${product.name}</a>
                </h3>
                <p class="text-xs text-gray-400 mb-2">${product.category ? 'Inspirado em ' + product.category : ''}</p>
                <div class="flex justify-center my-1">${renderStars(product.rating)}</div>
                <div class="mt-2">
                    ${priceHtml}
                </div>
                <div class="mt-4">
                    <button class="add-to-cart-btn bg-slate-900 text-white py-2 px-6 text-xs w-full rounded-full hover:bg-black transition-colors" data-id="${product.id}">Adicionar ao Carrinho</button>
                </div>
            </div>
        </div>
    `;
}

export function renderProducts(productsToRender, containerId, isFilterAction = false) {
    const productListEl = document.getElementById(containerId);
    if (!productListEl) return;
    
    const noProductsEl = document.getElementById('no-products-found');

    if (productsToRender.length === 0) {
         productListEl.innerHTML = '<p class="text-center text-slate-500 col-span-full mt-8">Nenhum produto encontrado.</p>';
         if (noProductsEl) noProductsEl.classList.remove('hidden');
    }
    else {
        if (noProductsEl) noProductsEl.classList.add('hidden');
        productListEl.innerHTML = productsToRender.map((product, index) => createProductCardTemplate(product, index * 100)).join('');
    }
    
    if(window.AOS) AOS.refresh();
    feather.replace();
}

function setupReviewFormListeners() {
    const reviewFormContainer = document.getElementById('product-review-form-container');
    if (!reviewFormContainer) return;

    const starsContainer = reviewFormContainer.querySelector('#review-rating-stars');
    if (starsContainer) {
        starsContainer.addEventListener('click', e => {
            const star = e.target.closest('i');
            if (!star) return;

            const ratingValue = parseInt(star.dataset.value);
            const ratingInput = document.getElementById('review-rating-value');
            ratingInput.value = ratingValue;

            const allStars = starsContainer.querySelectorAll('i');
            allStars.forEach(s => {
                s.classList.toggle('filled', parseInt(s.dataset.value) <= ratingValue);
            });
        });
    }
}

export async function handleReviewSubmit(event, productId) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const rating = parseInt(form.querySelector('#review-rating-value').value);
    const text = form.querySelector('#review-text').value.trim();

    if (!state.currentUserData) {
        showToast("Você precisa estar logado para avaliar.", true);
        return;
    }
    if (rating === 0 || text === '') {
        showToast("Por favor, preencha a nota e o comentário.", true);
        return;
    }

    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="loader-sm"></span> Enviando...';

    // FIX: Adiciona um ID único para cada avaliação para exclusão segura
    const newReview = {
        reviewId: `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: state.currentUserData.uid,
        userName: state.currentUserData.email.split('@')[0],
        rating: rating,
        text: text,
        createdAt: Timestamp.now()
    };

    try {
        const productRef = doc(db, "products", productId);
        
        const productDoc = await getDoc(productRef);
        if (!productDoc.exists()) throw new Error("Produto não encontrado");
        
        const existingReviews = productDoc.data().reviews || [];
        const totalRating = existingReviews.reduce((sum, r) => sum + r.rating, 0) + newReview.rating;
        const newAvgRating = totalRating / (existingReviews.length + 1);

        await updateDoc(productRef, { 
            reviews: arrayUnion(newReview),
            rating: newAvgRating
        });

        const productIndex = state.allProducts.findIndex(p => p.id === productId);
        if (productIndex !== -1) {
            state.allProducts[productIndex].reviews.push(newReview);
            state.allProducts[productIndex].rating = newAvgRating;
        }

        showToast("Sua avaliação foi enviada com sucesso!");
        showProductDetails(productId); 

    } catch (error) {
        console.error("Erro ao enviar avaliação: ", error);
        showToast("Ocorreu um erro ao enviar sua avaliação.", true);
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Enviar Avaliação';
    }
}

export function showProductDetails(productId) {
    const product = state.allProducts.find(p => p.id === productId);
    if (!product) return;

    const contentEl = document.getElementById('product-details-main-content');
    const extraContentEl = document.getElementById('product-details-extra-content');

    let notesHtml = '';
    if (product.notes_top || product.notes_heart || product.notes_base) {
        notesHtml = `
        <div class="mt-6 border-t pt-6">
            <h4 class="font-semibold text-lg mb-3">Pirâmide Olfativa</h4>
            <div class="text-sm text-slate-600 space-y-2">
                ${product.notes_top ? `<p><strong>Topo:</strong> ${product.notes_top}</p>` : ''}
                ${product.notes_heart ? `<p><strong>Coração:</strong> ${product.notes_heart}</p>` : ''}
                ${product.notes_base ? `<p><strong>Fundo:</strong> ${product.notes_base}</p>` : ''}
            </div>
        </div>`;
    }

    contentEl.innerHTML = `
        <div class="w-full md:w-1/2 p-4 md:p-8"><img src="${product.image}" alt="${product.name}" class="w-full h-auto object-cover rounded-lg" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/500x600/cccccc/ffffff?text=Img';"></div>
        <div class="w-full md:w-1/2 p-4 md:p-8 flex flex-col">
            <h2 id="product-details-title" class="text-3xl font-bold mb-2">${product.name}</h2>
            <p class="text-slate-600 text-md mb-2 capitalize">${product.category}</p>
            <div class="flex items-center gap-2 mb-4">
                ${renderStars(product.rating)}
                <span class="text-gray-500 text-sm">(${(product.reviews || []).length} avaliações)</span>
            </div>
            <p class="text-gray-600 mb-6 text-base leading-relaxed whitespace-pre-wrap">${product.description}</p>
            ${notesHtml}
            <div class="mt-auto">
                <p class="text-black font-bold text-3xl mb-6">R$ ${product.price.toFixed(2).replace('.',',')}</p>
                <button class="add-to-cart-btn bg-slate-900 text-white w-full py-3 text-sm rounded-full hover:bg-black transition-colors" data-id="${product.id}">Adicionar ao Carrinho</button>
            </div>
        </div>`;

    const reviewsHtml = (product.reviews && product.reviews.length > 0)
        ? [...product.reviews].sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis()).map(review => `
            <div class="border-b border-gray-200 pb-4 mb-4 last:border-b-0 last:mb-0">
                <div class="flex items-center mb-2">
                    <span class="font-semibold mr-2">${review.userName}</span>
                    ${renderStars(review.rating)}
                </div>
                <p class="text-gray-700 text-sm leading-relaxed">${review.text}</p>
            </div>`).join('')
        : '<p class="text-gray-500">Nenhuma avaliação ainda. Seja o primeiro a avaliar!</p>';

    let reviewFormHtml = state.currentUserData
        ? `<div class="mt-8 pt-6 border-t">
                <h4 class="text-xl font-bold mb-4">Deixe sua Avaliação</h4>
                <form id="review-form-${productId}" data-product-id="${productId}">
                    <div class="mb-4">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Sua nota:</label>
                        <div class="flex items-center gap-1" id="review-rating-stars">
                            ${[1,2,3,4,5].map(v => `<i data-value="${v}" data-feather="star" class="w-6 h-6 text-gray-300 cursor-pointer hover:text-yellow-400 transition-colors"></i>`).join('')}
                        </div>
                        <input type="hidden" id="review-rating-value" value="0">
                    </div>
                    <div class="mb-4">
                        <label for="review-text" class="block text-sm font-semibold text-gray-700 mb-2">Seu comentário:</label>
                        <textarea id="review-text" rows="4" class="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-black" required></textarea>
                    </div>
                    <button type="submit" class="bg-slate-900 text-white py-2 px-6 rounded-full hover:bg-black transition-colors">Enviar Avaliação</button>
                </form>
            </div>`
        : `<div class="mt-8 pt-6 border-t text-center"><p class="text-slate-600"><a href="#" id="login-to-review" class="font-semibold text-black underline">Faça login</a> para deixar sua avaliação.</p></div>`;

    const relatedProducts = state.allProducts.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);
    const relatedProductsHtml = relatedProducts.length > 0
        ? `<div class="grid grid-cols-2 md:grid-cols-4 gap-6">${relatedProducts.map(p => createProductCardTemplate(p)).join('')}</div>`
        : '<p class="text-gray-500 col-span-full">Nenhum produto relacionado encontrado.</p>';

    extraContentEl.innerHTML = `
        <h3 class="text-2xl font-bold mb-4">Avaliações de Clientes</h3>
        <div id="product-reviews-section">${reviewsHtml}</div>
        <div id="product-review-form-container">${reviewFormHtml}</div>
        <h3 class="text-2xl font-bold mt-12 mb-4">Produtos Relacionados</h3>
        <div id="related-products-section">${relatedProductsHtml}</div>`;

    feather.replace();
    toggleModal('product-details-modal', true);
    setupReviewFormListeners();
}
