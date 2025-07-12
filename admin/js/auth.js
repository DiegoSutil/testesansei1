/**
 * @fileoverview Módulo de Autenticação para o Painel de Admin.
 */
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from '../../firebase-config.js'; // Caminho corrigido
import { DOMElements, showAuthMessage, switchView } from './ui.js';
import { initializeAdminPanel } from './main.js';

// IMPORTANT: Lista de emails de administradores autorizados.
// Em um ambiente de produção, considere usar Firebase Custom Claims para maior segurança.
// Exemplo de verificação de Custom Claim (requer configuração no backend do Firebase):
// if (user && user.emailVerified && user.customClaims && user.customClaims.admin) { ... }
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
        // showAuthMessage('Login bem-sucedido!', 'green'); // Feedback positivo
    } catch (error) {
        console.error("Erro no Login:", error.code, error.message); // Log mais detalhado
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
        // showAuthMessage('Logout bem-sucedido.', 'green'); // Feedback positivo
    } catch (error) {
        console.error("Erro no Logout:", error);
        showAuthMessage('Ocorreu um erro ao fazer logout.', 'red'); // Feedback de erro
    }
}

/**
 * Observa mudanças no estado de autenticação e controla o acesso ao painel.
 */
export function authStateObserver() {
    onAuthStateChanged(auth, async (user) => {
        if (user && ADMIN_EMAILS.includes(user.email)) {
            // Em um ambiente de produção, você também verificaria custom claims aqui:
            // const idTokenResult = await user.getIdTokenResult();
            // if (idTokenResult.claims.admin) { ... }
            DOMElements.authScreen.classList.add('hidden');
            DOMElements.adminPanel.classList.remove('hidden');
            DOMElements.adminEmail.textContent = user.email;
            
            // Se o utilizador for um admin, inicializa o painel
            initializeAdminPanel();
        } else {
            DOMElements.authScreen.classList.remove('hidden');
            DOMElements.adminPanel.classList.add('hidden');
            if (user) { 
                // Se o utilizador está logado mas não é admin, faz logout
                console.warn(`Usuário ${user.email} tentou acessar o painel de admin sem permissão. Fazendo logout.`);
                await signOut(auth);
                showAuthMessage('Acesso negado. Você não tem permissão de administrador.', 'red');
            } else {
                showAuthMessage('Por favor, faça login para acessar o painel de administração.', 'blue'); // Mensagem padrão para não logados
            }
        }
    });
}
