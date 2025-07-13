/**
 * @fileoverview Módulo de Autenticação.
 * Lida com login, registro e estado do usuário.
 */

import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDocs, collection, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from '../firebase-config.js';
import { showToast, toggleModal, renderStars } from './ui.js';
import { showPage } from './navigation.js';
import { state } from './state.js';
import { renderProducts } from './product.js';

function showAuthError(message) {
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }
}

export function renderAuthForm(isLogin = true) {
    const authContent = document.getElementById('auth-content');
    if (!authContent) return;
    authContent.innerHTML = `
        <h2 id="auth-modal-title" class="font-heading text-3xl font-bold text-center mb-6">${isLogin ? 'Login' : 'Criar Conta'}</h2>
        <div id="auth-error" class="bg-red-100 text-red-700 px-4 py-3 rounded mb-4 hidden" role="alert"></div>
        <form id="auth-form">
            <div class="mb-4">
                <label for="auth-email" class="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input type="email" id="auth-email" required class="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-black">
            </div>
            <div class="mb-4">
                <label for="auth-password" class="block text-sm font-semibold text-gray-700 mb-2">Senha</label>
                <input type="password" id="auth-password" required minlength="6" class="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-black">
            </div>
            ${!isLogin ? `
            <div class="mb-6">
                <label for="auth-confirm-password" class="block text-sm font-semibold text-gray-700 mb-2">Confirmar Senha</label>
                <input type="password" id="auth-confirm-password" required class="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-black">
            </div>` : ''}
            <button type="submit" class="w-full btn btn-primary">${isLogin ? 'Entrar' : 'Registar'}</button>
        </form>
        <p class="text-center text-sm mt-4">
            ${isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
            <a href="#" id="auth-switch" class="font-semibold text-black underline">${isLogin ? 'Crie uma aqui.' : 'Faça login.'}</a>
        </p>
    `;
    document.getElementById('auth-form').addEventListener('submit', isLogin ? handleLogin : handleRegister);
    document.getElementById('auth-switch').addEventListener('click', (e) => {
        e.preventDefault();
        renderAuthForm(!isLogin);
    });
}

async function handleLogin(e) {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        toggleModal('auth-modal', false);
        showToast('Login efetuado com sucesso!');
    } catch (error) {
        showAuthError('Email ou senha inválidos.');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    const confirm = e.target['auth-confirm-password'].value;
    if (password !== confirm) {
        showAuthError('As senhas não coincidem.');
        return;
    }
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), {
            email: userCredential.user.email,
            wishlist: [],
            cart: []
        });
        showToast('Conta criada com sucesso!');
        renderAuthForm(true);
    } catch (error) {
        showAuthError(error.code === 'auth/email-already-in-use' ? 'Este email já está em uso.' : 'Erro ao criar conta.');
    }
}

export async function handleLogout() {
    await signOut(auth);
    showToast('Sessão terminada.');
    showPage('inicio');
}

export function updateAuthUI(user) {
    const userButton = document.getElementById('user-button');
    const mobileUserLink = document.getElementById('mobile-user-link');
    const mobileBottomUserLink = document.getElementById('mobile-bottom-user-link');
    
    const showProfile = () => showPage('profile');
    const showAuthModal = () => { renderAuthForm(); toggleModal('auth-modal', true); };

    if (user) {
        userButton.onclick = showProfile;
        mobileUserLink.onclick = (e) => { e.preventDefault(); document.getElementById('close-mobile-menu').click(); showProfile(); };
        mobileUserLink.textContent = 'Minha Conta';
        mobileBottomUserLink.onclick = (e) => { e.preventDefault(); showProfile(); };
    } else {
        userButton.onclick = showAuthModal;
        mobileUserLink.onclick = (e) => { e.preventDefault(); document.getElementById('close-mobile-menu').click(); showAuthModal(); };
        mobileUserLink.textContent = 'Login / Registar';
        mobileBottomUserLink.onclick = (e) => { e.preventDefault(); showAuthModal(); };
    }
}

export async function renderWishlist() {
    const wishlistContainer = document.getElementById('wishlist-items');
    if (!state.currentUserData || !wishlistContainer) return;

    const wishlistProducts = state.allProducts.filter(p => state.currentUserData.wishlist.includes(p.id));
    if (wishlistProducts.length === 0) {
        wishlistContainer.innerHTML = '<p class="text-gray-500 col-span-full text-center">A sua lista de desejos está vazia.</p>';
        return;
    }
    renderProducts(wishlistProducts, 'wishlist-items');
}

export async function renderOrders() {
    const ordersListContainer = document.getElementById('orders-list');
    if (!state.currentUserData || !ordersListContainer) return;

    const q = query(collection(db, "orders"), where("userId", "==", state.currentUserData.uid), orderBy("createdAt", "desc"));
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            ordersListContainer.innerHTML = '<p class="text-gray-500 text-center">Você ainda não fez nenhuma encomenda.</p>';
            return;
        }
        ordersListContainer.innerHTML = '';
        querySnapshot.forEach(doc => {
            const order = {id: doc.id, ...doc.data()};
            const orderDate = order.createdAt.toDate().toLocaleDateString('pt-BR');
            const orderElement = document.createElement('div');
            orderElement.className = 'bg-gray-50 p-4 rounded-lg shadow-sm';
            orderElement.innerHTML = `
                <div class="flex justify-between items-center">
                    <div>
                        <p class="font-bold">Encomenda #${order.id.substring(0, 7)}</p>
                        <p class="text-sm text-gray-500">Data: ${orderDate}</p>
                    </div>
                    <div>
                        <p class="font-bold">Total: R$ ${order.total.toFixed(2).replace('.',',')}</p>
                        <p class="text-sm text-right font-semibold ${order.status === 'Pendente' ? 'text-yellow-500' : 'text-green-500'}">${order.status}</p>
                    </div>
                </div>`;
            ordersListContainer.appendChild(orderElement);
        });
    } catch (error) {
        console.error("Erro ao carregar encomendas:", error);
        ordersListContainer.innerHTML = '<p class="text-red-500 text-center">Erro ao carregar encomendas.</p>';
    }
}
