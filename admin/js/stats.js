/**
 * @fileoverview Módulo de Estatísticas.
 * Busca os dados de várias coleções para popular o dashboard do admin.
 */
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../../firebase-config.js';
import { DOMElements, showToast } from './ui.js';

export async function fetchStats() {
    try {
        // Usamos Promise.all para buscar todos os dados em paralelo
        const [ordersSnap, productsSnap, usersSnap, reviewsSnap] = await Promise.all([
            getDocs(collection(db, "orders")),
            getDocs(collection(db, "products")),
            getDocs(collection(db, "users")),
            getDocs(collection(db, "products")) // Para contar as avaliações, precisamos dos produtos
        ]);

        // Calcula o total de avaliações somando o tamanho do array de reviews de cada produto
        const totalReviews = reviewsSnap.docs.reduce((acc, doc) => {
            const reviews = doc.data().reviews || [];
            return acc + reviews.length;
        }, 0);

        // Atualiza os elementos do DOM com os totais
        DOMElements.statsOrders.textContent = ordersSnap.size;
        DOMElements.statsProducts.textContent = productsSnap.size;
        DOMElements.statsUsers.textContent = usersSnap.size;
        DOMElements.statsReviews.textContent = totalReviews;

    } catch (error) {
        console.error("Error fetching stats:", error);
        // Verifica se o erro é de permissão e mostra uma mensagem útil
        if (error.code === 'permission-denied' || error.code === 'missing-or-insufficient-permissions') {
            showToast("Erro de permissão ao buscar estatísticas. Verifique as regras de segurança.", true);
        } else {
            showToast("Erro ao carregar estatísticas do dashboard.", true);
        }
    }
}
