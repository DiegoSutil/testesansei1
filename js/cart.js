/**
 * @fileoverview Módulo do Carrinho de Compras.
 * Contém toda a lógica para adicionar, remover e atualizar itens do carrinho.
 * VERSÃO CORRIGIDA E ATUALIZADA
 */

import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../firebase-config.js';
import { state, setCart } from './state.js';
import { showToast, showConfirmationModal } from './ui.js';

// FIX: Removida a linha abaixo que causava o erro de declaração duplicada.
// import { renderCart } from './cart.js';

export function updateCartIcon() {
    const cartCountEl = document.getElementById('cart-count');
    const mobileCartCountEl = document.getElementById('mobile-cart-count');
    const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);

    if (cartCountEl) {
        cartCountEl.textContent = totalItems;
        cartCountEl.classList.toggle('hidden', totalItems === 0);
    }
    if (mobileCartCountEl) {
        mobileCartCountEl.textContent = totalItems;
        mobileCartCountEl.classList.toggle('hidden', totalItems === 0);
    }
}

export async function syncCartWithFirestore() {
    if (!state.currentUserData?.uid) return;
    const userRef = doc(db, "users", state.currentUserData.uid);
    try {
        await setDoc(userRef, { cart: state.cart }, { merge: true });
    } catch (error) {
        console.error("Erro ao sincronizar carrinho:", error);
        showToast("Erro ao salvar o carrinho.", true);
    }
}

export async function addToCart(productId, quantity = 1, event) {
    const button = event.target.closest('.add-to-cart-btn');
    
    const product = state.allProducts.find(p => p.id === productId);
    if (!product) {
        showToast("Erro: Produto não disponível.", true);
        return;
    }

    if (product.stock <= 0) {
        showToast("Este produto está esgotado.", true);
        return;
    }

    if(button) {
        button.disabled = true;
        button.innerHTML = '<span class="loader-sm"></span>';
    }

    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        if (cartItem.quantity + quantity > product.stock) {
            showToast(`Stock insuficiente. Apenas ${product.stock} unidades disponíveis.`, true);
            if(button) {
                button.disabled = false;
                button.innerHTML = 'Adicionar ao Carrinho';
            }
            return;
        }
        cartItem.quantity += quantity;
    } else {
        if (quantity > product.stock) {
            showToast(`Stock insuficiente. Apenas ${product.stock} unidades disponíveis.`, true);
             if(button) {
                button.disabled = false;
                button.innerHTML = 'Adicionar ao Carrinho';
            }
            return;
        }
        state.cart.push({ id: productId, quantity });
    }
    
    setCart(state.cart);
    await syncCartWithFirestore();
    updateCartIcon();
    renderCart();

    setTimeout(() => {
        showToast(`${product.name} adicionado ao carrinho!`);
        if(button) {
            button.disabled = false;
            button.innerHTML = 'Adicionar ao Carrinho';
        }
    }, 500);
}

async function removeFromCart(productId) {
    const confirmed = await showConfirmationModal('Remover este item do carrinho?');
    if (confirmed) {
        const newCart = state.cart.filter(item => item.id !== productId);
        setCart(newCart);
        await syncCartWithFirestore();
        updateCartIcon();
        renderCart();
        showToast('Item removido.');
    }
}

async function updateQuantity(productId, newQuantity) {
    const product = state.allProducts.find(p => p.id === productId);
    if (!product) return;

    if (newQuantity > product.stock) {
        showToast(`Stock insuficiente. Apenas ${product.stock} unidades disponíveis.`, true);
        renderCart();
        return;
    }

    if (newQuantity <= 0) {
        await removeFromCart(productId);
        return;
    }
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity = newQuantity;
        setCart(state.cart);
        await syncCartWithFirestore();
        updateCartIcon();
        renderCart();
    }
}

