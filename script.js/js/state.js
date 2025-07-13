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
    lastVisibleProductFront: null,
    firstVisibleProductFront: null,
    productCurrentPageFront: 1,
};

// Funções "setters" para atualizar o estado de forma controlada
export function setAllProducts(products) {
    state.allProducts = products;
}
export function setCart(newCart) {
    state.cart = newCart;
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
export function setPaginationFront(last, first, page) {
    state.lastVisibleProductFront = last;
    state.firstVisibleProductFront = first;
    state.productCurrentPageFront = page;
}
