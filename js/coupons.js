/**
 * @fileoverview Módulo de Cupões para a Loja.
 * Lida com a aplicação de cupons de desconto no carrinho.
 */

import { state, setAppliedCoupon } from './state.js';
import { showToast } from './ui.js';
import { renderCart } from './cart.js';

/**
 * Aplica um cupom de desconto ao carrinho.
 * @param {string} couponCode - O código do cupom inserido pelo usuário.
 */
export function applyCoupon(couponCode) {
    if (!couponCode) {
        showToast("Por favor, insira um código de cupom.", true);
        return;
    }

    const code = couponCode.trim().toUpperCase();
    
    // Procura o cupom na lista de cupons carregados do Firestore
    const coupon = state.allCoupons.find(c => c.code === code);

    if (coupon) {
        setAppliedCoupon(coupon);
        showToast(`Cupom "${coupon.code}" aplicado com sucesso!`);
    } else {
        setAppliedCoupon(null); // Remove qualquer cupom aplicado anteriormente se o novo for inválido
        showToast("Cupom inválido ou expirado.", true);
    }

    // Re-renderiza o carrinho para mostrar o desconto (ou a sua remoção)
    renderCart();
}
