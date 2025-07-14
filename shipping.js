/**
 * @fileoverview Módulo de Cálculo de Frete.
 * Simula uma consulta de frete e exibe as opções para o usuário.
 * VERSÃO CORRIGIDA: Caminhos de importação ajustados para a pasta /js/.
 */

import { setSelectedShipping } from './js/state.js';
import { renderCart } from './js/cart.js';
import { showToast } from './js/ui.js';

/**
 * Simula o cálculo de frete com base em um CEP e renderiza as opções.
 * @param {string} cep - O CEP inserido pelo usuário.
 */
export async function calculateShipping(cep) {
    const cepInput = document.getElementById('cep-input');
    const calculateBtn = document.getElementById('calculate-shipping-btn');
    const btnText = calculateBtn.querySelector('.btn-text');
    const loader = calculateBtn.querySelector('.loader-sm');
    const shippingOptionsEl = document.getElementById('shipping-options');

    // Validação simples do CEP
    const cepPattern = /^[0-9]{5}-?[0-9]{3}$/;
    if (!cepPattern.test(cep)) {
        showToast("Por favor, insira um CEP válido (ex: 12345-678).", true);
        return;
    }

    // Mostra o feedback de carregamento
    if (loader) loader.classList.remove('hidden');
    if (btnText) btnText.classList.add('hidden');
    calculateBtn.disabled = true;
    shippingOptionsEl.innerHTML = ''; // Limpa opções antigas

    // Simula uma chamada de API (demora de 1.5 segundos)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Gera opções de frete falsas (mock)
    const options = [
        { name: 'SEDEX', price: parseFloat((Math.random() * 15 + 25).toFixed(2)), days: '3-5 dias úteis' },
        { name: 'PAC', price: parseFloat((Math.random() * 10 + 15).toFixed(2)), days: '7-12 dias úteis' }
    ];

    // Renderiza as opções de frete no modal do carrinho
    shippingOptionsEl.innerHTML = options.map(opt => `
        <label class="flex items-center justify-between p-3 border rounded-md cursor-pointer hover:bg-gray-100 transition-colors">
            <div class="flex items-center">
                <input type="radio" name="shipping-option" class="h-4 w-4 text-black focus:ring-black" value='${JSON.stringify(opt)}'>
                <div class="ml-3 text-sm">
                    <p class="font-semibold">${opt.name}</p>
                    <p class="text-gray-500">${opt.days}</p>
                </div>
            </div>
            <span class="font-semibold">R$ ${opt.price.toFixed(2).replace('.', ',')}</span>
        </label>
    `).join('');

    // Adiciona listeners para os novos botões de rádio
    shippingOptionsEl.querySelectorAll('input[name="shipping-option"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const selectedOption = JSON.parse(e.target.value);
            setSelectedShipping(selectedOption); // Atualiza o estado global
            renderCart(); // Re-renderiza o carrinho para mostrar o custo do frete
        });
    });

    // Restaura o botão
    if (loader) loader.classList.add('hidden');
    if (btnText) btnText.classList.remove('hidden');
    calculateBtn.disabled = false;
}
