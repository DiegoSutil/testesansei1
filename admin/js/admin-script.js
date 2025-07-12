import { auth, db } from '../../firebase-config.js'; // Caminho corrigido: sobe dois níveis para encontrar firebase-config.js
import { DOMElements, showToast, showAuthMessage, switchView, renderStars } from './ui.js';
import { initializeAdminPanel } from './main.js';
import { showAdminConfirmationModal } from './ui.js'; // Importa o modal de confirmação personalizado

// IMPORTANT: Lista de emails de administradores autorizados.
// Considere usar Custom Claims do Firebase para maior segurança em produção.
const ADMIN_EMAILS = ["admin@sansei.com", "diego.sutil@gmail.com", "sanseiadmin@gmail.com"];

// =================================================================
// UTILITY & UI FUNCTIONS (Movidas para ui.js ou mantidas se específicas do admin-script)
// =================================================================
// showToast, showAuthMessage, switchView, renderStars são agora importadas de ui.js

// =================================================================
// DATA FETCHING & RENDERING (Funções de busca e renderização)
// =================================================================

// As funções fetchStats, fetchAndRenderProducts, fetchAndRenderReviews,
// fetchAndRenderCoupons, fetchAndRenderReels, fetchAndRenderOrders
// foram movidas para os seus respetivos módulos (stats.js, products.js, etc.)
// e são chamadas através de initializeAdminPanel ou setupEventListeners.

// =================================================================
// CRUD & FORM HANDLING (Funções de CRUD e manipulação de formulários)
// =================================================================

// updateOrderStatus, resetProductForm, populateProductForm, handleProductFormSubmit
// foram movidas para os seus respetivos módulos (orders.js, products.js)

// Funções de exclusão que usam o modal de confirmação
// Nota: Estas funções foram movidas para os seus respetivos módulos (products.js, reviews.js, etc.)
// para melhor modularização. O admin-script.js deve apenas chamar as funções exportadas.
// Mantendo-as aqui para referência, mas a versão nos módulos individuais é a que será usada.

/*
async function deleteProduct(productId) {
    const confirmed = await showAdminConfirmationModal('Tem certeza que quer eliminar este produto?', 'Eliminar Produto');
    if (confirmed) {
        try {
            await deleteDoc(doc(db, "products", productId));
            showToast('Produto eliminado com sucesso.');
            // Re-renderiza a lista de produtos e atualiza as estatísticas
            // Note: fetchAndRenderProducts e fetchStats devem ser importadas ou acessíveis globalmente
            // Para este ficheiro, elas são chamadas via main.js ou através de DOMElements event listeners
            // Se esta função estiver em products.js, ela importaria diretamente.
            // Como está aqui, assumimos que as chamadas subsequentes são tratadas pelo fluxo de eventos.
        } catch (error) {
            console.error("Error deleting product: ", error);
            showToast('Erro ao eliminar produto.', true);
        }
    }
}

async function deleteReview(productId, reviewIndex) {
    const confirmed = await showAdminConfirmationModal('Tem certeza que quer eliminar esta avaliação?', 'Eliminar Avaliação');
    if (confirmed) {
        const productRef = doc(db, "products", productId);
        try {
            const productDoc = await getDoc(productRef);
            if (!productDoc.exists()) throw new Error("Produto não encontrado");
            
            const reviews = productDoc.data().reviews || [];
            const reviewToDelete = reviews[reviewIndex];
            
            if (!reviewToDelete) throw new Error("Avaliação não encontrada");

            // Remove a avaliação específica do array
            await updateDoc(productRef, {
                reviews: arrayRemove(reviewToDelete)
            });

            // Recalcula a média
            const updatedProductDoc = await getDoc(productRef);
            const updatedReviews = updatedProductDoc.data().reviews || [];
            const newAvgRating = updatedReviews.length > 0
                ? updatedReviews.reduce((sum, r) => sum + r.rating, 0) / updatedReviews.length
                : 0;
            
            await updateDoc(productRef, { rating: newAvgRating });

            showToast('Avaliação eliminada com sucesso.');
            // Re-renderiza as avaliações e atualiza as estatísticas
            // (Assumindo que estas chamadas são tratadas pelo fluxo de eventos ou importadas)
        } catch (error) {
            console.error("Error deleting review: ", error);
            showToast('Erro ao eliminar avaliação.', true);
        }
    }
}

async function deleteCoupon(couponId) {
    const confirmed = await showAdminConfirmationModal('Tem certeza que quer eliminar este cupom?', 'Eliminar Cupom');
    if (confirmed) {
        try {
            await deleteDoc(doc(db, "coupons", couponId));
            showToast('Cupom eliminado com sucesso.');
            // Re-renderiza os cupões e atualiza as estatísticas
            // (Assumindo que estas chamadas são tratadas pelo fluxo de eventos ou importadas)
        } catch (error) {
            showToast('Erro ao eliminar cupom.', true);
        }
    }
}

async function deleteReel(reelId) {
    const confirmed = await showAdminConfirmationModal('Tem certeza que quer eliminar este reel?', 'Eliminar Reel');
    if (confirmed) {
        try {
            await deleteDoc(doc(db, "reels", reelId));
            showToast('Reel eliminado com sucesso.');
            // Re-renderiza os reels
            // (Assumindo que estas chamadas são tratadas pelo fluxo de eventos ou importadas)
        } catch (error) {
            showToast('Erro ao eliminar reel.', true);
        }
    }
}
*/

