/**
 * @fileoverview Módulo de Estado Global.
 * Centraliza o estado da aplicação para ser compartilhado entre os módulos.
 */

export let state = {
    allProducts: [],
    cart: JSON.parse(localStorage.getItem('sanseiCart')) || [],
    appliedCoupon: null,
    currentUserData: null,
    allCoupons: [],
    selectedShipping: null,
    // Estado da paginação da página de fragrâncias
    fragrancePage: 1,
};

export const productsPerPage = 12; // Define quantos produtos carregar por vez

// Funções "setters" para atualizar o estado de forma controlada
export function setAllProducts(products) {
    state.allProducts = products;
}
export function setCart(newCart) {
    state.cart = newCart;
    // Sincroniza com o localStorage sempre que o carrinho é atualizado
    localStorage.setItem('sanseiCart', JSON.stringify(newCart));
}
export function setAppliedCoupon(coupon) {
    state.appliedCoupon = coupon;
}
export function setCurrentUserData(userData) {
    state.currentUserData = userData;
}
export function setAllCoupons(coupons) {
    state.allCoupons = coupons;
}
export function setSelectedShipping(shipping) {
    state.selectedShipping = shipping;
}

// Funções de paginação
export function setFragrancePage(page) {
    state.fragrancePage = page;
}

export function incrementFragrancePage() {
    state.fragrancePage++;
}