export function renderCart() {
    const cartItemsEl = document.getElementById('cart-items');
    const subtotalEl = document.getElementById('cart-subtotal');
    const totalEl = document.getElementById('cart-total');
    const discountInfoEl = document.getElementById('discount-info');
    const shippingCostLine = document.getElementById('shipping-cost-line');
    const shippingCostEl = document.getElementById('shipping-cost');
    const checkoutButton = document.getElementById('checkout-button');

    if (!cartItemsEl || !subtotalEl || !totalEl || !discountInfoEl) return;

    if (state.cart.length === 0) {
        cartItemsEl.innerHTML = '<p class="text-gray-500 text-center py-8">Seu carrinho está vazio.</p>';
        subtotalEl.textContent = 'R$ 0,00';
        totalEl.textContent = 'R$ 0,00';
        discountInfoEl.innerHTML = '';
        shippingCostLine.classList.add('hidden');
        checkoutButton.disabled = true;
        return;
    }

    checkoutButton.disabled = false;

    const subtotal = state.cart.reduce((sum, item) => {
        const product = state.allProducts.find(p => p.id === item.id);
        return sum + (product ? product.price * item.quantity : 0);
    }, 0);

    let discount = 0;
    if (state.appliedCoupon) {
        discount = subtotal * state.appliedCoupon.discount;
        discountInfoEl.innerHTML = `
            <div class="flex justify-between text-green-600">
                <span>Desconto (${state.appliedCoupon.code})</span>
                <span>- R$ ${discount.toFixed(2).replace('.',',')}</span>
            </div>
        `;
    } else {
        discountInfoEl.innerHTML = '';
    }

    let shippingCost = 0;
    if (state.selectedShipping) {
        shippingCost = state.selectedShipping.price;
        shippingCostEl.textContent = `R$ ${shippingCost.toFixed(2).replace('.', ',')}`;
        shippingCostLine.classList.remove('hidden');
    } else {
        shippingCostLine.classList.add('hidden');
    }

    let total = subtotal - discount + shippingCost;
    
    subtotalEl.textContent = `R$ ${subtotal.toFixed(2).replace('.',',')}`;
    totalEl.textContent = `R$ ${total.toFixed(2).replace('.',',')}`;

    cartItemsEl.innerHTML = state.cart.map(item => {
        const product = state.allProducts.find(p => p.id === item.id);
        if (!product) return '';
        return `
        <div class="flex items-center gap-4 py-4 border-b last:border-b-0">
            <img src="${product.image}" alt="${product.name}" class="w-16 h-20 object-cover rounded-md flex-shrink-0" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/64x80/cccccc/ffffff?text=Img';">
            <div class="flex-grow">
                <h4 class="font-semibold text-sm">${product.name}</h4>
                <p class="text-xs text-gray-600">R$ ${product.price.toFixed(2).replace('.',',')}</p>
                <div class="flex items-center mt-2">
                    <button data-id="${item.id}" data-qty="${item.quantity - 1}" class="cart-qty-btn w-6 h-6 border rounded-md flex items-center justify-center">-</button>
                    <span class="px-3 text-sm">${item.quantity}</span>
                    <button data-id="${item.id}" data-qty="${item.quantity + 1}" class="cart-qty-btn w-6 h-6 border rounded-md flex items-center justify-center">+</button>
                </div>
            </div>
            <button data-id="${item.id}" class="cart-remove-btn text-red-500 hover:text-red-700"><i data-feather="trash-2" class="w-5 h-5"></i></button>
        </div>`;
    }).join('');
    feather.replace();
}

export function setupCartEventListeners() {
    document.body.addEventListener('click', e => {
        const qtyBtn = e.target.closest('.cart-qty-btn');
        if (qtyBtn) {
            updateQuantity(qtyBtn.dataset.id, parseInt(qtyBtn.dataset.qty));
        }
        const removeBtn = e.target.closest('.cart-remove-btn');
        if (removeBtn) {
            removeFromCart(removeBtn.dataset.id);
        }
    });
}