// =================================================================
// AUTHENTICATION (Funções de autenticação)
// =================================================================

// handleLogin, handleLogout, authStateObserver são importadas de auth.js

// =================================================================
// MAIN APP LOGIC & EVENT LISTENERS (Lógica principal e listeners de eventos)
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Inicializa Feather Icons
    feather.replace();

    // Observa mudanças no estado de autenticação para controlar o acesso ao painel
    // Esta função é agora importada e chamada do módulo auth.js
    // authStateObserver(); // Comentado pois é chamado em main.js

    // Configura os event listeners
    // Estes event listeners foram movidos para main.js
    // No entanto, as funções de exclusão (deleteProduct, deleteReview, deleteCoupon, deleteReel)
    // precisam ser acessíveis globalmente ou importadas onde os listeners estão.
    // Como os listeners estão em main.js, e as funções de exclusão estão aqui,
    // vamos garantir que main.js as importe ou que elas sejam exportadas daqui.
    // Para simplificar e seguir a modularização, as funções de exclusão deveriam estar nos seus respetivos módulos.
    // Por agora, vou deixar como está, mas é um ponto a considerar para refatoração.

    // Event listeners para o painel de administração
    // Estes são os listeners que estavam no admin-script.js original.
    // Eles devem chamar as funções importadas dos respetivos módulos.

    // Autenticação
    // DOMElements.loginForm.addEventListener('submit', handleLogin); // Movido para main.js
    // DOMElements.logoutButton.addEventListener('click', handleLogout); // Movido para main.js

    // Navegação Principal
    // DOMElements.navLinks.forEach(link => { // Movido para main.js
    //     link.addEventListener('click', (e) => {
    //         e.preventDefault();
    //         switchView(link.dataset.view);
    //     });
    // });

    // Produtos
    // DOMElements.productForm.addEventListener('submit', handleProductFormSubmit); // Movido para main.js
    // DOMElements.cancelEditBtn.addEventListener('click', resetProductForm); // Movido para main.js
    // DOMElements.productListBody.addEventListener('click', (e) => { // Movido para main.js
    //     const editBtn = e.target.closest('.edit-btn');
    //     const deleteBtn = e.target.closest('.delete-btn');
    //     if (editBtn) populateProductForm(editBtn.dataset.id);
    //     // Chama a função deleteProduct do módulo products.js
    //     if (deleteBtn) deleteProduct(deleteBtn.dataset.id);
    // });
    // Paginação de produtos - listeners para os botões
    // DOMElements.nextProductPageBtn.addEventListener('click', () => fetchAndRenderProducts('next')); // Movido para main.js
    // DOMElements.prevProductPageBtn.addEventListener('click', () => fetchAndRenderProducts('prev')); // Movido para main.js
    
    // Encomendas
    // DOMElements.orderListBody.addEventListener('change', (e) => { // Movido para main.js
    //     if (e.target.classList.contains('order-status-select')) {
    //         updateOrderStatus(e.target.dataset.id, e.target.value);
    //     }
    // });
    
    // Avaliações
    // DOMElements.reviewListBody.addEventListener('click', (e) => { // Movido para main.js
    //     const deleteBtn = e.target.closest('.delete-review-btn');
    //     if (deleteBtn) {
    //         const productId = deleteBtn.dataset.productId;
    //         const reviewIndex = parseInt(deleteBtn.dataset.reviewIndex, 10);
    //         // Chama a função deleteReview do módulo reviews.js
    //         deleteReview(productId, reviewIndex);
    //     }
    // });

    // Cupões
    // DOMElements.addCouponForm.addEventListener('submit', handleCouponFormSubmit); // Movido para main.js
    // DOMElements.couponListBody.addEventListener('click', (e) => { // Movido para main.js
    //     const deleteBtn = e.target.closest('.delete-coupon-btn');
    //     // Chama a função deleteCoupon do módulo coupons.js
    //     if (deleteBtn) deleteCoupon(deleteBtn.dataset.id);
    // });

    // Reels
    // DOMElements.addReelForm.addEventListener('submit', handleAddReelFormSubmit); // Movido para main.js
    // DOMElements.reelListBody.addEventListener('click', (e) => { // Movido para main.js
    //     const deleteBtn = e.target.closest('.delete-reel-btn');
    //     // Chama a função deleteReel do módulo reels.js
    //     if (deleteBtn) deleteReel(deleteBtn.dataset.id);
    // });

    // Listener para fechar o modal de confirmação com a tecla Escape
    // document.addEventListener('keydown', (e) => { // Movido para main.js
    //     if (e.key === 'Escape') {
    //         // Assumindo que hideAdminConfirmationModal é global ou importado
    //         hideAdminConfirmationModal();
    //     }
    // });

    // Inicializa o painel de administração se o utilizador já estiver autenticado
    // (Esta lógica é agora tratada por authStateObserver em auth.js)
});

// Nota: As funções como fetchAndRenderProducts, fetchAndRenderOrders, etc.
// são chamadas dentro de initializeAdminPanel (em main.js) ou através dos event listeners.
// Para que as funções de exclusão (deleteProduct, deleteReview, etc.) possam re-renderizar
// as listas e atualizar as estatísticas, elas precisarão importar as funções
// fetchAndRenderX e fetchStats dos seus respetivos módulos.
// Vou fazer essa correção nos ficheiros individuais.
