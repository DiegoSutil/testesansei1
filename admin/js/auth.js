/**
 * @fileoverview Módulo de Autenticação para o Painel de Admin.
 * VERSÃO CORRIGIDA: Remove a dependência circular com main.js usando um callback.
 */
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from '../../firebase-config.js';
import { DOMElements, showAuthMessage } from './ui.js';

// Lista de emails de administradores autorizados.
const ADMIN_EMAILS = ["admin@sansei.com", "diego.sutil@gmail.com", "sanseiadmin@gmail.com"];

/**
 * Tenta fazer login do administrador.
 * @param {Event} e - O evento do formulário.
 */
export async function handleLogin(e) {
    e.preventDefault();
    const email = DOMElements.loginForm.email.value;
    const password = DOMElements.loginForm.password.value;

    if (!ADMIN_EMAILS.includes(email)) {
        showAuthMessage('Acesso negado. Este email não é de um administrador.', 'red');
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Erro no Login:", error.code, error.message);
        let errorMessage = 'Email ou senha inválidos.';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = 'Email ou senha incorretos.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Formato de email inválido.';
        }
        showAuthMessage(errorMessage, 'red');
    }
}

/**
 * Faz logout do utilizador atual.
 */
export async function handleLogout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Erro no Logout:", error);
        showAuthMessage('Ocorreu um erro ao fazer logout.', 'red');
    }
}

/**
 * Observa mudanças no estado de autenticação e controla o acesso ao painel.
 * @param {function} onAdminLogin - Callback a ser executado quando um admin faz login com sucesso.
 */
export function authStateObserver(onAdminLogin) {
    onAuthStateChanged(auth, async (user) => {
        if (user && ADMIN_EMAILS.includes(user.email)) {
            DOMElements.authScreen.classList.add('hidden');
            DOMElements.adminPanel.classList.remove('hidden');
            if (DOMElements.adminEmail) DOMElements.adminEmail.textContent = user.email;
            
            // Chama o callback de sucesso passado pelo main.js
            if (onAdminLogin) {
                onAdminLogin(user);
            }
        } else {
            DOMElements.authScreen.classList.remove('hidden');
            DOMElements.adminPanel.classList.add('hidden');
            if (user) { 
                console.warn(`Usuário ${user.email} tentou acessar o painel de admin sem permissão. Fazendo logout.`);
                await signOut(auth);
                showAuthMessage('Acesso negado. Você não tem permissão de administrador.', 'red');
            } else {
                showAuthMessage('Por favor, faça login para acessar o painel de administração.', 'blue');
            }
        }
    });
}
