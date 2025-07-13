/**
 * @fileoverview Módulo de Produtos.
 * Contém a lógica para renderizar, filtrar e interagir com produtos e avaliações.
 */

import { doc, getDoc, updateDoc, arrayUnion, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../firebase-config.js';
import { state, setAllProducts } from './state.js';
import { showToast, renderStars, toggleModal } from './ui.js';
import { createProductCard } from './cart.js'; // Importação circular pode ser um problema, vamos mover createProductCard para cá

export function createProductCardTemplate(product, delay = 0) {
    const isInWishlist = state.currentUserData && state.currentUserData.wishlist.includes(product.id);
    const priceHtml = `
        <p class="text-xl font-bold mt-auto text-slate-800">R$ ${product.price.toFixed(2).replace('.',',')}</p>
        <p class="text-xs text-slate-500">ou em até 10x de R$ ${(product.price / 10).toFixed(2).replace('.',',')} sem juros</p>
    `;

    return `
        <div class="bg-white group text-center rounded-lg shadow-sm flex flex-col transition-all-ease hover:-translate-y-2 hover:shadow-xl whitespace-normal flex-shrink-0 w-full sm:w-auto" data-aos="fade-up" data-aos-delay="${delay}" role="listitem">
            <div class="relative overflow-hidden rounded-t-lg">
                <img src="${product.image}" alt="${product.name}" class="w-full h-64 object-cover group-hover:scale-105 transition-all-ease cursor-pointer" data-id="${product.id}" loading="lazy">
                <button class="wishlist-heart absolute top-4 right-4 p-2 bg-white/70 rounded-full ${isInWishlist ? 'active' : ''}" data-id="${product.id}" aria-label="${isInWishlist ? 'Remover da lista de desejos' : 'Adicionar à lista de desejos'}">
                    <i data-feather="heart" class="w-5 h-5"></i>
                </button>
                <button class="quick-view-btn absolute bottom-0 left-0 right-0 bg-black/70 text-white py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300" data-id="${product.id}" aria-label="Visualização rápida de ${product.name}">
                    Visualização Rápida
                </button>
                <button class="add-to-cart-btn product-card-btn" data-id="${product.id}">Adicionar ao Carrinho</button>
            </div>
            <div class="p-6 flex flex-col flex-grow">
                <h3 class="font-heading font-semibold text-xl cursor-pointer" data-id="${product.id}">${product.name}</h3>
                <p class="text-slate-600 text-sm mb-2">${product.category ? product.category.charAt(0).toUpperCase() + product.category.slice(1) : ''}</p>
                <div class="flex justify-center my-2">${renderStars(product.rating)}</div>
                <div class="mt-auto">
                    ${priceHtml}
                </div>
            </div>
        </div>
    `;
}

export function renderProducts(productsToRender, containerId) {
    const productListEl = document.getElementById(containerId);
    if (!productListEl) return;
    
    if (productsToRender.length === 0) {
        productListEl.innerHTML = `<div class="col-span-full text-center text-gray-600"><p>Nenhum produto encontrado.</p></div>`;
    } else {
        productListEl.innerHTML = productsToRender.map((product, index) => createProductCardTemplate(product, index * 100)).join('');
    }
    AOS.refresh();
    feather.replace();
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

    const newReview = {
        userId: state.currentUserData.uid,
        userName: state.currentUserData.email.split('@')[0],
        rating: rating,
        text: text,
        createdAt: Timestamp.now()
    };

    try {
        const productRef = doc(db, "products", productId);
        await updateDoc(productRef, { reviews: arrayUnion(newReview) });

        const updatedDoc = await getDoc(productRef);
        const updatedReviews = updatedDoc.data().reviews || [];
        const newAvgRating = updatedReviews.reduce((sum, r) => sum + r.rating, 0) / updatedReviews.length;
        
        await updateDoc(productRef, { rating: newAvgRating });

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
        <div class="w-full md:w-1/2 p-8"><img src="${product.image}" alt="${product.name}" class="w-full h-auto object-cover rounded-lg shadow-lg" loading="lazy"></div>
        <div class="w-full md:w-1/2 p-8 flex flex-col">
            <h2 id="product-details-title" class="font-heading text-4xl font-bold mb-2">${product.name}</h2>
            <p class="text-slate-600 text-lg mb-2 capitalize">${product.category}</p>
            <div class="flex items-center gap-2 mb-4">
                ${renderStars(product.rating)}
                <span class="text-gray-500 text-sm">(${product.reviews ? product.reviews.length : 0} avaliações)</span>
            </div>
            <p class="text-gray-600 mb-6 text-lg leading-relaxed whitespace-pre-wrap">${product.description}</p>
            ${notesHtml}
            <div class="mt-auto">
                <p class="text-black font-bold text-3xl mb-6">R$ ${product.price.toFixed(2).replace('.',',')}</p>
                <button class="add-to-cart-btn w-full bg-black text-white py-3 rounded-md hover:bg-slate-800 transition-all-ease" data-id="${product.id}">Adicionar ao Carrinho</button>
            </div>
        </div>`;

    const reviewsHtml = (product.reviews && product.reviews.length > 0)
        ? product.reviews.slice().sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis()).map(review => `
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
                <h4 class="font-heading text-xl font-bold mb-4">Deixe sua Avaliação</h4>
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
                    <button type="submit" class="btn btn-primary">Enviar Avaliação</button>
                </form>
            </div>`
        : `<div class="mt-8 pt-6 border-t text-center"><p class="text-slate-600"><a href="#" id="login-to-review" class="font-semibold text-black underline">Faça login</a> para deixar sua avaliação.</p></div>`;

    const relatedProducts = state.allProducts.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);
    const relatedProductsHtml = relatedProducts.length > 0
        ? `<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">${relatedProducts.map(p => createProductCardTemplate(p)).join('')}</div>`
        : '<p class="text-gray-500 col-span-full">Nenhum produto relacionado encontrado.</p>';

    extraContentEl.innerHTML = `
        <h3 class="font-heading text-2xl font-bold mb-4">Avaliações de Clientes</h3>
        <div id="product-reviews-section">${reviewsHtml}</div>
        <div id="product-review-form-container">${reviewFormHtml}</div>
        <h3 class="font-heading text-2xl font-bold mt-12 mb-4">Produtos Relacionados</h3>
        <div id="related-products-section">${relatedProductsHtml}</div>`;

    feather.replace();
    toggleModal('product-details-modal', true);
}
