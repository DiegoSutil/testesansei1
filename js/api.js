/**
 * @fileoverview Módulo de API.
 * Contém todas as funções para buscar dados do Firestore.
 */

import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../firebase-config.js';
import { setAllProducts, setAllCoupons } from './state.js';
import { showToast } from './ui.js';

export async function fetchInitialData() {
    try {
        const productsSnapshot = await getDocs(collection(db, "products"));
        const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllProducts(products);

        const couponsSnapshot = await getDocs(collection(db, "coupons"));
        const coupons = couponsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllCoupons(coupons);

        return products; // Return products for initial render
    } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
        showToast("Não foi possível carregar os dados do site.", true);
    }
}

export async function fetchAndRenderReels() {
    const reelsContainer = document.getElementById('reels-container');
    if (!reelsContainer) return;

    try {
        const reelsSnapshot = await getDocs(collection(db, "reels"));
        if (reelsSnapshot.empty) {
            reelsContainer.innerHTML = '<p class="text-gray-400 col-span-full text-center">Nenhum reel encontrado.</p>';
            return;
        }
        reelsContainer.innerHTML = '';
        reelsSnapshot.forEach(doc => {
            const reel = doc.data();
            const reelElement = document.createElement('a');
            reelElement.href = reel.url;
            reelElement.target = '_blank';
            reelElement.className = 'block relative group';
            reelElement.setAttribute('aria-label', `Ver reel: ${reel.url}`);
            reelElement.innerHTML = `
                <img src="${reel.thumbnail}" alt="Reel" class="w-full h-full object-cover rounded-lg aspect-square" loading="lazy">
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all-ease flex items-center justify-center">
                    <i data-feather="play-circle" class="text-white opacity-0 group-hover:opacity-100 w-10 h-10"></i>
                </div>
            `;
            reelsContainer.appendChild(reelElement);
        });
        feather.replace();
    } catch (error) {
        console.error("Erro ao carregar reels:", error);
        reelsContainer.innerHTML = '<p class="text-red-500 col-span-full text-center">Não foi possível carregar os reels.</p>';
    }
}
