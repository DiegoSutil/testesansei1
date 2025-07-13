/**
 * @fileoverview Módulo de Autenticação.
 * Lida com login, registro e estado do usuário.
 */

import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from '../firebase-config.js';
import { showToast, toggleModal, toggleMobileMenu } from './ui.js';
import { showPage } from '../script.js';

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
            <button type="submit" class="w-full inline-flex items-center justify-center font-semibold py-3 px-8 rounded-full transition-all duration-300 ease-in-out bg-slate-900 text-white hover:bg-black shadow-lg hover:shadow-xl">${isLogin ? 'Entrar' : 'Registar'}</button>
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
    const email = e.target.querySelector('#auth-email').value;
    const password = e.target.querySelector('#auth-password').value;
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
    const email = e.target.querySelector('#auth-email').value;
    const password = e.target.querySelector('#auth-password').value;
    const confirm = e.target.querySelector('#auth-confirm-password').value;
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
        if (userButton) userButton.onclick = showProfile;
        if (mobileUserLink) {
            mobileUserLink.onclick = (e) => { e.preventDefault(); showProfile(); toggleMobileMenu(false); };
            mobileUserLink.textContent = 'Minha Conta';
        }
        if (mobileBottomUserLink) mobileBottomUserLink.onclick = (e) => { e.preventDefault(); showProfile(); };
    } else {
        if (userButton) userButton.onclick = showAuthModal;
        if (mobileUserLink) {
            mobileUserLink.onclick = (e) => { e.preventDefault(); showAuthModal(); };
            mobileUserLink.textContent = 'Login / Registar';
        }
        if (mobileBottomUserLink) mobileBottomUserLink.onclick = (e) => { e.preventDefault(); showAuthModal(); };
    }
}
