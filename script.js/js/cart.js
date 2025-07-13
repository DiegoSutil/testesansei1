/**
 * @fileoverview Módulo do Carrinho de Compras.
 * Contém toda a lógica para adicionar, remover e atualizar itens do carrinho.
 */

import { doc, updateDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../firebase-config.js';
import { state, setCart, setAppliedCoupon, setSelectedShipping } from './state.js';
import { showToast, showConfirmationModal, showLoader, toggleModal } from './ui.js';
import { showPage } from '../script.js';

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

async function syncCartWithFirestore() {
    if (!state.currentUserData?.uid) return;
    const userRef = doc(db, "users", state.currentUserData.uid);
    try {
        await updateDoc(userRef, { cart: state.cart });
    } catch (error) {
        console.error("Erro ao sincronizar carrinho:", error);
        showToast("Erro ao salvar o carrinho.", true);
    }
}

export async function addToCart(productId, quantity = 1, event) {
    const button = event.target.closest('.add-to-cart-btn');
    button.disabled = true;
    button.innerHTML = '<span class="loader-sm"></span>';

    const product = state.allProducts.find(p => p.id === productId);
    if (!product) {
        showToast("Erro: Produto não disponível.", true);
        button.disabled = false;
        button.innerHTML = 'Adicionar ao Carrinho';
        return;
    }

    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += quantity;
    } else {
        state.cart.push({ id: productId, quantity });
    }
    
    setCart(state.cart);
    localStorage.setItem('sanseiCart', JSON.stringify(state.cart));
    await syncCartWithFirestore();
    updateCartIcon();
    
    setTimeout(() => {
        showToast(`${product.name} adicionado ao carrinho!`);
        button.disabled = false;
        button.innerHTML = 'Adicionar ao Carrinho';
    }, 500);
}

async function removeFromCart(productId) {
    const confirmed = await showConfirmationModal('Remover este item do carrinho?');
    if (confirmed) {
        const newCart = state.cart.filter(item => item.id !== productId);
        setCart(newCart);
        localStorage.setItem('sanseiCart', JSON.stringify(newCart));
        await syncCartWithFirestore();
        updateCartIcon();
        renderCart();
        showToast('Item removido.');
    }
}

async function updateQuantity(productId, newQuantity) {
    if (newQuantity <= 0) {
        await removeFromCart(productId);
        return;
    }
    const cartItem = state.cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity = newQuantity;
        setCart(state.cart);
        localStorage.setItem('sanseiCart', JSON.stringify(state.cart));
        await syncCartWithFirestore();
        updateCartIcon();
        renderCart();
    }
}

export function renderCart() {
    const cartItemsEl = document.getElementById('cart-items');
    const subtotalEl = document.getElementById('cart-subtotal');
    const totalEl = document.getElementById('cart-total');
    
    if (state.cart.length === 0) {
        cartItemsEl.innerHTML = '<p class="text-gray-500 text-center">Seu carrinho está vazio.</p>';
        subtotalEl.textContent = 'R$ 0,00';
        totalEl.textContent = 'R$ 0,00';
        return;
    }

    const subtotal = state.cart.reduce((sum, item) => {
        const product = state.allProducts.find(p => p.id === item.id);
        return sum + (product ? product.price * item.quantity : 0);
    }, 0);

    let total = subtotal;
    // Adicionar lógica de cupom e frete aqui se necessário

    subtotalEl.textContent = `R$ ${subtotal.toFixed(2).replace('.',',')}`;
    totalEl.textContent = `R$ ${total.toFixed(2).replace('.',',')}`;

    cartItemsEl.innerHTML = state.cart.map(item => {
        const product = state.allProducts.find(p => p.id === item.id);
        if (!product) return '';
        return `
        <div class="flex items-center gap-4 mb-4">
            <img src="${product.image}" alt="${product.name}" class="w-16 h-20 object-cover rounded-md">
            <div class="flex-grow">
                <h4 class="font-semibold">${product.name}</h4>
                <p class="text-sm text-gray-600">R$ ${product.price.toFixed(2).replace('.',',')}</p>
                <div class="flex items-center mt-2">
                    <button data-id="${item.id}" data-qty="${item.quantity - 1}" class="cart-qty-btn w-6 h-6 border rounded-md">-</button>
                    <span class="px-3">${item.quantity}</span>
                    <button data-id="${item.id}" data-qty="${item.quantity + 1}" class="cart-qty-btn w-6 h-6 border rounded-md">+</button>
                </div>
            </div>
            <button data-id="${item.id}" class="cart-remove-btn text-red-500"><i data-feather="trash-2" class="w-5 h-5"></i></button>
        </div>`;
    }).join('');
    feather.replace();
}

export function setupCartEventListeners() {
    document.body.addEventListener('click', e => {
        if (e.target.closest('.cart-qty-btn')) {
            const btn = e.target.closest('.cart-qty-btn');
            updateQuantity(btn.dataset.id, parseInt(btn.dataset.qty));
        }
        if (e.target.closest('.cart-remove-btn')) {
            removeFromCart(e.target.closest('.cart-remove-btn').dataset.id);
        }
    });
}
