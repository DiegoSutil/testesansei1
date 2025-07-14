/**
 * @fileoverview Módulo de Autenticação.
 * Lida com login, registro e estado do usuário.
 * VERSÃO CORRIGIDA: Remove a manipulação direta do DOM da UI, que agora é tratada no script.js.
 */

import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDocs, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from '../firebase-config.js';
import { showToast, toggleModal } from './ui.js';
import { createProductCardTemplate } from "./product.js";
import { state } from "./state.js";

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
                <input type="email" id="auth-email" required class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black">
            </div>
            <div class="mb-6">
                <label for="auth-password" class="block text-sm font-semibold text-gray-700 mb-2">Senha</label>
                <input type="password" id="auth-password" required class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black">
            </div>
            <button type="submit" class="w-full btn-primary">${isLogin ? 'Entrar' : 'Registrar'}</button>
        </form>
        <div class="text-center mt-4">
            <a href="#" id="auth-toggle" class="text-sm text-slate-600 hover:underline">${isLogin ? 'Não tem uma conta? Crie uma' : 'Já tem uma conta? Faça login'}</a>
        </div>
    `;

    document.getElementById('auth-toggle').addEventListener('click', (e) => {
        e.preventDefault();
        renderAuthForm(!isLogin);
    });

    document.getElementById('auth-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        if (isLogin) {
            await handleLogin(email, password);
        } else {
            await handleRegister(email, password);
        }
    });
}

async function handleLogin(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        toggleModal('auth-modal', false);
        showToast('Login bem-sucedido!');
    } catch (error) {
        showAuthError('Email ou senha inválidos.');
    }
}

async function handleRegister(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        // Cria um documento para o novo usuário no Firestore
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            createdAt: new Date(),
            wishlist: [],
            cart: []
        });
        toggleModal('auth-modal', false);
        showToast('Conta criada com sucesso!');
    } catch (error) {
        showAuthError(error.code === 'auth/email-already-in-use' ? 'Este email já está em uso.' : 'Erro ao criar conta.');
    }
}

export async function handleLogout() {
    await signOut(auth);
    showToast('Sessão terminada.');
    // A navegação para a página inicial agora é tratada pelo observador onAuthStateChanged
}

/**
 * Atualiza os elementos da UI que dependem do estado de autenticação.
 * Esta função é chamada pelo observador em script.js.
 * @param {object|null} user - O objeto do usuário do Firebase ou null.
 */
export function updateAuthUI(user) {
    const mobileUserLink = document.getElementById('mobile-user-link');
    if (mobileUserLink) {
        mobileUserLink.textContent = user ? 'Minha Conta' : 'Login / Registro';
    }
    // A lógica de clique agora é tratada no event listener principal em script.js
}

/**
 * Renderiza a lista de desejos do usuário na página de perfil.
 */
export function renderWishlist() {
    const container = document.getElementById('wishlist-items');
    if (!container) return;

    const wishlistIds = state.currentUserData?.wishlist || [];
    if (wishlistIds.length === 0) {
        container.innerHTML = '<p class="text-slate-500 col-span-full">Sua lista de desejos está vazia.</p>';
        return;
    }

    const wishlistProducts = state.allProducts.filter(p => wishlistIds.includes(p.id));
    container.innerHTML = wishlistProducts.map(p => createProductCardTemplate(p)).join('');
    feather.replace();
}

/**
 * Renderiza o histórico de encomendas do usuário.
 */
export async function renderOrders() {
    const container = document.getElementById('orders-list');
    if (!container || !state.currentUserData) return;

    container.innerHTML = '<div class="loader-sm"></div><p>A carregar encomendas...</p>';

    try {
        const ordersRef = collection(db, `users/${state.currentUserData.uid}/orders`);
        const querySnapshot = await getDocs(ordersRef);

        if (querySnapshot.empty) {
            container.innerHTML = '<p class="text-slate-500">Você ainda não fez nenhuma encomenda.</p>';
            return;
        }

        const orders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Ordena por data, mais recente primeiro
        orders.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

        container.innerHTML = orders.map(order => `
            <div class="border p-4 rounded-lg">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-bold">Encomenda #${order.id.substring(0, 8)}</p>
                        <p class="text-sm text-slate-500">Data: ${order.createdAt.toDate().toLocaleDateString('pt-BR')}</p>
                    </div>
                    <span class="text-sm font-semibold px-2 py-1 rounded-full ${order.status === 'Entregue' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">${order.status}</span>
                </div>
                <div class="mt-4 border-t pt-4">
                    <p class="font-semibold mb-2">Total: R$ ${order.total.toFixed(2).replace('.', ',')}</p>
                    <ul class="text-sm list-disc list-inside">
                        ${order.items.map(item => `<li>${item.quantity}x ${item.name}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error("Erro ao carregar encomendas:", error);
        container.innerHTML = '<p class="text-red-500">Não foi possível carregar o seu histórico de encomendas.</p>';
    }
}
