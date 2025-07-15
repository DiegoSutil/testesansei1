/**
 * @fileoverview Módulo de Gestão de Avaliações.
 * VERSÃO CORRIGIDA E ATUALIZADA
 */
import { collection, getDocs, doc, updateDoc, getDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../../firebase-config.js';
import { DOMElements, showToast, renderStars, showAdminConfirmationModal } from './ui.js';
import { fetchStats } from './stats.js';

export async function fetchAndRenderReviews() {
    try {
        const productsSnapshot = await getDocs(collection(db, "products"));
        DOMElements.reviewListBody.innerHTML = '';
        productsSnapshot.forEach(pDoc => {
            const product = { id: pDoc.id, ...pDoc.data() };
            if (product.reviews && product.reviews.length > 0) {
                product.reviews.forEach((review) => {
                    // FIX: Garante que a avaliação tenha um ID para exclusão segura
                    if (!review.reviewId) return;

                    const row = document.createElement('tr');
                    row.className = 'border-b';
                    row.innerHTML = `
                        <td class="py-3 px-2">${product.name}</td>
                        <td class="py-3 px-2">${review.userName}</td>
                        <td class="py-3 px-2">${renderStars(review.rating)}</td>
                        <td class="py-3 px-2 text-xs">${review.text}</td>
                        <td class="py-3 px-2">
                            <button class="delete-review-btn text-red-500 hover:text-red-700" data-product-id="${product.id}" data-review-id="${review.reviewId}">
                                <i data-feather="trash-2" class="w-5 h-5"></i>
                            </button>
                        </td>`;
                    DOMElements.reviewListBody.appendChild(row);
                });
            }
        });
        feather.replace();
    } catch (error) {
        console.error("Error fetching reviews: ", error);
        showToast("Erro ao carregar avaliações.", true);
    }
}

// FIX: Função de exclusão agora usa o reviewId único em vez do índice do array
export async function deleteReview(productId, reviewId) {
    const confirmed = await showAdminConfirmationModal('Tem a certeza que quer eliminar esta avaliação?', 'Eliminar Avaliação');
    if (confirmed) {
        const productRef = doc(db, "products", productId);
        try {
            const productDoc = await getDoc(productRef);
            if (!productDoc.exists()) throw new Error("Produto não encontrado");
            
            const reviews = productDoc.data().reviews || [];
            // Encontra a avaliação exata a ser deletada pelo seu ID
            const reviewToDelete = reviews.find(r => r.reviewId === reviewId);
            
            if (!reviewToDelete) throw new Error("Avaliação não encontrada para exclusão.");

            // Usa a operação atômica arrayRemove com o objeto exato
            await updateDoc(productRef, { reviews: arrayRemove(reviewToDelete) });

            // Recalcula a média após a remoção
            const updatedDoc = await getDoc(productRef);
            const updatedReviews = updatedDoc.data().reviews || [];
            const newAvgRating = updatedReviews.length > 0
                ? updatedReviews.reduce((sum, r) => sum + r.rating, 0) / updatedReviews.length
                : 0;
            await updateDoc(productRef, { rating: newAvgRating });

            showToast('Avaliação eliminada com sucesso.');
            await fetchAndRenderReviews();
            await fetchStats();
        } catch (error) {
            console.error("Error deleting review: ", error);
            showToast('Erro ao eliminar avaliação.', true);
        }
    }
}
